"""
Pydantic схемы для вторичных роутеров.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Отзывы (Reviews)
# =============================================================================


class ReviewCreate(BaseModel):
    """Создание отзыва."""
    rating: int = Field(..., ge=1, le=5, description="Рейтинг (1-5)")
    text: Optional[str] = Field(None, max_length=2000, description="Текст отзыва")
    order_id: Optional[str] = Field(None, description="ID заказа (optional)")


class ReviewResponse(BaseModel):
    """Ответ отзыва."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: Optional[str] = None
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    rating: int
    text: Optional[str]
    is_moderated: bool
    is_published: bool
    created_at: datetime


class ReviewListResponse(BaseModel):
    """Список отзывов."""
    items: List[ReviewResponse]
    total: int
    page: int
    limit: int
    pages: int


class ReviewModerateRequest(BaseModel):
    """Модерация отзыва."""
    is_published: bool = Field(..., description="Опубликовать или нет")


# =============================================================================
# Статьи (Articles)
# =============================================================================


class ArticleCreate(BaseModel):
    """Создание статьи."""
    title: str = Field(..., min_length=1, max_length=300, description="Заголовок")
    slug: str = Field(..., min_length=1, max_length=300, description="URL-слаг")
    content: str = Field(..., min_length=1, description="Содержимое")
    category: Optional[str] = Field(None, max_length=100, description="Категория")
    is_published: bool = Field(default=False, description="Опубликовано")


class ArticleUpdate(BaseModel):
    """Обновление статьи."""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    is_published: Optional[bool] = None


class ArticleResponse(BaseModel):
    """Ответ статьи."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    content: str
    category: Optional[str]
    author_id: str
    author_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class ArticleListResponse(BaseModel):
    """Список статей."""
    items: List[ArticleResponse]
    total: int
    page: int
    limit: int
    pages: int


# =============================================================================
# Акции (Promotions)
# =============================================================================


class PromotionCreate(BaseModel):
    """Создание акции."""
    title: str = Field(..., min_length=1, max_length=200, description="Название")
    description: Optional[str] = Field(None, max_length=1000, description="Описание")
    discount_percent: float = Field(..., ge=0, le=100, description="Процент скидки")
    start_date: date = Field(..., description="Дата начала")
    end_date: date = Field(..., description="Дата окончания")
    is_active: bool = Field(default=True, description="Активна")
    applies_to: str = Field(default="all", description="Применяется к (all/service/category)")
    target_id: Optional[int] = Field(None, ge=0, description="Целевой ID")


class PromotionUpdate(BaseModel):
    """Обновление акции."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    applies_to: Optional[str] = None
    target_id: Optional[int] = None


class PromotionResponse(BaseModel):
    """Ответ акции."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    discount_percent: float
    start_date: date
    end_date: date
    is_active: bool
    applies_to: str
    target_id: Optional[int]


class PromotionListResponse(BaseModel):
    """Список акций."""
    items: List[PromotionResponse]
    total: int


# =============================================================================
# База знаний (Knowledge Base)
# =============================================================================


class KnowledgeBaseCreate(BaseModel):
    """Создание записи БЗ."""
    title: str = Field(..., min_length=1, max_length=300, description="Заголовок")
    content: str = Field(..., min_length=1, description="Содержимое")
    category: Optional[str] = Field(None, max_length=100, description="Категория")
    tags: Optional[List[str]] = Field(None, description="Теги")
    is_published: bool = Field(default=True, description="Опубликовано")


class KnowledgeBaseUpdate(BaseModel):
    """Обновление записи БЗ."""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None


class KnowledgeBaseResponse(BaseModel):
    """Ответ записи БЗ."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    category: Optional[str]
    tags: Optional[List[str]]
    created_by: str
    author_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseListResponse(BaseModel):
    """Список записей БЗ."""
    items: List[KnowledgeBaseResponse]
    total: int
    page: int
    limit: int
    pages: int


# =============================================================================
# Аналитика (Analytics)
# =============================================================================


class OrderAnalyticsResponse(BaseModel):
    """Аналитика заказов."""
    total: int
    by_status: Dict[str, int]
    by_priority: Dict[str, int]
    avg_completion_days: Optional[float] = None


class RevenueByPeriod(BaseModel):
    """Доход по периодам."""
    date: str
    amount: float


class RevenueByCategory(BaseModel):
    """Доход по категориям."""
    category_id: int
    category_name: str
    total: float


class RevenueAnalyticsResponse(BaseModel):
    """Аналитика доходов."""
    total: float
    by_period: List[RevenueByPeriod]
    by_service_category: List[RevenueByCategory]


class TechnicianAnalyticsItem(BaseModel):
    """Аналитика по технику."""
    technician_id: int
    technician_name: str
    completed: int
    avg_days: Optional[float] = None
    rating: float
    on_time_percent: float


class TechnicianAnalyticsResponse(BaseModel):
    """Аналитика техников."""
    items: List[TechnicianAnalyticsItem]
    total: int


class UserAnalyticsResponse(BaseModel):
    """Аналитика пользователей."""
    total: int
    by_role: Dict[str, int]
    active: int


# =============================================================================
# Админ (Admin)
# =============================================================================


class ActionLogResponse(BaseModel):
    """Ответ лога действий."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action_type: str
    entity_type: str
    entity_id: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


class ActionLogListResponse(BaseModel):
    """Список логов."""
    items: List[ActionLogResponse]
    total: int
    page: int
    limit: int
    pages: int


class UserSummaryResponse(BaseModel):
    """Краткая информация о пользователе."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime


class UserListResponse(BaseModel):
    """Список пользователей."""
    items: List[UserSummaryResponse]
    total: int
    page: int
    limit: int
    pages: int


class UserRoleUpdate(BaseModel):
    """Обновление роли пользователя."""
    role: str = Field(..., description="Новая роль")


class UserStatusUpdate(BaseModel):
    """Обновление статуса пользователя."""
    is_active: bool = Field(..., description="Активен/неактивен")


class BackupResponse(BaseModel):
    """Ответ бэкапа."""
    filename: str
    size: int
    created_at: datetime


class BackupRestoreResponse(BaseModel):
    """Ответ восстановления из бэкапа."""
    filename: str
    message: str
    restored_at: datetime
