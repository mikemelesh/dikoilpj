"""Predefined service categories (fixed catalog for managers)."""

PREDEFINED_SERVICE_CATEGORIES: list[dict] = [
    {
        "name": "Несъемные протезы",
        "description": "Коронки, мосты, виниры",
        "sort_order": 1,
    },
    {
        "name": "Съемные протезы",
        "description": "Частичные и полные протезы",
        "sort_order": 2,
    },
    {
        "name": "Имплантация",
        "description": "Услуги по имплантации",
        "sort_order": 3,
    },
    {
        "name": "Ортодонтия",
        "description": "Брекеты, элайнеры",
        "sort_order": 4,
    },
    {
        "name": "Дополнительные услуги",
        "description": "Прочие услуги",
        "sort_order": 5,
    },
]

PREDEFINED_CATEGORY_NAMES: frozenset[str] = frozenset(
    c["name"] for c in PREDEFINED_SERVICE_CATEGORIES
)
