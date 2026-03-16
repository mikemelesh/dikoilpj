from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from backend.app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(ForeignKey("clients.id"), nullable=False)
    order_id = Column(ForeignKey("orders.id"), nullable=True)

    rating = Column(Integer, nullable=False)  # 1-5
    text = Column(Text, nullable=True)
    is_moderated = Column(Boolean, default=False, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

