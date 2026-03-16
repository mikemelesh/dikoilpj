from ..database import get_db as _get_db


def get_db():
    """
    Thin re-export of the core DB dependency so that routers depend
    only on dependencies.db rather than database directly.
    """

    return _get_db()

