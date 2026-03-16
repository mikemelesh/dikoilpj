from datetime import date
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, Date, Enum, Float, Integer, String

from backend.app.database import Base


class PromotionAppliesTo(str, PyEnum):
    ALL = "all"
    SERVICE = "service"
    CATEGORY = "category"


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    discount_percent = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    applies_to = Column(Enum(PromotionAppliesTo), default=PromotionAppliesTo.ALL, nullable=False)
    target_id = Column(Integer, nullable=True)

