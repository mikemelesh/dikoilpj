from datetime import timedelta


class Settings:
    PROJECT_NAME: str = "Dental Lab API"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./dental_lab.db"
    TEMPLATES_DIR: str = "./templates"


settings = Settings()

