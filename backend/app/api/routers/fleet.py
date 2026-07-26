"""Vehicles, maintenance records and drivers."""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_

from app.api.deps import CurrentUser, DbSession, StaffUser
from app.models import Driver, DriverStatus, Maintenance, Vehicle, VehicleStatus
from app.schemas import (
    DriverCreate,
    DriverRead,
    DriverUpdate,
    MaintenanceCreate,
    MaintenanceRead,
    MaintenanceUpdate,
    VehicleCreate,
    VehicleRead,
    VehicleUpdate,
)

vehicles_router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])
drivers_router = APIRouter(prefix="/api/drivers", tags=["drivers"])
maintenance_router = APIRouter(prefix="/api/maintenances", tags=["maintenances"])


@vehicles_router.get("", response_model=list[VehicleRead])
def list_vehicles(
    db: DbSession,
    _: CurrentUser,
    search: str | None = None,
    vehicle_status: VehicleStatus | None = Query(default=None, alias="status"),
) -> list[Vehicle]:
    query = db.query(Vehicle)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Vehicle.registration.ilike(pattern), Vehicle.brand.ilike(pattern), Vehicle.model.ilike(pattern))
        )
    if vehicle_status:
        query = query.filter(Vehicle.status == vehicle_status)
    return query.order_by(Vehicle.registration).all()


@vehicles_router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, db: DbSession, _: StaffUser) -> Vehicle:
    if db.query(Vehicle).filter(Vehicle.registration == payload.registration).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Immatriculation déjà enregistrée")
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@vehicles_router.get("/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(vehicle_id: int, db: DbSession, _: CurrentUser) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    return vehicle


@vehicles_router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: DbSession, _: StaffUser) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@vehicles_router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: DbSession, _: StaffUser) -> None:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    if vehicle.trips:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce véhicule est rattaché à des voyages : changez plutôt son statut",
        )
    db.delete(vehicle)
    db.commit()


@maintenance_router.get("", response_model=list[MaintenanceRead])
def list_maintenances(db: DbSession, _: CurrentUser, vehicle_id: int | None = None) -> list[Maintenance]:
    query = db.query(Maintenance)
    if vehicle_id:
        query = query.filter(Maintenance.vehicle_id == vehicle_id)
    return query.order_by(Maintenance.performed_on.desc()).all()


@maintenance_router.post("", response_model=MaintenanceRead, status_code=status.HTTP_201_CREATED)
def create_maintenance(payload: MaintenanceCreate, db: DbSession, _: StaffUser) -> Maintenance:
    vehicle = db.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Véhicule introuvable")
    record = Maintenance(**payload.model_dump())
    if record.odometer_km and record.odometer_km > vehicle.odometer_km:
        vehicle.odometer_km = record.odometer_km
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@maintenance_router.patch("/{maintenance_id}", response_model=MaintenanceRead)
def update_maintenance(maintenance_id: int, payload: MaintenanceUpdate, db: DbSession, _: StaffUser) -> Maintenance:
    record = db.get(Maintenance, maintenance_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intervention introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@maintenance_router.delete("/{maintenance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance(maintenance_id: int, db: DbSession, _: StaffUser) -> None:
    record = db.get(Maintenance, maintenance_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intervention introuvable")
    db.delete(record)
    db.commit()


@drivers_router.get("", response_model=list[DriverRead])
def list_drivers(
    db: DbSession,
    _: CurrentUser,
    search: str | None = None,
    driver_status: DriverStatus | None = Query(default=None, alias="status"),
    license_expiring_days: int | None = None,
) -> list[Driver]:
    query = db.query(Driver)
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Driver.full_name.ilike(pattern), Driver.phone.ilike(pattern)))
    if driver_status:
        query = query.filter(Driver.status == driver_status)
    if license_expiring_days is not None:
        query = query.filter(Driver.license_expiry <= date.today() + timedelta(days=license_expiring_days))
    return query.order_by(Driver.full_name).all()


@drivers_router.post("", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
def create_driver(payload: DriverCreate, db: DbSession, _: StaffUser) -> Driver:
    if db.query(Driver).filter(Driver.license_number == payload.license_number).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Numéro de permis déjà enregistré")
    driver = Driver(**payload.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@drivers_router.get("/{driver_id}", response_model=DriverRead)
def get_driver(driver_id: int, db: DbSession, _: CurrentUser) -> Driver:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    return driver


@drivers_router.patch("/{driver_id}", response_model=DriverRead)
def update_driver(driver_id: int, payload: DriverUpdate, db: DbSession, _: StaffUser) -> Driver:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return driver


@drivers_router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(driver_id: int, db: DbSession, _: StaffUser) -> None:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chauffeur introuvable")
    if driver.trips:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce chauffeur est rattaché à des voyages : passez-le plutôt hors service",
        )
    db.delete(driver)
    db.commit()
