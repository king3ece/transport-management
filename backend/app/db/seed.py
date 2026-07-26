"""Jeu de données de démonstration."""

from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Booking,
    BookingStatus,
    Customer,
    CustomerKind,
    Driver,
    DriverStatus,
    Maintenance,
    MaintenanceKind,
    PaymentStatus,
    Role,
    Route,
    Shipment,
    ShipmentEvent,
    ShipmentStatus,
    Trip,
    TripKind,
    TripStatus,
    User,
    Vehicle,
    VehicleKind,
    VehicleStatus,
)
from app.services import quote_shipment_price

DEMO_USERS = [
    ("admin@transport.tg", "Admin Général", Role.admin, "Admin1234"),
    ("dispatch@transport.tg", "Awa Dispatch", Role.dispatcher, "Dispatch1234"),
    ("chauffeur@transport.tg", "Kodjo Chauffeur", Role.driver, "Driver1234"),
    ("client@transport.tg", "Client Démo", Role.client, "Client1234"),
]


def seed(db: Session) -> None:
    if db.query(User).count() > 0:
        return

    random.seed(42)
    for email, name, role, password in DEMO_USERS:
        db.add(User(email=email, full_name=name, role=role, hashed_password=hash_password(password)))

    vehicles = [
        Vehicle(
            registration="TG-1234-AB",
            brand="Mercedes",
            model="Sprinter",
            kind=VehicleKind.minibus,
            seat_capacity=18,
            cargo_capacity_kg=800,
            year=2021,
            odometer_km=142_000,
        ),
        Vehicle(
            registration="TG-5678-CD",
            brand="Scania",
            model="Touring",
            kind=VehicleKind.bus,
            seat_capacity=52,
            cargo_capacity_kg=2500,
            year=2019,
            odometer_km=310_500,
        ),
        Vehicle(
            registration="TG-9012-EF",
            brand="Toyota",
            model="Hiace",
            kind=VehicleKind.van,
            seat_capacity=14,
            cargo_capacity_kg=1200,
            year=2022,
            odometer_km=64_300,
        ),
        Vehicle(
            registration="TG-3456-GH",
            brand="Renault",
            model="Trucks D",
            kind=VehicleKind.truck,
            seat_capacity=2,
            cargo_capacity_kg=9000,
            year=2020,
            odometer_km=201_000,
        ),
        Vehicle(
            registration="TG-7890-IJ",
            brand="Iveco",
            model="Crossway",
            kind=VehicleKind.bus,
            seat_capacity=45,
            cargo_capacity_kg=1800,
            year=2018,
            odometer_km=402_100,
            status=VehicleStatus.maintenance,
        ),
    ]
    drivers = [
        Driver(
            full_name="Kodjo Mensah",
            phone="+228 90 11 22 33",
            license_number="TG-DL-00121",
            license_expiry=date.today() + timedelta(days=400),
            hire_date=date(2019, 3, 1),
        ),
        Driver(
            full_name="Ama Doe",
            phone="+228 91 44 55 66",
            license_number="TG-DL-00234",
            license_expiry=date.today() + timedelta(days=45),
            hire_date=date(2020, 7, 15),
        ),
        Driver(
            full_name="Yao Kponton",
            phone="+228 92 77 88 99",
            license_number="TG-DL-00345",
            license_expiry=date.today() + timedelta(days=210),
            hire_date=date(2021, 1, 5),
        ),
        Driver(
            full_name="Fatou Bakayoko",
            phone="+228 93 10 20 30",
            license_number="TG-DL-00456",
            license_expiry=date.today() + timedelta(days=730),
            hire_date=date(2022, 9, 12),
            status=DriverStatus.off_duty,
        ),
    ]
    routes = [
        Route(
            code="LOM-KAR",
            origin="Lomé",
            destination="Kara",
            distance_km=413,
            duration_min=420,
            passenger_price=9000,
            freight_price_per_kg=350,
        ),
        Route(
            code="LOM-ATK",
            origin="Lomé",
            destination="Atakpamé",
            distance_km=161,
            duration_min=180,
            passenger_price=4500,
            freight_price_per_kg=200,
        ),
        Route(
            code="LOM-SOK",
            origin="Lomé",
            destination="Sokodé",
            distance_km=339,
            duration_min=360,
            passenger_price=7500,
            freight_price_per_kg=300,
        ),
        Route(
            code="KAR-DAP",
            origin="Kara",
            destination="Dapaong",
            distance_km=200,
            duration_min=210,
            passenger_price=5000,
            freight_price_per_kg=250,
        ),
    ]
    customers = [
        Customer(
            name="Société AGRO-TOGO",
            kind=CustomerKind.company,
            phone="+228 22 21 30 40",
            email="contact@agrotogo.tg",
            address="Zone industrielle, Lomé",
        ),
        Customer(
            name="Ibrahim Traoré", phone="+228 90 55 44 33", email="ibrahim@example.com", address="Bè-Kpota, Lomé"
        ),
        Customer(
            name="Pharmacie du Nord",
            kind=CustomerKind.company,
            phone="+228 26 60 10 10",
            email="pharma.nord@example.com",
            address="Kara centre",
        ),
        Customer(name="Adjo Kossi", phone="+228 98 12 34 56", email="adjo.kossi@example.com"),
    ]
    db.add_all(vehicles + drivers + routes + customers)
    db.flush()

    db.add_all(
        [
            Maintenance(
                vehicle_id=vehicles[1].id,
                kind=MaintenanceKind.preventive,
                performed_on=date.today() - timedelta(days=40),
                description="Vidange + filtres",
                cost=185_000,
                odometer_km=305_000,
                next_due_on=date.today() + timedelta(days=50),
            ),
            Maintenance(
                vehicle_id=vehicles[4].id,
                kind=MaintenanceKind.corrective,
                performed_on=date.today() - timedelta(days=3),
                description="Remplacement embrayage",
                cost=920_000,
                odometer_km=402_100,
            ),
            Maintenance(
                vehicle_id=vehicles[0].id,
                kind=MaintenanceKind.inspection,
                performed_on=date.today() - timedelta(days=15),
                description="Visite technique annuelle",
                cost=45_000,
                odometer_km=140_500,
                next_due_on=date.today() + timedelta(days=350),
            ),
        ]
    )

    now = datetime.now(timezone.utc)
    today_midnight = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    trips: list[Trip] = []
    plan = [
        (0, routes[0], vehicles[1], drivers[0], TripKind.mixed, 6, TripStatus.in_progress),
        (0, routes[1], vehicles[0], drivers[1], TripKind.passenger, 14, TripStatus.scheduled),
        (1, routes[2], vehicles[2], drivers[2], TripKind.mixed, 7, TripStatus.scheduled),
        (2, routes[3], vehicles[3], drivers[0], TripKind.freight, 5, TripStatus.scheduled),
        (-3, routes[0], vehicles[1], drivers[2], TripKind.passenger, 6, TripStatus.completed),
        (-10, routes[2], vehicles[0], drivers[1], TripKind.mixed, 8, TripStatus.completed),
        (-25, routes[1], vehicles[2], drivers[0], TripKind.passenger, 9, TripStatus.completed),
    ]
    for index, (day_offset, route, vehicle, driver, kind, hour, trip_status) in enumerate(plan, start=1):
        departure = today_midnight + timedelta(days=day_offset, hours=hour)
        trips.append(
            Trip(
                reference=f"TRP-{1000 + index}",
                route_id=route.id,
                vehicle_id=vehicle.id,
                driver_id=driver.id,
                kind=kind,
                departure_at=departure,
                arrival_at=departure + timedelta(minutes=route.duration_min),
                status=trip_status,
            )
        )
    db.add_all(trips)
    db.flush()

    passenger_names = [
        "Kossi Adade",
        "Marie Lawson",
        "Paul Agbeko",
        "Sylvie Amah",
        "Jean Kpodar",
        "Nadia Sow",
        "Franck Amenyo",
        "Grace Doe",
        "Moussa Diallo",
        "Elodie Kanto",
    ]
    booking_seq = 0
    for trip in trips:
        if trip.kind == TripKind.freight:
            continue
        capacity = min(trip.vehicle.seat_capacity, 12)
        for seat in range(1, random.randint(4, capacity) + 1):
            booking_seq += 1
            paid = random.random() < 0.75
            db.add(
                Booking(
                    reference=f"BKG-{2000 + booking_seq}",
                    trip_id=trip.id,
                    customer_id=random.choice(customers).id if random.random() < 0.4 else None,
                    passenger_name=random.choice(passenger_names),
                    passenger_phone="+228 90 00 00 00",
                    seat_number=seat,
                    price=trip.route.passenger_price,
                    status=BookingStatus.boarded
                    if trip.status == TripStatus.completed
                    else (BookingStatus.confirmed if paid else BookingStatus.pending),
                    payment_status=PaymentStatus.paid if paid else PaymentStatus.unpaid,
                    created_at=trip.departure_at - timedelta(days=random.randint(1, 5)),
                )
            )

    freight_plan = [
        (customers[0], "Cartons de tomates", 450.0, routes[0], ShipmentStatus.in_transit, trips[0]),
        (customers[2], "Médicaments (colis scellé)", 60.0, routes[0], ShipmentStatus.registered, trips[2]),
        (customers[1], "Pièces détachées moto", 120.0, routes[1], ShipmentStatus.delivered, trips[5]),
        (customers[3], "Effets personnels", 35.0, routes[2], ShipmentStatus.arrived, trips[4]),
        (customers[0], "Sacs de maïs", 2400.0, routes[3], ShipmentStatus.in_transit, trips[3]),
    ]
    for index, (sender, description, weight, route, shipment_status, trip) in enumerate(freight_plan, start=1):
        created = now - timedelta(days=random.randint(1, 40))
        shipment = Shipment(
            tracking_number=f"CLS-{3000 + index}",
            trip_id=trip.id,
            sender_id=sender.id,
            recipient_name=random.choice(passenger_names),
            recipient_phone="+228 99 00 11 22",
            origin=route.origin,
            destination=route.destination,
            description=description,
            weight_kg=weight,
            declared_value=weight * 1500,
            price=quote_shipment_price(weight, route.freight_price_per_kg),
            status=shipment_status,
            payment_status=PaymentStatus.paid if shipment_status != ShipmentStatus.registered else PaymentStatus.unpaid,
            created_at=created,
            delivered_at=created + timedelta(days=2) if shipment_status == ShipmentStatus.delivered else None,
        )
        shipment.events.append(
            ShipmentEvent(
                status=ShipmentStatus.registered,
                location=route.origin,
                note="Colis enregistré à l'agence",
                occurred_at=created,
            )
        )
        if shipment_status != ShipmentStatus.registered:
            shipment.events.append(
                ShipmentEvent(
                    status=ShipmentStatus.in_transit,
                    location=route.origin,
                    note="Chargé et en route",
                    occurred_at=created + timedelta(hours=6),
                )
            )
        if shipment_status in (ShipmentStatus.arrived, ShipmentStatus.delivered):
            shipment.events.append(
                ShipmentEvent(
                    status=ShipmentStatus.arrived,
                    location=route.destination,
                    note="Arrivé à l'agence de destination",
                    occurred_at=created + timedelta(days=1),
                )
            )
        if shipment_status == ShipmentStatus.delivered:
            shipment.events.append(
                ShipmentEvent(
                    status=ShipmentStatus.delivered,
                    location=route.destination,
                    note="Retiré par le destinataire",
                    occurred_at=created + timedelta(days=2),
                )
            )
        db.add(shipment)

    db.commit()
