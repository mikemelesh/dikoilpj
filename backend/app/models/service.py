from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from backend.app.database import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon_url = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    services = relationship("Service", back_populates="category")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(ForeignKey("service_categories.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Numeric(10, 2), nullable=False)
    unit = Column(String, nullable=False)  # шт/этап/работа
    duration_days = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("ServiceCategory", back_populates="services")

