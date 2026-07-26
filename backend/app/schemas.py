from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    BookingStatus,
    CustomerKind,
    DriverStatus,
    MaintenanceKind,
    PaymentStatus,
    Role,
    ShipmentStatus,
    TripKind,
    TripStatus,
    VehicleKind,
    VehicleStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: Role = Role.client


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class UserRead(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime


# ---------- drivers ----------
class DriverBase(BaseModel):
    full_name: str
    phone: str
    license_number: str
    license_expiry: date
    status: DriverStatus = DriverStatus.available
    hire_date: date | None = None


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    license_number: str | None = None
    license_expiry: date | None = None
    status: DriverStatus | None = None
    hire_date: date | None = None


class DriverRead(ORMModel, DriverBase):
    id: int


# ---------- vehicles ----------
class VehicleBase(BaseModel):
    registration: str
    brand: str
    model: str
    kind: VehicleKind = VehicleKind.bus
    seat_capacity: int = 0
    cargo_capacity_kg: float = 0
    year: int | None = None
    odometer_km: float = 0
    status: VehicleStatus = VehicleStatus.active


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    registration: str | None = None
    brand: str | None = None
    model: str | None = None
    kind: VehicleKind | None = None
    seat_capacity: int | None = None
    cargo_capacity_kg: float | None = None
    year: int | None = None
    odometer_km: float | None = None
    status: VehicleStatus | None = None


class VehicleRead(ORMModel, VehicleBase):
    id: int


# ---------- maintenance ----------
class MaintenanceBase(BaseModel):
    vehicle_id: int
    kind: MaintenanceKind = MaintenanceKind.preventive
    performed_on: date
    description: str = ""
    cost: float = 0
    odometer_km: float | None = None
    next_due_on: date | None = None


class MaintenanceCreate(MaintenanceBase):
    pass


class MaintenanceUpdate(BaseModel):
    kind: MaintenanceKind | None = None
    performed_on: date | None = None
    description: str | None = None
    cost: float | None = None
    odometer_km: float | None = None
    next_due_on: date | None = None


class MaintenanceRead(ORMModel, MaintenanceBase):
    id: int
    vehicle: VehicleRead | None = None


# ---------- routes ----------
class RouteBase(BaseModel):
    code: str
    origin: str
    destination: str
    distance_km: float = 0
    duration_min: int = 0
    passenger_price: float = 0
    freight_price_per_kg: float = 0
    is_active: bool = True


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    code: str | None = None
    origin: str | None = None
    destination: str | None = None
    distance_km: float | None = None
    duration_min: int | None = None
    passenger_price: float | None = None
    freight_price_per_kg: float | None = None
    is_active: bool | None = None


class RouteRead(ORMModel, RouteBase):
    id: int


# ---------- customers ----------
class CustomerBase(BaseModel):
    name: str
    kind: CustomerKind = CustomerKind.individual
    phone: str = ""
    email: EmailStr | None = None
    address: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    kind: CustomerKind | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None


class CustomerRead(ORMModel, CustomerBase):
    id: int
    created_at: datetime


# ---------- trips ----------
class TripBase(BaseModel):
    route_id: int
    vehicle_id: int
    driver_id: int
    kind: TripKind = TripKind.passenger
    departure_at: datetime
    arrival_at: datetime | None = None
    notes: str | None = None


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    route_id: int | None = None
    vehicle_id: int | None = None
    driver_id: int | None = None
    kind: TripKind | None = None
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    status: TripStatus | None = None
    notes: str | None = None


class TripRead(ORMModel, TripBase):
    id: int
    reference: str
    status: TripStatus
    route: RouteRead | None = None
    vehicle: VehicleRead | None = None
    driver: DriverRead | None = None
    seats_taken: int = 0
    seats_available: int = 0
    cargo_loaded_kg: float = 0


# ---------- bookings ----------
class BookingCreate(BaseModel):
    trip_id: int
    passenger_name: str
    passenger_phone: str = ""
    customer_id: int | None = None
    seat_number: int | None = None
    price: float | None = None
    payment_status: PaymentStatus = PaymentStatus.unpaid


class BookingUpdate(BaseModel):
    passenger_name: str | None = None
    passenger_phone: str | None = None
    seat_number: int | None = None
    price: float | None = None
    status: BookingStatus | None = None
    payment_status: PaymentStatus | None = None


class BookingRead(ORMModel):
    id: int
    reference: str
    trip_id: int
    customer_id: int | None
    passenger_name: str
    passenger_phone: str
    seat_number: int
    price: float
    status: BookingStatus
    payment_status: PaymentStatus
    created_at: datetime
    trip: TripRead | None = None


# ---------- shipments ----------
class ShipmentCreate(BaseModel):
    sender_id: int
    recipient_name: str
    recipient_phone: str = ""
    origin: str
    destination: str
    description: str = ""
    weight_kg: float = Field(gt=0)
    declared_value: float = 0
    price: float | None = None
    trip_id: int | None = None
    payment_status: PaymentStatus = PaymentStatus.unpaid


class ShipmentUpdate(BaseModel):
    recipient_name: str | None = None
    recipient_phone: str | None = None
    origin: str | None = None
    destination: str | None = None
    description: str | None = None
    weight_kg: float | None = None
    declared_value: float | None = None
    price: float | None = None
    trip_id: int | None = None
    payment_status: PaymentStatus | None = None


class ShipmentEventRead(ORMModel):
    id: int
    status: ShipmentStatus
    location: str
    note: str
    occurred_at: datetime


class ShipmentEventCreate(BaseModel):
    status: ShipmentStatus
    location: str = ""
    note: str = ""


class ShipmentRead(ORMModel):
    id: int
    tracking_number: str
    trip_id: int | None
    sender_id: int
    sender: CustomerRead | None = None
    recipient_name: str
    recipient_phone: str
    origin: str
    destination: str
    description: str
    weight_kg: float
    declared_value: float
    price: float
    status: ShipmentStatus
    payment_status: PaymentStatus
    created_at: datetime
    delivered_at: datetime | None
    events: list[ShipmentEventRead] = []


# ---------- dashboard ----------
class RevenuePoint(BaseModel):
    label: str
    passenger_revenue: float
    freight_revenue: float


class DashboardStats(BaseModel):
    vehicles_total: int
    vehicles_active: int
    vehicles_in_maintenance: int
    drivers_total: int
    drivers_available: int
    routes_active: int
    trips_today: int
    trips_in_progress: int
    bookings_today: int
    shipments_in_transit: int
    revenue_passenger_month: float
    revenue_freight_month: float
    unpaid_amount: float
    fleet_occupancy_rate: float
    revenue_trend: list[RevenuePoint]
    upcoming_trips: list[TripRead]
    license_expiring_soon: list[DriverRead]
