"""Domain helpers shared by the API routers."""

from __future__ import annotations

import random
import string

from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Shipment, ShipmentStatus, Trip
from app.schemas import TripRead


def generate_reference(prefix: str, length: int = 6) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=length))
    return f"{prefix}-{suffix}"


def unique_reference(db: Session, model: type, column: str, prefix: str) -> str:
    while True:
        candidate = generate_reference(prefix)
        exists = db.query(model).filter(getattr(model, column) == candidate).first()
        if exists is None:
            return candidate


ACTIVE_BOOKING_STATUSES = (BookingStatus.pending, BookingStatus.confirmed, BookingStatus.boarded)
LOADED_SHIPMENT_STATUSES = (
    ShipmentStatus.registered,
    ShipmentStatus.in_transit,
    ShipmentStatus.arrived,
    ShipmentStatus.delivered,
)


def seats_taken(trip: Trip) -> int:
    return sum(1 for booking in trip.bookings if booking.status in ACTIVE_BOOKING_STATUSES)


def cargo_loaded_kg(trip: Trip) -> float:
    return sum(s.weight_kg for s in trip.shipments if s.status in LOADED_SHIPMENT_STATUSES)


def next_free_seat(trip: Trip) -> int:
    used = {b.seat_number for b in trip.bookings if b.status in ACTIVE_BOOKING_STATUSES}
    for seat in range(1, trip.vehicle.seat_capacity + 1):
        if seat not in used:
            return seat
    raise ValueError("Aucun siège disponible sur ce voyage")


def trip_to_read(trip: Trip) -> TripRead:
    taken = seats_taken(trip)
    capacity = trip.vehicle.seat_capacity if trip.vehicle else 0
    data = TripRead.model_validate(trip)
    data.seats_taken = taken
    data.seats_available = max(capacity - taken, 0)
    data.cargo_loaded_kg = cargo_loaded_kg(trip)
    return data


def quote_shipment_price(weight_kg: float, freight_price_per_kg: float, minimum: float = 500.0) -> float:
    return max(round(weight_kg * freight_price_per_kg, 2), minimum)


def booking_amount(booking: Booking) -> float:
    return booking.price if booking.status != BookingStatus.cancelled else 0.0


def shipment_amount(shipment: Shipment) -> float:
    return shipment.price if shipment.status != ShipmentStatus.cancelled else 0.0
