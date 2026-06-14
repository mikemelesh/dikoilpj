"""Ensure predefined service categories exist in the database."""
from sqlalchemy.orm import Session

from ..constants.service_categories import PREDEFINED_SERVICE_CATEGORIES
from ..models.service import ServiceCategory


def ensure_predefined_categories(db: Session) -> list[ServiceCategory]:
    """Create missing predefined categories; keep existing rows by name."""
    result: list[ServiceCategory] = []

    for cat_data in PREDEFINED_SERVICE_CATEGORIES:
        existing = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.name == cat_data["name"])
            .first()
        )
        if existing:
            if not existing.is_active:
                existing.is_active = True
            if existing.sort_order != cat_data["sort_order"]:
                existing.sort_order = cat_data["sort_order"]
            if cat_data.get("description") and not existing.description:
                existing.description = cat_data["description"]
            result.append(existing)
            continue

        category = ServiceCategory(
            name=cat_data["name"],
            description=cat_data.get("description"),
            icon_url=None,
            sort_order=cat_data["sort_order"],
            is_active=True,
        )
        db.add(category)
        db.flush()
        result.append(category)

    db.commit()
    for cat in result:
        db.refresh(cat)

    return sorted(result, key=lambda c: (c.sort_order, c.name))
