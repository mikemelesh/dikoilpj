from datetime import timedelta
from pathlib import Path


class Settings:
    # Core
    PROJECT_NAME: str = "Dental Lab API"

    # Security
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database (PostgreSQL by spec; adjust DSN via env in real deployments)
    SQLALCHEMY_DATABASE_URL: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/dental_lab"
    )

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR.parent / "uploads"

    # Templates (legacy server-rendered pages; can be removed after React migration)
    TEMPLATES_DIR: Path = BASE_DIR.parent / "templates"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    @property
    def access_token_expires(self):
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)

    @property
    def refresh_token_expires(self):
        return timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)


settings = Settings()

