"""Русские подписи и форматирование значений для экспорта отчётов."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Mapping, Optional

COLUMN_LABELS_RU: Dict[str, str] = {
    "order_number": "№ заказа",
    "status": "Статус",
    "priority": "Приоритет",
    "client_name": "Клиент",
    "technician_name": "Исполнитель",
    "manager_name": "Менеджер",
    "total_price": "Сумма, BYN",
    "discount_amount": "Скидка, BYN",
    "final_price": "Итого, BYN",
    "deadline": "Дедлайн",
    "created_at": "Дата создания",
    "completed_at": "Дата завершения",
    "clinic_name": "Клиника",
    "email": "Email",
    "phone": "Телефон",
    "total_orders": "Заказов",
    "total_paid": "Оплачено, BYN",
    "total_earned": "Сумма работ, BYN",
    "avg_order_value": "Средний чек, BYN",
    "completed_orders": "Завершено",
    "active_orders": "В работе",
    "earliest_deadline": "Ближайший дедлайн",
    "latest_deadline": "Последний дедлайн",
    "first_name": "Имя",
    "last_name": "Фамилия",
    "address": "Адрес",
    "loyalty_tier": "Уровень лояльности",
    "discount_percent": "Скидка, %",
    "loyalty_points": "Баллы лояльности",
    "specialization": "Специализация",
    "experience_years": "Стаж, лет",
    "rating": "Рейтинг",
    "is_available": "Доступен",
    "material_name": "Материал",
    "quantity_requested": "Запрошено",
    "comment": "Комментарий",
    "id": "ID",
    "role": "Роль",
    "is_active": "Активен",
    "updated_at": "Обновлён",
    "question": "Вопрос",
    "answer": "Ответ",
    "category": "Категория",
    "sort_order": "Порядок",
    "is_published": "Опубликовано",
    "order_id": "ID заказа",
    "text": "Текст",
    "is_moderated": "Промодерировано",
    "title": "Название",
    "slug": "URL-адрес",
}

DATE_RANGE_LABEL_RU = "Период (дата создания)"
REPORT_GENERATED_LABEL_RU = "Дата формирования"
REPORT_AUTHOR_LABEL_RU = "Сформировал"
FILTERS_SECTION_TITLE_RU = "Параметры отчёта"

FILTER_LABELS_RU: Dict[str, str] = {
    "status": "Статус",
    "priority": "Приоритет",
    "client_id": "ID клиента",
    "technician_id": "ID исполнителя",
    "search": "Поиск",
    "role": "Роль",
    "is_active": "Активность",
    "is_published": "Публикация",
    "is_moderated": "Модерация",
    "category": "Категория",
    "available_only": "Только доступные",
}

STATUS_LABELS_RU = {
    "new": "Новый",
    "confirmed": "Подтверждён",
    "in_progress": "В работе",
    "review": "На проверке",
    "completed": "Завершён",
    "cancelled": "Отменён",
    "archived": "Архив",
    "pending": "Ожидает",
    "approved": "Одобрено",
    "rejected": "Отклонено",
    "issued": "Выдано",
}

PRIORITY_LABELS_RU = {
    "normal": "Обычный",
    "urgent": "Срочный",
    "critical": "Критичный",
}

ROLE_LABELS_RU = {
    "guest": "Гость",
    "client": "Клиент",
    "technician": "Исполнитель",
    "manager": "Менеджер",
    "admin": "Администратор",
}

LOYALTY_LABELS_RU = {
    "bronze": "Бронза",
    "silver": "Серебро",
    "gold": "Золото",
    "platinum": "Платина",
}

BOOL_LABELS_RU = {
    True: "Да",
    False: "Нет",
    "true": "Да",
    "false": "Нет",
}


def format_export_date(value: Any) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    if isinstance(value, date):
        return value.strftime("%d.%m.%Y")
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return "—"
        try:
            if "T" in raw:
                return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d.%m.%Y %H:%M")
            return datetime.fromisoformat(raw).strftime("%d.%m.%Y")
        except ValueError:
            return raw
    return str(value)


def format_export_money(value: Any) -> str:
    if value is None or value == "":
        return "—"
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return str(value)
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",")


def localize_value(field: str, value: Any) -> Any:
    if value is None or value == "":
        return "—"

    if field in {"created_at", "updated_at", "completed_at", "deadline", "earliest_deadline", "latest_deadline"}:
        return format_export_date(value)

    if field in {"total_price", "discount_amount", "final_price", "total_paid", "total_earned", "avg_order_value"}:
        return format_export_money(value)

    if field == "status":
        key = getattr(value, "value", value)
        return STATUS_LABELS_RU.get(str(key), str(key))

    if field == "priority":
        key = getattr(value, "value", value)
        return PRIORITY_LABELS_RU.get(str(key), str(key))

    if field == "role":
        key = getattr(value, "value", value)
        return ROLE_LABELS_RU.get(str(key), str(key))

    if field == "loyalty_tier":
        return LOYALTY_LABELS_RU.get(str(value), str(value))

    if field in {"is_active", "is_available", "is_published", "is_moderated"}:
        if isinstance(value, str):
            return BOOL_LABELS_RU.get(value.lower(), value)
        return BOOL_LABELS_RU.get(bool(value), str(value))

    if field == "discount_percent":
        try:
            return f"{float(value):g}%"
        except (TypeError, ValueError):
            return str(value)

    if field == "rating":
        try:
            return f"{float(value):.1f}"
        except (TypeError, ValueError):
            return str(value)

    if isinstance(value, Decimal):
        return format_export_money(value)

    return value


def localize_filter_value(key: str, value: Any) -> Any:
    if key == "status" and isinstance(value, str):
        parts = [p.strip() for p in value.split(",") if p.strip()]
        return ", ".join(STATUS_LABELS_RU.get(p, p) for p in parts)
    if key == "priority":
        return PRIORITY_LABELS_RU.get(str(value), value)
    if key == "role":
        return ROLE_LABELS_RU.get(str(value), value)
    if key in {"is_active", "is_published", "is_moderated", "available_only"}:
        if isinstance(value, str):
            return BOOL_LABELS_RU.get(value.lower(), value)
        return BOOL_LABELS_RU.get(bool(value), value)
    return value


def _format_date_range(date_from: Any, date_to: Any) -> Optional[str]:
    """Один диапазон дат: «01.01.2025 — 31.01.2025» или «с …» / «по …»."""
    if not date_from and not date_to:
        return None
    from_s = format_export_date(date_from) if date_from else None
    to_s = format_export_date(date_to) if date_to else None
    has_from = from_s and from_s != "—"
    has_to = to_s and to_s != "—"
    if has_from and has_to:
        return f"{from_s} — {to_s}"
    if has_from:
        return f"с {from_s}"
    if has_to:
        return f"по {to_s}"
    return None


def _filter_label_ru(key: str) -> str:
    return FILTER_LABELS_RU.get(key, key.replace("_", " "))


def filters_for_report(**kwargs: Any) -> Dict[str, Any]:
    """Только параметры фильтрации (без метаданных отчёта)."""
    result: Dict[str, Any] = {}

    date_from = kwargs.pop("date_from", None)
    date_to = kwargs.pop("date_to", None)
    period = _format_date_range(date_from, date_to)
    if period:
        result[DATE_RANGE_LABEL_RU] = period

    for key, value in kwargs.items():
        if value is None or value == "" or value == []:
            continue
        label = _filter_label_ru(key)
        result[label] = localize_filter_value(key, value)
    return result


def report_meta_for_export(created_by: Optional[str] = None) -> Dict[str, str]:
    """Метаданные отчёта: дата формирования и автор."""
    meta: Dict[str, str] = {
        REPORT_GENERATED_LABEL_RU: format_export_date(datetime.now()),
    }
    if created_by:
        meta[REPORT_AUTHOR_LABEL_RU] = created_by
    return meta


def build_export_rows(
    raw_rows: Iterable[Mapping[str, Any]],
    columns: List[str],
) -> List[Dict[str, Any]]:
    """Преобразует строки экспорта: порядок колонок, русские заголовки и значения."""
    rows: List[Dict[str, Any]] = []
    for raw in raw_rows:
        row: Dict[str, Any] = {}
        for col in columns:
            label = header_label(col)
            row[label] = localize_value(col, raw.get(col))
        rows.append(row)
    return rows


def header_label(key: str, column_labels: Optional[Mapping[str, str]] = None) -> str:
    labels = column_labels or COLUMN_LABELS_RU
    if key in labels:
        return labels[key]
    if key in FILTER_LABELS_RU:
        return FILTER_LABELS_RU[key]
    return key.replace("_", " ")
