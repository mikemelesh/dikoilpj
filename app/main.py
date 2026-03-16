from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routes import auth, orders, pages, services, users
from app.core.config import settings
from app.db.session import Base, engine
from app.initial_data import init_db


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)

    application = FastAPI(title=settings.PROJECT_NAME)

    application.mount("/static", StaticFiles(directory="static"), name="static")

    application.include_router(auth.router)
    application.include_router(services.router)
    application.include_router(orders.router)
    application.include_router(users.router)
    application.include_router(pages.router)

    @application.on_event("startup")
    async def startup_event():
        init_db()

    return application


app = create_app()

