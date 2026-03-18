import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..database import Base


class OrderStatus(str, PyEnum):
    NEW = "new"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class OrderPriority(str, PyEnum):
    NORMAL = "normal"
    URGENT = "urgent"
    CRITICAL = "critical"


class MaterialRequestStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ISSUED = "issued"


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String, unique=True, index=True, nullable=False)

    client_id = Column(ForeignKey("clients.id"), nullable=False)
    technician_id = Column(ForeignKey("technicians.id"), nullable=True)
    manager_id = Column(ForeignKey("users.id"), nullable=True)

    status = Column(Enum(OrderStatus), default=OrderStatus.NEW, nullable=False)
    priority = Column(Enum(OrderPriority), default=OrderPriority.NORMAL, nullable=False)

    total_price = Column(Numeric(10, 2), default=0.0, nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0, nullable=False)
    final_price = Column(Numeric(10, 2), default=0.0, nullable=False)

    notes = Column(Text, nullable=True)
    deadline = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="orders")
    technician = relationship("Technician", back_populates="orders")
    manager = relationship("User", back_populates="managed_orders", foreign_keys=[manager_id])

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    files = relationship("OrderFile", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship(
        "OrderStatusHistory", back_populates="order", cascade="all, delete-orphan"
    )
    reviews = relationship("Review", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(ForeignKey("orders.id"), nullable=False)
    service_id = Column(ForeignKey("services.id"), nullable=False)

    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    specifications = Column(JSONB, nullable=True)

    order = relationship("Order", back_populates="items")


class OrderFile(Base):
    __tablename__ = "order_files"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(ForeignKey("orders.id"), nullable=False)
    uploaded_by = Column(ForeignKey("users.id"), nullable=False)

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="files")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(ForeignKey("orders.id"), nullable=False)
    changed_by = Column(ForeignKey("users.id"), nullable=False)

    old_status = Column(Enum(OrderStatus), nullable=False)
    new_status = Column(Enum(OrderStatus), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="status_history")


class MaterialRequest(Base):
    __tablename__ = "material_requests"

    id = Column(Integer, primary_key=True, index=True)
    technician_id = Column(ForeignKey("technicians.id"), nullable=False)
    material_id = Column(ForeignKey("materials.id"), nullable=False)

    quantity_requested = Column(Numeric, nullable=False)
    status = Column(Enum(MaterialRequestStatus), default=MaterialRequestStatus.PENDING, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_by = Column(ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    technician = relationship("Technician", back_populates="material_requests")
    material = relationship("Material", back_populates="requests")
    resolver = relationship("User", foreign_keys=[resolved_by])

