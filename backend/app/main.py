import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем .env файл перед импортом settings
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import settings
from .database import Base, engine
from .dependencies.auth import limiter
from .models import *  # noqa: F401,F403  - ensure models are imported for Alembic
from .routers import admin as admin_router
from .routers import analytics as analytics_router
from .routers import articles as articles_router
from .routers import auth as auth_router
from .routers import calculator as calculator_router
from .routers import clients as clients_router
from .routers import knowledge_base as knowledge_base_router
from .routers import materials as materials_router
from .routers import orders as orders_router
from .routers import promotions as promotions_router
from .routers import reviews as reviews_router
from .routers import services as services_router
from .routers import technicians as technicians_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="API для управления зуботехнической лабораторией",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting middleware
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # Подключаем роутеры с префиксом /api
    app.include_router(auth_router.router, prefix="/api")
    app.include_router(calculator_router.router, prefix="/api")
    app.include_router(clients_router.router, prefix="/api")
    app.include_router(materials_router.router, prefix="/api")
    app.include_router(orders_router.router, prefix="/api")
    app.include_router(services_router.router, prefix="/api")
    app.include_router(technicians_router.router, prefix="/api")
    # Вторичные роутеры
    app.include_router(reviews_router.router, prefix="/api")
    app.include_router(articles_router.router, prefix="/api")
    app.include_router(promotions_router.router, prefix="/api")
    app.include_router(knowledge_base_router.router, prefix="/api")
    app.include_router(analytics_router.router, prefix="/api")
    app.include_router(admin_router.router, prefix="/api")

    # Обработчик превышения лимита
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    return app


app = create_app()

