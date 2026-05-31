from sqlalchemy import Column, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from ..database import Base
from .user import LoyaltyTier
from enum import Enum as PyEnum


class ClientType(str, PyEnum):
    physical = "physical"
    legal = "legal"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("users.id"), unique=True, nullable=False)

    clinic_name = Column(String, nullable=True)
    address = Column(String, nullable=True)

    discount_percent = Column(Float, default=0.0, nullable=False)
    total_orders = Column(Integer, default=0, nullable=False)
    loyalty_tier = Column(String, default=LoyaltyTier.BRONZE.value, nullable=False)
    client_type = Column(Enum(ClientType, native_enum=False), default=ClientType.physical, nullable=False)

    user = relationship("User", back_populates="client_profile")
    orders = relationship("Order", back_populates="client")
    reviews = relationship("Review", back_populates="client")
    templates = relationship("OrderTemplate", back_populates="client", cascade="all, delete-orphan")

