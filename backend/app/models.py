from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    admin = "admin"
    dispatcher = "dispatcher"
    driver = "driver"
    client = "client"


class VehicleKind(str, enum.Enum):
    bus = "bus"
    minibus = "minibus"
    van = "van"
    truck = "truck"


class VehicleStatus(str, enum.Enum):
    active = "active"
    maintenance = "maintenance"
    out_of_service = "out_of_service"


class DriverStatus(str, enum.Enum):
    available = "available"
    on_trip = "on_trip"
    off_duty = "off_duty"


class TripKind(str, enum.Enum):
    passenger = "passenger"
    freight = "freight"
    mixed = "mixed"


class TripStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    boarded = "boarded"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    refunded = "refunded"


class ShipmentStatus(str, enum.Enum):
    registered = "registered"
    in_transit = "in_transit"
    arrived = "arrived"
    delivered = "delivered"
    cancelled = "cancelled"


class MaintenanceKind(str, enum.Enum):
    preventive = "preventive"
    corrective = "corrective"
    inspection = "inspection"


class CustomerKind(str, enum.Enum):
    individual = "individual"
    company = "company"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.client)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(40))
    license_number: Mapped[str] = mapped_column(String(60), unique=True)
    license_expiry: Mapped[date] = mapped_column(Date)
    status: Mapped[DriverStatus] = mapped_column(Enum(DriverStatus), default=DriverStatus.available)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    trips: Mapped[list[Trip]] = relationship(back_populates="driver")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    registration: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    brand: Mapped[str] = mapped_column(String(60))
    model: Mapped[str] = mapped_column(String(60))
    kind: Mapped[VehicleKind] = mapped_column(Enum(VehicleKind), default=VehicleKind.bus)
    seat_capacity: Mapped[int] = mapped_column(Integer, default=0)
    cargo_capacity_kg: Mapped[float] = mapped_column(Float, default=0)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    odometer_km: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[VehicleStatus] = mapped_column(Enum(VehicleStatus), default=VehicleStatus.active)

    trips: Mapped[list[Trip]] = relationship(back_populates="vehicle")
    maintenances: Mapped[list[Maintenance]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")


class Maintenance(Base):
    __tablename__ = "maintenances"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"))
    kind: Mapped[MaintenanceKind] = mapped_column(Enum(MaintenanceKind), default=MaintenanceKind.preventive)
    performed_on: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text, default="")
    cost: Mapped[float] = mapped_column(Float, default=0)
    odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    next_due_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    vehicle: Mapped[Vehicle] = relationship(back_populates="maintenances")


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    origin: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str] = mapped_column(String(120))
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    duration_min: Mapped[int] = mapped_column(Integer, default=0)
    passenger_price: Mapped[float] = mapped_column(Float, default=0)
    freight_price_per_kg: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    trips: Mapped[list[Trip]] = relationship(back_populates="route")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    kind: Mapped[CustomerKind] = mapped_column(Enum(CustomerKind), default=CustomerKind.individual)
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    kind: Mapped[TripKind] = mapped_column(Enum(TripKind), default=TripKind.passenger)
    departure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    arrival_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[TripStatus] = mapped_column(Enum(TripStatus), default=TripStatus.scheduled)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    route: Mapped[Route] = relationship(back_populates="trips")
    vehicle: Mapped[Vehicle] = relationship(back_populates="trips")
    driver: Mapped[Driver] = relationship(back_populates="trips")
    bookings: Mapped[list[Booking]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    shipments: Mapped[list[Shipment]] = relationship(back_populates="trip")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("trip_id", "seat_number", name="uq_booking_trip_seat"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    passenger_name: Mapped[str] = mapped_column(String(160))
    passenger_phone: Mapped[str] = mapped_column(String(40), default="")
    seat_number: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.unpaid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    trip: Mapped[Trip] = relationship(back_populates="bookings")
    customer: Mapped[Customer | None] = relationship()


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracking_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id"), nullable=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    recipient_name: Mapped[str] = mapped_column(String(160))
    recipient_phone: Mapped[str] = mapped_column(String(40), default="")
    origin: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    weight_kg: Mapped[float] = mapped_column(Float, default=0)
    declared_value: Mapped[float] = mapped_column(Float, default=0)
    price: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[ShipmentStatus] = mapped_column(Enum(ShipmentStatus), default=ShipmentStatus.registered)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.unpaid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    trip: Mapped[Trip | None] = relationship(back_populates="shipments")
    sender: Mapped[Customer] = relationship()
    events: Mapped[list[ShipmentEvent]] = relationship(
        back_populates="shipment", cascade="all, delete-orphan", order_by="ShipmentEvent.occurred_at"
    )


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"))
    status: Mapped[ShipmentStatus] = mapped_column(Enum(ShipmentStatus))
    location: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    shipment: Mapped[Shipment] = relationship(back_populates="events")
