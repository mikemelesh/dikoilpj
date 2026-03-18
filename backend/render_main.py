"""
Entry point для запуска на Render.
Применяет миграции и seed данные перед стартом приложения.
"""
import os
import sys
from pathlib import Path

# Добавляем backend в path
sys.path.insert(0, str(Path(__file__).parent))

from app.__main__ import run_migrations, run_seed_data
from app.main import create_app

if __name__ == "__main__":
    # Применяем миграции и seed
    run_migrations()
    run_seed_data()
    
    # Запускаем uvicorn
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:create_app", host="0.0.0.0", port=port, factory=True)
