from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
from .client import Client

class OrderTemplate(Base):
    __tablename__ = 'order_templates'

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(ForeignKey('clients.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    items = Column(JSONB, nullable=False, default=list)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship('Client', back_populates='templates')

