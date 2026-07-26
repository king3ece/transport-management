from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_login_rejects_bad_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "admin@transport.tg", "password": "wrong"}
    )
    assert response.status_code == 401


def test_protected_endpoint_requires_token(client: TestClient) -> None:
    assert client.get("/api/vehicles").status_code == 401


def test_client_role_cannot_create_vehicle(client: TestClient, client_headers: dict[str, str]) -> None:
    payload = {"registration": "TG-0000-ZZ", "brand": "Test", "model": "T", "seat_capacity": 10}
    assert client.post("/api/vehicles", json=payload, headers=client_headers).status_code == 403


def test_vehicle_crud(client: TestClient, admin_headers: dict[str, str]) -> None:
    payload = {
        "registration": "TG-4242-ZZ",
        "brand": "Hyundai",
        "model": "County",
        "kind": "minibus",
        "seat_capacity": 25,
        "cargo_capacity_kg": 500,
    }
    created = client.post("/api/vehicles", json=payload, headers=admin_headers)
    assert created.status_code == 201, created.text
    vehicle_id = created.json()["id"]

    assert client.post("/api/vehicles", json=payload, headers=admin_headers).status_code == 409

    patched = client.patch(
        f"/api/vehicles/{vehicle_id}", json={"status": "maintenance"}, headers=admin_headers
    )
    assert patched.json()["status"] == "maintenance"
    assert client.delete(f"/api/vehicles/{vehicle_id}", headers=admin_headers).status_code == 204


def test_dashboard_stats(client: TestClient, admin_headers: dict[str, str]) -> None:
    stats = client.get("/api/dashboard/stats", headers=admin_headers).json()
    assert stats["vehicles_total"] == 5
    assert stats["drivers_total"] == 4
    assert len(stats["revenue_trend"]) == 6
    assert stats["shipments_in_transit"] >= 1


def test_booking_seat_conflict_and_autoassign(client: TestClient, admin_headers: dict[str, str]) -> None:
    trips = client.get("/api/trips", params={"status": "scheduled"}, headers=admin_headers).json()
    trip = next(t for t in trips if t["seats_available"] > 1)

    first = client.post(
        "/api/bookings",
        json={"trip_id": trip["id"], "passenger_name": "Test Passager", "payment_status": "paid"},
        headers=admin_headers,
    )
    assert first.status_code == 201, first.text
    booking = first.json()
    assert booking["status"] == "confirmed"

    duplicate = client.post(
        "/api/bookings",
        json={
            "trip_id": trip["id"],
            "passenger_name": "Autre",
            "seat_number": booking["seat_number"],
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 409

    out_of_range = client.post(
        "/api/bookings",
        json={"trip_id": trip["id"], "passenger_name": "Autre", "seat_number": 9999},
        headers=admin_headers,
    )
    assert out_of_range.status_code == 400


def test_trip_scheduling_conflict(client: TestClient, admin_headers: dict[str, str]) -> None:
    existing = client.get("/api/trips", headers=admin_headers).json()[0]
    routes = client.get("/api/routes", headers=admin_headers).json()
    conflicting = client.post(
        "/api/trips",
        json={
            "route_id": routes[0]["id"],
            "vehicle_id": existing["vehicle_id"],
            "driver_id": existing["driver_id"],
            "departure_at": existing["departure_at"],
            "kind": "passenger",
        },
        headers=admin_headers,
    )
    assert conflicting.status_code == 409
    assert "Conflit" in conflicting.json()["detail"]


def test_trip_cannot_use_vehicle_in_maintenance(client: TestClient, admin_headers: dict[str, str]) -> None:
    vehicles = client.get("/api/vehicles", params={"status": "maintenance"}, headers=admin_headers).json()
    routes = client.get("/api/routes", headers=admin_headers).json()
    drivers = client.get("/api/drivers", params={"status": "available"}, headers=admin_headers).json()
    response = client.post(
        "/api/trips",
        json={
            "route_id": routes[0]["id"],
            "vehicle_id": vehicles[0]["id"],
            "driver_id": drivers[0]["id"],
            "departure_at": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(),
        },
        headers=admin_headers,
    )
    assert response.status_code == 409


def test_shipment_lifecycle_and_public_tracking(client: TestClient, admin_headers: dict[str, str]) -> None:
    customers = client.get("/api/customers", headers=admin_headers).json()
    created = client.post(
        "/api/shipments",
        json={
            "sender_id": customers[0]["id"],
            "recipient_name": "Destinataire Test",
            "origin": "Lomé",
            "destination": "Kara",
            "description": "Colis test",
            "weight_kg": 20,
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    shipment = created.json()
    assert shipment["price"] == 20 * 350
    assert shipment["status"] == "registered"

    updated = client.post(
        f"/api/shipments/{shipment['id']}/events",
        json={"status": "delivered", "location": "Kara", "note": "Remis"},
        headers=admin_headers,
    ).json()
    assert updated["status"] == "delivered"
    assert updated["delivered_at"] is not None
    assert len(updated["events"]) == 2

    tracked = client.get(f"/api/shipments/track/{shipment['tracking_number']}")
    assert tracked.status_code == 200
    assert tracked.json()["tracking_number"] == shipment["tracking_number"]
    assert client.get("/api/shipments/track/CLS-UNKNOWN").status_code == 404


def test_shipment_rejects_overloaded_trip(client: TestClient, admin_headers: dict[str, str]) -> None:
    customers = client.get("/api/customers", headers=admin_headers).json()
    trips = client.get("/api/trips", params={"status": "scheduled"}, headers=admin_headers).json()
    trip = trips[0]
    response = client.post(
        "/api/shipments",
        json={
            "sender_id": customers[0]["id"],
            "recipient_name": "Trop lourd",
            "origin": "Lomé",
            "destination": "Kara",
            "weight_kg": trip["vehicle"]["cargo_capacity_kg"] + 1000,
            "trip_id": trip["id"],
        },
        headers=admin_headers,
    )
    assert response.status_code == 409
    assert "Capacité" in response.json()["detail"]
