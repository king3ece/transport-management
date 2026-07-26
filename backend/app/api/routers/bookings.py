"""Réservations de places (transport de personnes)."""

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, StaffUser
from app.models import Booking, BookingStatus, Customer, PaymentStatus, Trip, TripStatus
from app.schemas import BookingCreate, BookingRead, BookingUpdate
from app.services import ACTIVE_BOOKING_STATUSES, next_free_seat, seats_taken, unique_reference

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingRead])
def list_bookings(
    db: DbSession,
    _: CurrentUser,
    trip_id: int | None = None,
    booking_status: BookingStatus | None = Query(default=None, alias="status"),
    payment_status: PaymentStatus | None = None,
    search: str | None = None,
) -> list[Booking]:
    query = db.query(Booking)
    if trip_id:
        query = query.filter(Booking.trip_id == trip_id)
    if booking_status:
        query = query.filter(Booking.status == booking_status)
    if payment_status:
        query = query.filter(Booking.payment_status == payment_status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(Booking.passenger_name.ilike(pattern) | Booking.reference.ilike(pattern))
    return query.order_by(Booking.created_at.desc()).all()


@router.get("/trips/{trip_id}/seats", response_model=list[int])
def taken_seats(trip_id: int, db: DbSession, _: CurrentUser) -> list[int]:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    return sorted(b.seat_number for b in trip.bookings if b.status in ACTIVE_BOOKING_STATUSES)


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: DbSession, _: CurrentUser) -> Booking:
    trip = db.get(Trip, payload.trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voyage introuvable")
    if trip.status in (TripStatus.completed, TripStatus.cancelled):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce voyage n'accepte plus de réservation")
    if payload.customer_id is not None and db.get(Customer, payload.customer_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client introuvable")
    if seats_taken(trip) >= trip.vehicle.seat_capacity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Voyage complet")

    if payload.seat_number is None:
        seat = next_free_seat(trip)
    else:
        seat = payload.seat_number
        if seat < 1 or seat > trip.vehicle.seat_capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le siège doit être entre 1 et {trip.vehicle.seat_capacity}",
            )
        if any(b.seat_number == seat and b.status in ACTIVE_BOOKING_STATUSES for b in trip.bookings):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce siège est déjà réservé")

    booking = Booking(
        reference=unique_reference(db, Booking, "reference", "BKG"),
        trip_id=trip.id,
        customer_id=payload.customer_id,
        passenger_name=payload.passenger_name,
        passenger_phone=payload.passenger_phone,
        seat_number=seat,
        price=payload.price if payload.price is not None else trip.route.passenger_price,
        payment_status=payload.payment_status,
        status=BookingStatus.confirmed if payload.payment_status == PaymentStatus.paid else BookingStatus.pending,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: DbSession, _: CurrentUser) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Réservation introuvable")
    return booking


@router.patch("/{booking_id}", response_model=BookingRead)
def update_booking(booking_id: int, payload: BookingUpdate, db: DbSession, _: CurrentUser) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Réservation introuvable")
    data = payload.model_dump(exclude_unset=True)
    seat = data.get("seat_number")
    if seat is not None and seat != booking.seat_number:
        capacity = booking.trip.vehicle.seat_capacity
        if seat < 1 or seat > capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Le siège doit être entre 1 et {capacity}"
            )
        if any(
            b.seat_number == seat and b.id != booking.id and b.status in ACTIVE_BOOKING_STATUSES
            for b in booking.trip.bookings
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce siège est déjà réservé")
    for field, value in data.items():
        setattr(booking, field, value)
    if data.get("payment_status") == PaymentStatus.paid and booking.status == BookingStatus.pending:
        booking.status = BookingStatus.confirmed
    db.commit()
    db.refresh(booking)
    return booking


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: DbSession, _: StaffUser) -> None:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Réservation introuvable")
    db.delete(booking)
    db.commit()
