"""Routes (lignes commerciales), clients et voyages."""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_

from app.api.deps import CurrentUser, DbSession, StaffUser
from app.models import (
    Customer,
    Driver,
    DriverStatus,
    Route,
    Trip,
    TripStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    RouteCreate,
    RouteRead,
    RouteUpdate,
    TripCreate,
    TripRead,
    TripUpdate,
)
from app.services import trip_to_read, unique_reference

routes_router = APIRouter(prefix="/api/routes", tags=["routes"])
customers_router = APIRouter(prefix="/api/customers", tags=["customers"])
trips_router = APIRouter(prefix="/api/trips", tags=["trips"])


@routes_router.get("", response_model=list[RouteRead])
def list_routes(db: DbSession, _: CurrentUser, search: str | None = None, active_only: bool = False) -> list[Route]:
    query = db.query(Route)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Route.code.ilike(pattern), Route.origin.ilike(pattern), Route.destination.ilike(pattern))
        )
    if active_only:
        query = query.filter(Route.is_active.is_(True))
    return query.order_by(Route.code).all()


@routes_router.post("", response_model=RouteRead, status_code=status.HTTP_201_CREATED)
def create_route(payload: RouteCreate, db: DbSession, _: StaffUser) -> Route:
    if db.query(Route).filter(Route.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce code de ligne existe déjà")
    route = Route(**payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@routes_router.patch("/{route_id}", response_model=RouteRead)
def update_route(route_id: int, payload: RouteUpdate, db: DbSession, _: StaffUser) -> Route:
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    db.commit()
    db.refresh(route)
    return route


@routes_router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(route_id: int, db: DbSession, _: StaffUser) -> None:
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne introuvable")
    if route.trips:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette ligne a des voyages : désactivez-la plutôt",
        )
    db.delete(route)
    db.commit()


@customers_router.get("", response_model=list[CustomerRead])
def list_customers(db: DbSession, _: CurrentUser, search: str | None = None) -> list[Customer]:
    query = db.query(Customer)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern), Customer.email.ilike(pattern))
        )
    return query.order_by(Customer.name).all()


@customers_router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: DbSession, _: CurrentUser) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@customers_router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(customer_id: int, payload: CustomerUpdate, db: DbSession, _: StaffUser) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@customers_router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: DbSession, _: StaffUser) -> None:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable")
    db.delete(customer)
    db.commit()


def _check_availability(
    db: DbSession, payload_vehicle: int, payload_driver: int, departure_at: datetime, trip_id: int | None
) -> tuple[Vehicle, Driver]:
    vehicle = db.get(Vehicle, payload_vehicle)
    driver = db.get(Driver, payload_driver)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    if vehicle.status != VehicleStatus.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ce véhicule n'est pas disponible (maintenance/hors service)"
        )
    if driver.status == DriverStatus.off_duty:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce chauffeur est hors service")

    window_start = departure_at - timedelta(hours=6)
    window_end = departure_at + timedelta(hours=6)
    clash = (
        db.query(Trip)
        .filter(
            Trip.status.in_([TripStatus.scheduled, TripStatus.in_progress]),
            Trip.departure_at.between(window_start, window_end),
            or_(Trip.vehicle_id == payload_vehicle, Trip.driver_id == payload_driver),
        )
        .filter(Trip.id != trip_id if trip_id else True)
        .first()
    )
    if clash is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflit de planning avec le voyage {clash.reference}",
        )
    return vehicle, driver


@trips_router.get("", response_model=list[TripRead])
def list_trips(
    db: DbSession,
    _: CurrentUser,
    trip_status: TripStatus | None = Query(default=None, alias="status"),
    route_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[TripRead]:
    query = db.query(Trip)
    if trip_status:
        query = query.filter(Trip.status == trip_status)
    if route_id:
        query = query.filter(Trip.route_id == route_id)
    if date_from:
        query = query.filter(Trip.departure_at >= date_from)
    if date_to:
        query = query.filter(Trip.departure_at <= date_to)
    return [trip_to_read(trip) for trip in query.order_by(Trip.departure_at.desc()).all()]


@trips_router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
def create_trip(payload: TripCreate, db: DbSession, _: StaffUser) -> TripRead:
    if db.get(Route, payload.route_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ligne introuvable")
    _check_availability(db, payload.vehicle_id, payload.driver_id, payload.departure_at, None)
    trip = Trip(**payload.model_dump(), reference=unique_reference(db, Trip, "reference", "TRP"))
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip_to_read(trip)


@trips_router.get("/{trip_id}", response_model=TripRead)
def get_trip(trip_id: int, db: DbSession, _: CurrentUser) -> TripRead:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    return trip_to_read(trip)


@trips_router.patch("/{trip_id}", response_model=TripRead)
def update_trip(trip_id: int, payload: TripUpdate, db: DbSession, _: StaffUser) -> TripRead:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    data = payload.model_dump(exclude_unset=True)
    if {"vehicle_id", "driver_id", "departure_at"} & data.keys():
        _check_availability(
            db,
            data.get("vehicle_id", trip.vehicle_id),
            data.get("driver_id", trip.driver_id),
            data.get("departure_at", trip.departure_at),
            trip.id,
        )
    for field, value in data.items():
        setattr(trip, field, value)

    if trip.status == TripStatus.in_progress:
        trip.driver.status = DriverStatus.on_trip
    elif trip.status in (TripStatus.completed, TripStatus.cancelled):
        trip.driver.status = DriverStatus.available
    db.commit()
    db.refresh(trip)
    return trip_to_read(trip)


@trips_router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, db: DbSession, _: StaffUser) -> None:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    if trip.bookings or trip.shipments:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce voyage a des réservations ou colis : annulez-le plutôt",
        )
    db.delete(trip)
    db.commit()
