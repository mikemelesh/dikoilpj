"""Утилиты для резервного копирования и восстановления PostgreSQL."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, status

from ..config import settings

BACKUP_FILENAME_PATTERN = re.compile(r"^backup_\d{8}_\d{6}\.sql$")


@dataclass(frozen=True)
class DatabaseConnectionParams:
    host: str
    port: str
    user: str
    password: str
    dbname: str


def get_backup_dir() -> Path:
    backup_dir = Path(settings.BASE_DIR.parent) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def resolve_backup_file(filename: str) -> Path:
    if not BACKUP_FILENAME_PATTERN.match(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректное имя файла бэкапа",
        )

    backup_dir = get_backup_dir()
    filepath = backup_dir / filename

    if not filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бэкап не найден",
        )

    try:
        filepath.resolve().relative_to(backup_dir.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректное имя файла",
        ) from exc

    return filepath


def parse_database_url(db_url: str) -> DatabaseConnectionParams:
    db_url_clean = db_url.replace("postgresql+psycopg://", "").replace("postgresql+psycopg2://", "")

    if "@" in db_url_clean:
        user_pass, host_db = db_url_clean.split("@", 1)
    else:
        host_db = db_url_clean
        user_pass = ""

    if ":" in user_pass:
        user, password = user_pass.split(":", 1)
    else:
        user = user_pass
        password = ""

    if "/" not in host_db:
        raise ValueError("Некорректный формат DSN: отсутствует имя базы данных")

    host_port, dbname = host_db.rsplit("/", 1)
    if "?" in dbname:
        dbname = dbname.split("?", 1)[0]

    if ":" in host_port:
        host, port = host_port.rsplit(":", 1)
    else:
        host = host_port
        port = "5432"

    if not dbname:
        raise ValueError("Некорректный формат DSN: пустое имя базы данных")

    return DatabaseConnectionParams(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname,
    )


def find_postgres_binary(name: str) -> str:
    binary_path = shutil.which(name)
    if binary_path:
        return binary_path

    suffix = ".exe" if os.name == "nt" else ""
    possible_paths = [
        rf"C:\Program Files\PostgreSQL\14\bin\{name}{suffix}",
        rf"C:\Program Files\PostgreSQL\15\bin\{name}{suffix}",
        rf"C:\Program Files\PostgreSQL\16\bin\{name}{suffix}",
        f"/usr/lib/postgresql/16/bin/{name}",
        f"/usr/lib/postgresql/15/bin/{name}",
        f"/usr/lib/postgresql/14/bin/{name}",
    ]
    for path in possible_paths:
        if Path(path).exists():
            return path

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{name} не найден. Убедитесь, что PostgreSQL client tools установлены.",
    )


def _postgres_env(password: str) -> dict[str, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    return env


def _run_psql(
    *,
    psql_path: str,
    params: DatabaseConnectionParams,
    database: str,
    args: list[str],
    timeout: int = 300,
) -> subprocess.CompletedProcess[str]:
    cmd = [
        psql_path,
        "-h",
        params.host,
        "-p",
        params.port,
        "-U",
        params.user,
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        *args,
    ]
    return subprocess.run(
        cmd,
        env=_postgres_env(params.password),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def create_database_backup(filepath: Path) -> None:
    params = parse_database_url(settings.SQLALCHEMY_DATABASE_URL)
    pg_dump_path = find_postgres_binary("pg_dump")

    cmd = [
        pg_dump_path,
        "-h",
        params.host,
        "-p",
        params.port,
        "-U",
        params.user,
        "-d",
        params.dbname,
        "-F",
        "p",
        "-f",
        str(filepath),
    ]

    result = subprocess.run(
        cmd,
        env=_postgres_env(params.password),
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )

    if result.returncode != 0:
        error_detail = result.stderr or result.stdout or "Неизвестная ошибка"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка pg_dump: {error_detail}",
        )


def restore_database_from_backup(filepath: Path) -> None:
    params = parse_database_url(settings.SQLALCHEMY_DATABASE_URL)
    psql_path = find_postgres_binary("psql")
    maintenance_db = "postgres"
    dbname = params.dbname

    if not re.fullmatch(r"[A-Za-z0-9_]+", dbname):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Недопустимое имя базы данных для восстановления",
        )

    terminate_sql = (
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        f"WHERE datname = '{dbname}' AND pid <> pg_backend_pid();"
    )
    terminate_result = _run_psql(
        psql_path=psql_path,
        params=params,
        database=maintenance_db,
        args=["-c", terminate_sql],
        timeout=120,
    )
    if terminate_result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось завершить активные подключения: {terminate_result.stderr or terminate_result.stdout}",
        )

    drop_result = _run_psql(
        psql_path=psql_path,
        params=params,
        database=maintenance_db,
        args=["-c", f'DROP DATABASE IF EXISTS "{dbname}";'],
        timeout=120,
    )
    if drop_result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось удалить базу данных: {drop_result.stderr or drop_result.stdout}",
        )

    create_result = _run_psql(
        psql_path=psql_path,
        params=params,
        database=maintenance_db,
        args=["-c", f'CREATE DATABASE "{dbname}" WITH ENCODING \'UTF8\';'],
        timeout=120,
    )
    if create_result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось создать базу данных: {create_result.stderr or create_result.stdout}",
        )

    restore_result = _run_psql(
        psql_path=psql_path,
        params=params,
        database=dbname,
        args=["-f", str(filepath)],
        timeout=600,
    )
    if restore_result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка восстановления из бэкапа: {restore_result.stderr or restore_result.stdout}",
        )
