from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func

from app.api.deps import CurrentUser, DbSession
from app.models import (
    Booking,
    BookingStatus,
    Driver,
    DriverStatus,
    PaymentStatus,
    Route,
    Shipment,
    ShipmentStatus,
    Trip,
    TripStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import DashboardStats, DriverRead, RevenuePoint
from app.services import trip_to_read

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


@router.get("/stats", response_model=DashboardStats)
def stats(db: DbSession, _: CurrentUser) -> DashboardStats:
    today = datetime.now(timezone.utc).date()
    day_start, day_end = _day_bounds(today)
    month_start = datetime.combine(today.replace(day=1), time.min, tzinfo=timezone.utc)

    vehicles_total = db.query(func.count(Vehicle.id)).scalar() or 0
    vehicles_active = db.query(func.count(Vehicle.id)).filter(Vehicle.status == VehicleStatus.active).scalar() or 0
    vehicles_maintenance = (
        db.query(func.count(Vehicle.id)).filter(Vehicle.status == VehicleStatus.maintenance).scalar() or 0
    )
    drivers_total = db.query(func.count(Driver.id)).scalar() or 0
    drivers_available = db.query(func.count(Driver.id)).filter(Driver.status == DriverStatus.available).scalar() or 0
    routes_active = db.query(func.count(Route.id)).filter(Route.is_active.is_(True)).scalar() or 0

    trips_today_q = db.query(Trip).filter(Trip.departure_at >= day_start, Trip.departure_at < day_end)
    trips_today = trips_today_q.count()
    trips_in_progress = db.query(func.count(Trip.id)).filter(Trip.status == TripStatus.in_progress).scalar() or 0

    bookings_today = (
        db.query(func.count(Booking.id)).filter(Booking.created_at >= day_start, Booking.created_at < day_end).scalar()
        or 0
    )
    shipments_in_transit = (
        db.query(func.count(Shipment.id)).filter(Shipment.status == ShipmentStatus.in_transit).scalar() or 0
    )

    revenue_passenger = (
        db.query(func.coalesce(func.sum(Booking.price), 0.0))
        .filter(
            Booking.created_at >= month_start,
            Booking.status != BookingStatus.cancelled,
            Booking.payment_status == PaymentStatus.paid,
        )
        .scalar()
        or 0.0
    )
    revenue_freight = (
        db.query(func.coalesce(func.sum(Shipment.price), 0.0))
        .filter(
            Shipment.created_at >= month_start,
            Shipment.status != ShipmentStatus.cancelled,
            Shipment.payment_status == PaymentStatus.paid,
        )
        .scalar()
        or 0.0
    )
    unpaid_bookings = (
        db.query(func.coalesce(func.sum(Booking.price), 0.0))
        .filter(Booking.payment_status == PaymentStatus.unpaid, Booking.status != BookingStatus.cancelled)
        .scalar()
        or 0.0
    )
    unpaid_shipments = (
        db.query(func.coalesce(func.sum(Shipment.price), 0.0))
        .filter(Shipment.payment_status == PaymentStatus.unpaid, Shipment.status != ShipmentStatus.cancelled)
        .scalar()
        or 0.0
    )

    trend: list[RevenuePoint] = []
    cursor = today.replace(day=1)
    months: list[date] = []
    for _offset in range(6):
        months.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    for first_day in reversed(months):
        start = datetime.combine(first_day, time.min, tzinfo=timezone.utc)
        next_month = (first_day + timedelta(days=32)).replace(day=1)
        end = datetime.combine(next_month, time.min, tzinfo=timezone.utc)
        passenger = (
            db.query(func.coalesce(func.sum(Booking.price), 0.0))
            .filter(
                Booking.created_at >= start,
                Booking.created_at < end,
                Booking.status != BookingStatus.cancelled,
            )
            .scalar()
            or 0.0
        )
        freight = (
            db.query(func.coalesce(func.sum(Shipment.price), 0.0))
            .filter(
                Shipment.created_at >= start,
                Shipment.created_at < end,
                Shipment.status != ShipmentStatus.cancelled,
            )
            .scalar()
            or 0.0
        )
        trend.append(
            RevenuePoint(
                label=f"{MONTH_LABELS[first_day.month - 1]} {first_day.year % 100:02d}",
                passenger_revenue=round(passenger, 2),
                freight_revenue=round(freight, 2),
            )
        )

    upcoming = (
        db.query(Trip)
        .filter(Trip.status.in_([TripStatus.scheduled, TripStatus.in_progress]))
        .order_by(Trip.departure_at)
        .limit(6)
        .all()
    )
    seats_capacity = sum(t.vehicle.seat_capacity for t in upcoming if t.vehicle)
    seats_used = sum(trip_to_read(t).seats_taken for t in upcoming)
    occupancy = round(seats_used / seats_capacity * 100, 1) if seats_capacity else 0.0

    expiring = (
        db.query(Driver)
        .filter(Driver.license_expiry <= today + timedelta(days=60))
        .order_by(Driver.license_expiry)
        .limit(5)
        .all()
    )

    return DashboardStats(
        vehicles_total=vehicles_total,
        vehicles_active=vehicles_active,
        vehicles_in_maintenance=vehicles_maintenance,
        drivers_total=drivers_total,
        drivers_available=drivers_available,
        routes_active=routes_active,
        trips_today=trips_today,
        trips_in_progress=trips_in_progress,
        bookings_today=bookings_today,
        shipments_in_transit=shipments_in_transit,
        revenue_passenger_month=round(revenue_passenger, 2),
        revenue_freight_month=round(revenue_freight, 2),
        unpaid_amount=round(unpaid_bookings + unpaid_shipments, 2),
        fleet_occupancy_rate=occupancy,
        revenue_trend=trend,
        upcoming_trips=[trip_to_read(t) for t in upcoming],
        license_expiring_soon=[DriverRead.model_validate(d) for d in expiring],
    )
