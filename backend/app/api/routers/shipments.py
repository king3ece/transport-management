"""Expéditions de colis / fret, avec suivi public par numéro de tracking."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, StaffUser
from app.models import (
    Customer,
    PaymentStatus,
    Route,
    Shipment,
    ShipmentEvent,
    ShipmentStatus,
    Trip,
    TripStatus,
)
from app.schemas import (
    ShipmentCreate,
    ShipmentEventCreate,
    ShipmentRead,
    ShipmentUpdate,
)
from app.services import cargo_loaded_kg, quote_shipment_price, unique_reference

router = APIRouter(prefix="/api/shipments", tags=["shipments"])


def _get_shipment(db: DbSession, shipment_id: int) -> Shipment:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Colis introuvable")
    return shipment


def _assign_trip(db: DbSession, shipment: Shipment, trip_id: int) -> None:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    if trip.status in (TripStatus.completed, TripStatus.cancelled):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce voyage n'est plus planifiable")
    already = cargo_loaded_kg(trip) - (shipment.weight_kg if shipment.trip_id == trip.id else 0)
    if already + shipment.weight_kg > trip.vehicle.cargo_capacity_kg:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Capacité de fret dépassée : {already + shipment.weight_kg:.0f} kg demandés "
                f"pour {trip.vehicle.cargo_capacity_kg:.0f} kg disponibles"
            ),
        )
    shipment.trip_id = trip.id


@router.get("", response_model=list[ShipmentRead])
def list_shipments(
    db: DbSession,
    _: CurrentUser,
    shipment_status: ShipmentStatus | None = Query(default=None, alias="status"),
    payment_status: PaymentStatus | None = None,
    trip_id: int | None = None,
    search: str | None = None,
) -> list[Shipment]:
    query = db.query(Shipment)
    if shipment_status:
        query = query.filter(Shipment.status == shipment_status)
    if payment_status:
        query = query.filter(Shipment.payment_status == payment_status)
    if trip_id:
        query = query.filter(Shipment.trip_id == trip_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Shipment.tracking_number.ilike(pattern)
            | Shipment.recipient_name.ilike(pattern)
            | Shipment.destination.ilike(pattern)
        )
    return query.order_by(Shipment.created_at.desc()).all()


@router.get("/track/{tracking_number}", response_model=ShipmentRead)
def track_shipment(tracking_number: str, db: DbSession) -> Shipment:
    """Suivi public : accessible sans authentification avec le numéro de suivi."""
    shipment = db.query(Shipment).filter(Shipment.tracking_number == tracking_number.upper()).first()
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Numéro de suivi inconnu")
    return shipment


@router.post("", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
def create_shipment(payload: ShipmentCreate, db: DbSession, _: CurrentUser) -> Shipment:
    if db.get(Customer, payload.sender_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expéditeur introuvable")

    price = payload.price
    if price is None:
        route = db.query(Route).filter(Route.origin == payload.origin, Route.destination == payload.destination).first()
        price = quote_shipment_price(payload.weight_kg, route.freight_price_per_kg if route else 0)

    data = payload.model_dump(exclude={"price", "trip_id"})
    shipment = Shipment(
        **data,
        price=price,
        tracking_number=unique_reference(db, Shipment, "tracking_number", "CLS"),
    )
    db.add(shipment)
    db.flush()
    if payload.trip_id is not None:
        _assign_trip(db, shipment, payload.trip_id)
    shipment.events.append(
        ShipmentEvent(status=ShipmentStatus.registered, location=payload.origin, note="Colis enregistré")
    )
    db.commit()
    db.refresh(shipment)
    return shipment


@router.get("/{shipment_id}", response_model=ShipmentRead)
def get_shipment(shipment_id: int, db: DbSession, _: CurrentUser) -> Shipment:
    return _get_shipment(db, shipment_id)


@router.patch("/{shipment_id}", response_model=ShipmentRead)
def update_shipment(shipment_id: int, payload: ShipmentUpdate, db: DbSession, _: CurrentUser) -> Shipment:
    shipment = _get_shipment(db, shipment_id)
    data = payload.model_dump(exclude_unset=True)
    trip_id = data.pop("trip_id", "__unset__")
    for field, value in data.items():
        setattr(shipment, field, value)
    if trip_id != "__unset__":
        if trip_id is None:
            shipment.trip_id = None
        else:
            _assign_trip(db, shipment, trip_id)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.post("/{shipment_id}/events", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
def add_event(shipment_id: int, payload: ShipmentEventCreate, db: DbSession, _: CurrentUser) -> Shipment:
    shipment = _get_shipment(db, shipment_id)
    shipment.status = payload.status
    if payload.status == ShipmentStatus.delivered:
        shipment.delivered_at = datetime.now(timezone.utc)
    shipment.events.append(ShipmentEvent(**payload.model_dump()))
    db.commit()
    db.refresh(shipment)
    return shipment


@router.delete("/{shipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shipment(shipment_id: int, db: DbSession, _: StaffUser) -> None:
    shipment = _get_shipment(db, shipment_id)
    db.delete(shipment)
    db.commit()
