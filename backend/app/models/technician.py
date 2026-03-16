from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.app.database import Base


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(ForeignKey("users.id"), unique=True, nullable=False)

    specialization = Column(String, nullable=True)
    experience_years = Column(Integer, default=0, nullable=False)
    rating = Column(Float, default=0.0, nullable=False)
    completed_orders = Column(Integer, default=0, nullable=False)
    portfolio_description = Column(String, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="technician_profile")
    orders = relationship("Order", back_populates="technician")
    material_requests = relationship("MaterialRequest", back_populates="technician")

