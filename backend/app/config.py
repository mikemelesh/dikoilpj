import os
from datetime import timedelta
from pathlib import Path


class Settings:
    # Core
    PROJECT_NAME: str = "Dental Lab API"

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database (PostgreSQL) - reads from environment variable or uses default
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "SQLALCHEMY_DATABASE_URL",
        "postgresql+psycopg://postgres:postgres123@localhost:5433/dental_lab"
    )

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR.parent / "uploads"

    # Templates (legacy server-rendered pages; can be removed after React migration)
    TEMPLATES_DIR: Path = BASE_DIR.parent / "templates"

    # CORS (comma-separated origins in CORS_ORIGINS env)
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ]

    @property
    def access_token_expires(self):
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)

    @property
    def refresh_token_expires(self):
        return timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)


settings = Settings()

