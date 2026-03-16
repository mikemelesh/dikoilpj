from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.app.database import Base
from backend.app.models.user import LoyaltyTier


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("users.id"), unique=True, nullable=False)

    clinic_name = Column(String, nullable=True)
    address = Column(String, nullable=True)

    discount_percent = Column(Float, default=0.0, nullable=False)
    total_orders = Column(Integer, default=0, nullable=False)
    loyalty_tier = Column(String, default=LoyaltyTier.BRONZE.value, nullable=False)

    user = relationship("User", back_populates="client_profile")
    orders = relationship("Order", back_populates="client")

