import os
import uuid
from pathlib import Path
from typing import Final, Tuple

from fastapi import HTTPException, UploadFile, status

from ..config import settings


ALLOWED_TYPES: Final = {".jpg", ".jpeg", ".png", ".pdf", ".stl", ".dcm"}
MAX_SIZE: Final = 10 * 1024 * 1024  # 10MB


def validate_file(file: UploadFile) -> Tuple[bool, str]:
    """
    Проверка расширения и размера файла.
    Возвращает (success, error_message).
    """
    if not file.filename:
        return False, "Имя файла не указано"

    extension = os.path.splitext(file.filename)[1].lower()
    if extension not in ALLOWED_TYPES:
        return False, f"Недопустимый тип файла. Разрешены: {', '.join(ALLOWED_TYPES)}"

    # Читаем файл для проверки размера
    file.file.seek(0, 2)  # Перемещаемся в конец
    size = file.file.tell()
    file.file.seek(0)  # Возвращаемся в начало

    if size > MAX_SIZE:
        return False, f"Файл слишком большой. Максимум: {MAX_SIZE // 1024 // 1024}MB"

    return True, ""


def save_file(file: UploadFile, order_id: str) -> str:
    """
    Сохранение файла на диск и возврат относительного пути.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не указано"
        )

    # Проверка валидности
    is_valid, error_msg = validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    uploads_dir: Path = settings.UPLOAD_DIR / str(order_id)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Генерируем уникальное имя файла
    extension = os.path.splitext(file.filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{extension}"
    target_path = uploads_dir / safe_name

    # Сохраняем файл
    with target_path.open("wb") as buffer:
        content = file.file.read()
        buffer.write(content)

    # Возвращаем относительный путь
    return str(target_path.relative_to(settings.BASE_DIR.parent))

