from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, bookings, dashboard, fleet, network, shipments
from app.core.config import settings
from app.db.seed import seed
from app.db.session import SessionLocal, engine
from app.models import Base


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    auth.users_router,
    fleet.vehicles_router,
    fleet.drivers_router,
    fleet.maintenance_router,
    network.routes_router,
    network.customers_router,
    network.trips_router,
    bookings.router,
    shipments.router,
    dashboard.router,
):
    app.include_router(router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
