from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from ..models.notification import Notification

MAX_NOTIFICATIONS_PER_USER = 30

ORDER_STATUS_LABELS = {
    "new": "Новый",
    "confirmed": "Подтверждён",
    "in_progress": "В работе",
    "review": "На проверке",
    "completed": "Завершён",
    "cancelled": "Отменён",
    "archived": "Архив",
}


def _status_label(status: str) -> str:
    return ORDER_STATUS_LABELS.get(status, status)


def trim_user_notifications(db: Session, recipient_id: UUID | str) -> None:
    """Keep at most MAX_NOTIFICATIONS_PER_USER; delete oldest."""
    excess = (
        db.query(Notification.id)
        .filter(Notification.recipient_id == recipient_id)
        .order_by(Notification.created_at.desc())
        .offset(MAX_NOTIFICATIONS_PER_USER)
        .all()
    )
    if not excess:
        return
    ids_to_delete = [row[0] for row in excess]
    db.query(Notification).filter(Notification.id.in_(ids_to_delete)).delete(synchronize_session=False)


def create_order_status_notification(
    db: Session,
    *,
    recipient_id: str,
    order_id: str,
    order_number: str,
    old_status: str,
    new_status: str,
    sender_id: Optional[str] = None,
) -> Optional[Notification]:
    if old_status == new_status:
        return None

    message = (
        f"Статус изменён «{_status_label(old_status)}» → «{_status_label(new_status)}»"
    )
    notification = Notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        title=f"Заказ {order_number}",
        message=message,
        notification_type="order_status",
        order_id=order_id,
        is_read=False,
    )
    db.add(notification)
    db.flush()
    trim_user_notifications(db, recipient_id)
    return notification
