import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Добавляем корень проекта в path для импортов
project_root = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, project_root)

from backend.app.config import settings
from backend.app.database import Base

# Импортируем модели напрямую для Alembic
from backend.app.models.user import User, UserRole, LoyaltyTier  # noqa: F401
from backend.app.models.client import Client  # noqa: F401
from backend.app.models.technician import Technician  # noqa: F401
from backend.app.models.service import Service, ServiceCategory  # noqa: F401
from backend.app.models.material import Material  # noqa: F401
from backend.app.models.order import (  # noqa: F401
    Order,
    OrderItem,
    OrderStatus,
    OrderPriority,
    OrderFile,
    OrderStatusHistory,
    MaterialRequest,
    MaterialRequestStatus,
)
from backend.app.models.review import Review  # noqa: F401
from backend.app.models.article import Article  # noqa: F401
from backend.app.models.promotion import Promotion, PromotionAppliesTo  # noqa: F401
from backend.app.models.knowledge import KnowledgeBase  # noqa: F401
from backend.app.models.logging import ActionLog  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.SQLALCHEMY_DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.SQLALCHEMY_DATABASE_URL
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

