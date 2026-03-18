import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class UserRole(str, PyEnum):
    GUEST = "guest"
    CLIENT = "client"
    TECHNICIAN = "technician"
    MANAGER = "manager"
    ADMIN = "admin"


class LoyaltyTier(str, PyEnum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CLIENT)

    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    loyalty_points = Column(Integer, default=0, nullable=False)

    client_profile = relationship("Client", back_populates="user", uselist=False)
    technician_profile = relationship("Technician", back_populates="user", uselist=False)
    managed_orders = relationship("Order", back_populates="manager", foreign_keys="Order.manager_id")
    action_logs = relationship("ActionLog", back_populates="user")

