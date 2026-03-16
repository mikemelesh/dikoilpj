# Импорт всех моделей из backend/app/models
from backend.app.models.user import User, UserRole, LoyaltyTier
from backend.app.models.client import Client
from backend.app.models.technician import Technician
from backend.app.models.service import Service, ServiceCategory
from backend.app.models.material import Material
from backend.app.models.order import (
    Order,
    OrderItem,
    OrderStatus,
    OrderPriority,
    OrderFile,
    OrderStatusHistory,
    MaterialRequest,
    MaterialRequestStatus,
)
from backend.app.models.review import Review
from backend.app.models.article import Article
from backend.app.models.promotion import Promotion, PromotionAppliesTo
from backend.app.models.knowledge import KnowledgeBase
from backend.app.models.logging import ActionLog

__all__ = [
    "User",
    "UserRole",
    "LoyaltyTier",
    "Client",
    "Technician",
    "ServiceCategory",
    "Service",
    "Material",
    "Order",
    "OrderItem",
    "OrderStatus",
    "OrderPriority",
    "OrderFile",
    "OrderStatusHistory",
    "MaterialRequest",
    "MaterialRequestStatus",
    "Review",
    "Article",
    "Promotion",
    "PromotionAppliesTo",
    "KnowledgeBase",
    "ActionLog",
]
