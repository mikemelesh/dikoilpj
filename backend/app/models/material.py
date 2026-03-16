from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String
from sqlalchemy.orm import relationship

from backend.app.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    unit = Column(String, nullable=False)
    quantity = Column(Numeric, default=0.0, nullable=False)
    min_quantity = Column(Numeric, default=0.0, nullable=False)
    price_per_unit = Column(Numeric(10, 2), default=0.0, nullable=False)
    supplier = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requests = relationship("MaterialRequest", back_populates="material")

