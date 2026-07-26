export type Role = 'admin' | 'dispatcher' | 'driver' | 'client'
export type VehicleKind = 'bus' | 'minibus' | 'van' | 'truck'
export type VehicleStatus = 'active' | 'maintenance' | 'out_of_service'
export type DriverStatus = 'available' | 'on_trip' | 'off_duty'
export type TripKind = 'passenger' | 'freight' | 'mixed'
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type BookingStatus = 'pending' | 'confirmed' | 'boarded' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type ShipmentStatus = 'registered' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled'
export type MaintenanceKind = 'preventive' | 'corrective' | 'inspection'
export type CustomerKind = 'individual' | 'company'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface Vehicle {
  id: number
  registration: string
  brand: string
  model: string
  kind: VehicleKind
  seat_capacity: number
  cargo_capacity_kg: number
  year: number | null
  odometer_km: number
  status: VehicleStatus
}

export interface Driver {
  id: number
  full_name: string
  phone: string
  license_number: string
  license_expiry: string
  status: DriverStatus
  hire_date: string | null
}

export interface Maintenance {
  id: number
  vehicle_id: number
  kind: MaintenanceKind
  performed_on: string
  description: string
  cost: number
  odometer_km: number | null
  next_due_on: string | null
  vehicle: Vehicle | null
}

export interface Route {
  id: number
  code: string
  origin: string
  destination: string
  distance_km: number
  duration_min: number
  passenger_price: number
  freight_price_per_kg: number
  is_active: boolean
}

export interface Customer {
  id: number
  name: string
  kind: CustomerKind
  phone: string
  email: string | null
  address: string | null
  created_at: string
}

export interface Trip {
  id: number
  reference: string
  route_id: number
  vehicle_id: number
  driver_id: number
  kind: TripKind
  departure_at: string
  arrival_at: string | null
  status: TripStatus
  notes: string | null
  route: Route | null
  vehicle: Vehicle | null
  driver: Driver | null
  seats_taken: number
  seats_available: number
  cargo_loaded_kg: number
}

export interface Booking {
  id: number
  reference: string
  trip_id: number
  customer_id: number | null
  passenger_name: string
  passenger_phone: string
  seat_number: number
  price: number
  status: BookingStatus
  payment_status: PaymentStatus
  created_at: string
  trip: Trip | null
}

export interface ShipmentEvent {
  id: number
  status: ShipmentStatus
  location: string
  note: string
  occurred_at: string
}

export interface Shipment {
  id: number
  tracking_number: string
  trip_id: number | null
  sender_id: number
  sender: Customer | null
  recipient_name: string
  recipient_phone: string
  origin: string
  destination: string
  description: string
  weight_kg: number
  declared_value: number
  price: number
  status: ShipmentStatus
  payment_status: PaymentStatus
  created_at: string
  delivered_at: string | null
  events: ShipmentEvent[]
}

export interface RevenuePoint {
  label: string
  passenger_revenue: number
  freight_revenue: number
}

export interface DashboardStats {
  vehicles_total: number
  vehicles_active: number
  vehicles_in_maintenance: number
  drivers_total: number
  drivers_available: number
  routes_active: number
  trips_today: number
  trips_in_progress: number
  bookings_today: number
  shipments_in_transit: number
  revenue_passenger_month: number
  revenue_freight_month: number
  unpaid_amount: number
  fleet_occupancy_rate: number
  revenue_trend: RevenuePoint[]
  upcoming_trips: Trip[]
  license_expiring_soon: Driver[]
}
