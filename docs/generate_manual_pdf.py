#!/usr/bin/env python3
"""Генерация PDF: руководство пользователя и системного программиста."""

from __future__ import annotations

import asyncio
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
SCREENSHOTS_DIR = DOCS_DIR / "screenshots"
OUTPUT_PDF = DOCS_DIR / "Руководство_Dental_Lab.pdf"

FRONTEND_URL = "http://127.0.0.1:5173"
BACKEND_URL = "http://127.0.0.1:8000"

APP_NAME = "Система управления зуботехнической лабораторией «Dental Lab»"
APP_VERSION = "1.0.0"
DEVELOPER = "Разработчик: команда проекта Dental Lab"
COPYRIGHT = "Правообладатель: Dental Lab"

SCREENSHOT_SPECS = [
  # filename, url, login_email, width, height, wait_selector
    ("01_home.png", f"{FRONTEND_URL}/", None, 1280, 900, "text=Dental Lab"),
    ("02_login.png", f"{FRONTEND_URL}/login", None, 1280, 900, "text=Вход в аккаунт"),
    ("03_register.png", f"{FRONTEND_URL}/register", None, 1280, 900, "text=Регистрация"),
    ("04_calculator.png", f"{FRONTEND_URL}/calculator", None, 1280, 900, "text=Калькулятор стоимости"),
    ("05_client_dashboard.png", f"{FRONTEND_URL}/client", "client1@dental-lab.ru", 1440, 900, "text=Личный кабинет"),
    ("06_client_orders.png", f"{FRONTEND_URL}/client/orders", "client1@dental-lab.ru", 1440, 900, "text=Мои заказы"),
    ("07_manager_dashboard.png", f"{FRONTEND_URL}/manager", "manager1@dental-lab.ru", 1440, 900, "text=Панель менеджера"),
    ("08_manager_orders.png", f"{FRONTEND_URL}/manager/orders", "manager1@dental-lab.ru", 1440, 900, "text=Заказы"),
    ("10_technician_orders.png", f"{FRONTEND_URL}/technician/orders", "technician1@dental-lab.ru", 1440, 900, "text=Мои заказы"),
    ("09_api_docs.png", f"{BACKEND_URL}/docs", None, 1440, 900, "#swagger-ui"),
]

CREDENTIALS = {
    "client1@dental-lab.ru": "Client123!",
    "manager1@dental-lab.ru": "Manager123!",
    "technician1@dental-lab.ru": "Tech123!",
    "admin@dental-lab.ru": "Admin123!",
}


def register_fonts() -> tuple[str, str]:
    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if Path(regular).exists() and Path(bold).exists():
            pdfmetrics.registerFont(TTFont("DejaVu", regular))
            pdfmetrics.registerFont(TTFont("DejaVu-Bold", bold))
            return "DejaVu", "DejaVu-Bold"
    return "Helvetica", "Helvetica-Bold"


def api_login(email: str) -> dict:
    """Вход через REST API — надёжнее UI-формы в headless-браузере."""
    body = urllib.parse.urlencode(
        {"username": email, "password": CREDENTIALS[email]},
    ).encode()
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/auth/login",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def build_auth_storage_payload(auth: dict) -> dict:
    user = dict(auth["user"])
    if auth.get("client_profile"):
        user["client_profile"] = auth["client_profile"]
    if auth.get("technician_profile"):
        user["technician_profile"] = auth["technician_profile"]
    return {
        "state": {
            "user": user,
            "accessToken": auth["access_token"],
            "refreshToken": auth["refresh_token"],
            "isAuthenticated": True,
        },
        "version": 0,
    }


async def inject_auth(page, auth: dict) -> None:
    """Сохраняем сессию в localStorage так же, как zustand persist."""
    payload = build_auth_storage_payload(auth)
    await page.evaluate(
        """(data) => {
            localStorage.setItem('auth-storage', JSON.stringify(data));
        }""",
        payload,
    )


async def clear_auth(page) -> None:
    await page.evaluate("() => localStorage.removeItem('auth-storage')")


async def capture_screenshots() -> dict[str, Path]:
    from playwright.async_api import async_playwright

    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    auth_cache: dict[str, dict] = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="ru-RU",
        )

        current_auth_email: str | None = None

        for filename, url, login_email, width, height, wait_selector in SCREENSHOT_SPECS:
            out = SCREENSHOTS_DIR / filename
            page = await context.new_page()
            await page.set_viewport_size({"width": width, "height": height})
            try:
                if login_email:
                    if current_auth_email != login_email:
                        if login_email not in auth_cache:
                            auth_cache[login_email] = api_login(login_email)
                        await page.goto(FRONTEND_URL, wait_until="domcontentloaded", timeout=30000)
                        await inject_auth(page, auth_cache[login_email])
                        current_auth_email = login_email
                elif current_auth_email:
                    await page.goto(FRONTEND_URL, wait_until="domcontentloaded", timeout=30000)
                    await clear_auth(page)
                    current_auth_email = None

                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_selector(wait_selector, timeout=20000)

                if login_email and "/login" in page.url:
                    raise RuntimeError(f"редирект на login вместо {url}")

                await page.wait_for_timeout(800)
                await page.screenshot(path=str(out), full_page=False)
                paths[filename] = out
                print(f"  ✓ {filename} ({page.url})")
            except Exception as exc:
                print(f"  ✗ {filename}: {exc}", file=sys.stderr)
            finally:
                await page.close()

        await browser.close()
    return paths


def build_styles(font: str, font_bold: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=font_bold,
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "part": ParagraphStyle(
            "Part",
            parent=base["Heading1"],
            fontName=font_bold,
            fontSize=18,
            leading=24,
            spaceBefore=10,
            spaceAfter=12,
            textColor=colors.HexColor("#1e3a5f"),
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Heading2"],
            fontName=font_bold,
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=8,
            textColor=colors.HexColor("#2f5496"),
        ),
        "subsection": ParagraphStyle(
            "Subsection",
            parent=base["Heading3"],
            fontName=font_bold,
            fontSize=12,
            leading=16,
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName=font,
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName=font,
            fontSize=10,
            leading=14,
            leftIndent=12,
            bulletIndent=0,
            spaceAfter=3,
        ),
        "caption": ParagraphStyle(
            "Caption",
            parent=base["Normal"],
            fontName=font,
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.grey,
            spaceBefore=4,
            spaceAfter=12,
        ),
        "placeholder": ParagraphStyle(
            "Placeholder",
            parent=base["Normal"],
            fontName=font,
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#888888"),
        ),
        "toc": ParagraphStyle(
            "TOC",
            parent=base["Normal"],
            fontName=font,
            fontSize=11,
            leading=16,
            spaceAfter=4,
        ),
    }


def P(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), style)


def bullet_list(items: list[str], style: ParagraphStyle) -> list:
    return [P(f"• {item}", style) for item in items]


def numbered_list(items: list[str], style: ParagraphStyle) -> list:
    return [P(f"{i}. {item}", style) for i, item in enumerate(items, 1)]


def image_or_placeholder(
    screenshot_paths: dict[str, Path],
    filename: str,
    caption: str,
    figure_num: int,
    styles: dict[str, ParagraphStyle],
    width: float = 16 * cm,
) -> list:
    flow: list = []
    path = screenshot_paths.get(filename)
    if path and path.exists():
        img = Image(str(path), width=width, height=width * 0.56)
        flow.append(img)
    else:
        placeholder = Table(
            [[P(f"[Место для рисунка {figure_num}]", styles["placeholder"])]],
            colWidths=[width],
            rowHeights=[width * 0.56],
        )
        placeholder.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cccccc")),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f5f5")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        flow.append(placeholder)
    flow.append(P(f"Рисунок {figure_num} — {caption}", styles["caption"]))
    return flow


def glossary_table(styles: dict[str, ParagraphStyle]) -> Table:
    data = [
        [P("<b>Термин / сокращение</b>", styles["body"]), P("<b>Определение</b>", styles["body"])],
        ["API", "Программный интерфейс приложения (Application Programming Interface)"],
        ["JWT", "JSON Web Token — токен аутентификации пользователя"],
        ["REST", "Архитектурный стиль взаимодействия клиента и сервера по HTTP"],
        ["Заказ", "Заявка клиента на выполнение зуботехнических работ"],
        ["Клиент", "Пользователь с ролью client — стоматологическая клиника или частное лицо"],
        ["Менеджер", "Пользователь с ролью manager — управляет заказами и справочниками"],
        ["Техник", "Пользователь с ролью technician — выполняет назначенные заказы"],
        ["Администратор", "Пользователь с ролью admin — полный контроль системы"],
        ["Статус заказа", "Этап жизненного цикла заказа: new, confirmed, in_progress, review, completed, cancelled, archived"],
        ["Шаблон заказа", "Сохранённый набор услуг для быстрого повторного оформления"],
        ["PostgreSQL", "Система управления реляционными базами данных"],
        ["FastAPI", "Фреймворк серверной части приложения на Python"],
        ["React", "Библиотека клиентской части веб-приложения"],
    ]
    rows = []
    for row in data:
        if isinstance(row[0], str):
            rows.append([P(row[0], styles["body"]), P(row[1], styles["body"])])
        else:
            rows.append(row)
    table = Table(rows, colWidths=[5.5 * cm, 11 * cm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def build_user_manual(styles: dict[str, ParagraphStyle], screenshots: dict[str, Path]) -> list:
    s = styles
    flow: list = []
    fig = 1

    flow.append(P("ЧАСТЬ 1. РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ", s["part"]))
    flow.append(Spacer(1, 4 * mm))

    # 1. Общие сведения
    flow.append(P("1. Общие сведения", s["section"]))
    flow.append(P(f"<b>Полное наименование:</b> {APP_NAME}", s["body"]))
    flow.append(P(f"<b>Версия:</b> {APP_VERSION}", s["body"]))
    flow.append(P(f"<b>{DEVELOPER}</b>", s["body"]))
    flow.append(P(f"<b>{COPYRIGHT}</b>", s["body"]))
    flow.append(Spacer(1, 3 * mm))

    flow.append(P("1.1. Краткое описание", s["subsection"]))
    flow.append(
        P(
            "«Dental Lab» — веб-приложение для автоматизации работы зуботехнической лаборатории: "
            "приём заказов от клиентов, назначение техников, учёт материалов, формирование отчётов, "
            "программа лояльности, публикация контента и модерация отзывов.",
            s["body"],
        )
    )

    flow.append(P("1.2. Архитектура приложения", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "<b>Клиентская часть</b> — одностраничное веб-приложение (SPA) на React 18, TypeScript, Vite; "
                "взаимодействует с сервером по REST API через HTTP/HTTPS.",
                "<b>Серверная часть</b> — REST API на FastAPI (Python 3.10+), аутентификация JWT, "
                "бизнес-логика и формирование отчётов (Word, Excel).",
                "<b>База данных</b> — PostgreSQL 14+; хранение заказов, пользователей, справочников, уведомлений.",
                "<b>Файловое хранилище</b> — загрузка сканов, STL, DICOM и PDF к заказам.",
            ],
            s["bullet"],
        )
    )
    flow.append(Spacer(1, 3 * mm))
    flow.extend(image_or_placeholder(screenshots, "01_home.png", "Главная страница приложения", fig, s))
    fig += 1

    flow.append(P("1.3. Глоссарий терминов и сокращений", s["subsection"]))
    flow.append(glossary_table(s))
    flow.append(PageBreak())

    # 2. Назначение и условия применения
    flow.append(P("2. Назначение и условия применения", s["section"]))
    flow.append(P("2.1. Назначение и цели создания", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "Централизованный учёт заказов зуботехнической лаборатории.",
                "Сокращение времени согласования заказов между клиентом, менеджером и техником.",
                "Прозрачный контроль сроков, статусов и стоимости работ.",
                "Предоставление клиентам публичного каталога услуг, калькулятора и портфолио техников.",
                "Формирование аналитических отчётов и выгрузок для руководства.",
            ],
            s["bullet"],
        )
    )

    flow.append(P("2.2. Решаемые задачи", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "Оформление и отслеживание заказов клиентами.",
                "Назначение техников и управление производственным графиком (Gantt).",
                "Учёт материалов и заявок техников на расходники.",
                "Управление каталогом услуг, акциями и шаблонами заказов.",
                "Модерация отзывов, публикация статей и FAQ.",
                "Резервное копирование и аудит действий (роль admin).",
            ],
            s["bullet"],
        )
    )

    flow.append(P("2.3. Требования к техническим и программным средствам (веб-приложение)", s["subsection"]))
    flow.append(P("<b>Поддерживаемые браузеры (актуальные версии):</b>", s["body"]))
    flow.extend(
        bullet_list(
            [
                "Google Chrome 100+",
                "Mozilla Firefox 100+",
                "Microsoft Edge 100+",
                "Safari 15+ (macOS, iOS)",
            ],
            s["bullet"],
        )
    )
    flow.append(P("<b>Минимальная скорость интернет-соединения:</b> 1 Мбит/с (рекомендуется 5 Мбит/с и выше).", s["body"]))
    flow.append(P("<b>Разрешение экрана:</b> не менее 1280×720 (рекомендуется 1920×1080).", s["body"]))
    flow.append(P("<b>JavaScript:</b> должен быть включён в браузере.", s["body"]))
    flow.append(PageBreak())

    # 3. Описание основных функций
    flow.append(P("3. Описание основных функций", s["section"]))
    flow.append(P("3.1. Логические блоки приложения", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "<b>Публичный раздел</b> — главная страница, каталог услуг, калькулятор стоимости, портфолио, статьи, FAQ.",
                "<b>Аутентификация</b> — регистрация, вход, разграничение доступа по ролям.",
                "<b>Модуль заказов</b> — создание, редактирование, смена статусов, история, прикрепление файлов.",
                "<b>Управление клиентами и техниками</b> — профили, рейтинг, загрузка, назначение.",
                "<b>Справочники</b> — услуги, материалы, акции, шаблоны.",
                "<b>Отчёты и экспорт</b> — Excel/Word по заказам, клиентам, материалам, срокам.",
                "<b>Уведомления</b> — оповещения о смене статусов и системных событиях.",
                "<b>Администрирование</b> — пользователи, контент, логи, резервные копии.",
            ],
            s["bullet"],
        )
    )

    flow.append(P("3.2. Временные характеристики и режим работы", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "Режим работы: многопользовательский, клиент-серверный, требуется сетевое подключение.",
                "Типичное время отклика интерфейса при локальном развёртывании: 0,1–0,5 с на действие пользователя.",
                "Время обработки API-запросов: до 2 с для стандартных операций; до 10 с для формирования отчётов.",
                "Автономный режим не предусмотрен — данные хранятся на сервере.",
            ],
            s["bullet"],
        )
    )

    flow.append(P("3.3. Основные сценарии работы пользователя", s["subsection"]))

    scenarios = [
        (
            "Запуск и авторизация",
            [
                f"Откройте браузер и перейдите по адресу приложения (например, {FRONTEND_URL}).",
                "На главной странице нажмите «Вход» или перейдите по ссылке /login.",
                "Введите учётные данные: email и пароль.",
                "Нажмите кнопку «Войти». Система перенаправит на панель управления в соответствии с ролью.",
            ],
            "02_login.png",
            "Экран авторизации в приложении",
        ),
        (
            "Регистрация нового клиента",
            [
                "Перейдите на страницу /register.",
                "Заполните форму: email, пароль, имя, телефон, тип клиента.",
                "Нажмите «Зарегистрироваться». После успешной регистрации выполните вход.",
            ],
            "03_register.png",
            "Экран регистрации клиента",
        ),
        (
            "Расчёт стоимости услуг (публичный калькулятор)",
            [
                "Откройте раздел «Калькулятор» (/calculator).",
                "Выберите категорию и услуги, укажите количество.",
                "Просмотрите итоговую стоимость с учётом скидок и акций.",
            ],
            "04_calculator.png",
            "Калькулятор стоимости услуг",
        ),
        (
            "Создание заказа (роль client)",
            [
                "Войдите под учётной записью клиента.",
                "Перейдите в «Новый заказ» или используйте сохранённый шаблон.",
                "Добавьте услуги, укажите срок, комментарий и прикрепите файлы при необходимости.",
                "Отправьте заказ. Статус будет «new» до подтверждения менеджером.",
            ],
            "06_client_orders.png",
            "Список заказов клиента",
        ),
        (
            "Управление заказами (роль manager)",
            [
                "Войдите под учётной записью менеджера.",
                "Откройте раздел «Заказы», отфильтруйте по статусу или приоритету.",
                "Откройте карточку заказа: скорректируйте состав, назначьте техника, подтвердите заказ.",
                "Отслеживайте сроки на диаграмме Gantt.",
            ],
            "08_manager_orders.png",
            "Управление заказами менеджером",
        ),
        (
            "Работа техника с назначенными заказами",
            [
                "Войдите под учётной записью техника.",
                "В разделе «Мои заказы» выберите назначенный заказ.",
                "Обновляйте статус (in_progress → review → completed), добавляйте комментарии и файлы.",
                "При необходимости создайте заявку на материалы.",
            ],
            "10_technician_orders.png",
            "Список заказов техника",
        ),
    ]

    for title, steps, shot, caption in scenarios:
        flow.append(P(f"<b>{title}</b>", s["subsection"]))
        flow.extend(numbered_list(steps, s["bullet"]))
        if shot:
            flow.extend(image_or_placeholder(screenshots, shot, caption, fig, s))
            fig += 1
        else:
            flow.extend(image_or_placeholder(screenshots, "", caption, fig, s))
            fig += 1
        flow.append(Spacer(1, 2 * mm))

    flow.extend(image_or_placeholder(screenshots, "05_client_dashboard.png", "Панель управления клиента", fig, s))
    fig += 1
    flow.extend(image_or_placeholder(screenshots, "07_manager_dashboard.png", "Панель управления менеджера", fig, s))
    fig += 1
    flow.append(PageBreak())

    # 4. Аварийные ситуации
    flow.append(P("4. Аварийные ситуации", s["section"]))
    flow.append(P("4.1. Восстановление при нештатных ситуациях", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "<b>Потеря интернет-соединения:</b> дождитесь восстановления сети; обновите страницу (F5). "
                "Несохранённые данные формы могут быть утеряны — повторите ввод.",
                "<b>Сбой электропитания / некорректное завершение ОС:</b> перезагрузите компьютер, "
                "откройте браузер и снова войдите в приложение.",
                "<b>Закрытие вкладки браузера:</b> откройте URL приложения; при активной сессии JWT "
                "авторизация сохраняется до истечения срока токена.",
            ],
            s["bullet"],
        )
    )

    flow.append(P("4.2. Диагностика типичных ошибок", s["subsection"]))
    errors = [
        ("Страница не найдена (404)", "Запрошенный URL отсутствует. Проверьте адрес или вернитесь на главную."),
        ("Доступ запрещён (401 / 403)", "Сессия истекла или недостаточно прав. Выполните повторный вход."),
        ("Сервер не отвечает (502 / 503)", "Серверная часть недоступна. Обратитесь к администратору или повторите позже."),
        ("Ошибка сети / Network Error", "Нет связи с API. Проверьте интернет и доступность сервера."),
        ("Некорректный email или пароль", "Проверьте раскладку клавиатуры и учётные данные."),
        ("Превышен лимит запросов (429)", "Слишком много попыток входа. Подождите 1–5 минут."),
        ("Ошибка загрузки файла", "Проверьте формат (.jpg, .png, .pdf, .stl, .dcm) и размер (до 10 МБ)."),
    ]
    err_rows = [[P("<b>Сообщение</b>", s["body"]), P("<b>Действия пользователя</b>", s["body"])]]
    for msg, action in errors:
        err_rows.append([P(msg, s["body"]), P(action, s["body"])])
    err_table = Table(err_rows, colWidths=[5.5 * cm, 11 * cm])
    err_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fdecea")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    flow.append(err_table)

    flow.append(P("4.3. Техническая поддержка", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "Email: support@dental-lab.ru",
                "Телефон: +375 (29) 123-45-67 (рабочие дни 9:00–18:00, время Минска)",
                "При обращении укажите: роль пользователя, описание проблемы, время возникновения, текст ошибки, скриншот.",
            ],
            s["bullet"],
        )
    )
    flow.append(PageBreak())
    return flow


def build_programmer_manual(styles: dict[str, ParagraphStyle], screenshots: dict[str, Path]) -> list:
    s = styles
    flow: list = []

    flow.append(P("ЧАСТЬ 2. РУКОВОДСТВО СИСТЕМНОГО ПРОГРАММИСТА", s["part"]))
    flow.append(Spacer(1, 4 * mm))

    # 1
    flow.append(P("1. Назначение и условия применения приложения", s["section"]))
    flow.append(P(f"<b>Наименование:</b> {APP_NAME}", s["body"]))
    flow.append(P(f"<b>Версия API:</b> {APP_VERSION}", s["body"]))
    flow.append(P(f"<b>{DEVELOPER}</b>", s["body"]))
    flow.append(
        P(
            "Приложение предназначено для развёртывания в инфраструктуре зуботехнической лаборатории "
            "и обеспечивает программный доступ к данным заказов, пользователей и справочников через REST API.",
            s["body"],
        )
    )
    flow.append(P("<b>Условия выполнения (сервер):</b>", s["body"]))
    flow.extend(
        bullet_list(
            [
                "ОС: Linux (Ubuntu 20.04+), Windows Server 2019+, macOS 12+.",
                "Процессор: 2 ядра и выше; RAM: минимум 2 ГБ (рекомендуется 4 ГБ).",
                "Python 3.10+, PostgreSQL 14+, Node.js 18+ (для сборки фронтенда).",
                "Свободное дисковое пространство: от 1 ГБ (без учёта пользовательских файлов).",
                "Сетевые порты: 8000 (API), 5173 (dev frontend) или 80/443 (production).",
            ],
            s["bullet"],
        )
    )
    flow.append(PageBreak())

    # 2
    flow.append(P("2. Характеристика приложения", s["section"]))
    flow.extend(
        bullet_list(
            [
                "Архитектура: трёхзвенная (клиент — API — СУБД).",
                "Аутентификация: JWT (Bearer token), срок действия настраивается в .env.",
                "Ограничение частоты запросов (rate limiting) на критичных эндпоинтах.",
                "Транзакционность операций с заказами через SQLAlchemy ORM.",
                "Журналирование действий пользователей (таблица action_logs).",
                "Самовосстановление: при перезапуске uvicorn состояние восстанавливается из PostgreSQL; "
                "несохранённые клиентские транзакции требуют повторной отправки.",
                "Контроль целостности: валидация входных данных Pydantic v2; ограничения FK в БД.",
            ],
            s["bullet"],
        )
    )
    flow.append(PageBreak())

    # 3
    flow.append(P("3. Обращение к приложению", s["section"]))
    flow.append(P("3.1. Запуск серверной части", s["subsection"]))
    flow.extend(
        numbered_list(
            [
                "Установите зависимости: pip install -r backend/requirements.txt",
                "Настройте backend/.env (DATABASE_URL, SECRET_KEY, CORS_ORIGINS).",
                "Выполните миграции: alembic upgrade head",
                "Запустите API: uvicorn app.main:app --host 0.0.0.0 --port 8000",
            ],
            s["bullet"],
        )
    )
    flow.append(P("3.2. Запуск клиентской части", s["subsection"]))
    flow.extend(
        numbered_list(
            [
                "Установите зависимости: npm install в каталоге frontend",
                "Настройте frontend/.env (VITE_API_URL)",
                "Режим разработки: npm run dev",
                "Production-сборка: npm run build; раздача статики через nginx или встроенный preview.",
            ],
            s["bullet"],
        )
    )
    flow.append(P("3.3. Docker-развёртывание", s["subsection"]))
    flow.append(P("Команда: docker-compose up --build — поднимает frontend, backend и PostgreSQL.", s["body"]))
    flow.append(P("3.4. Документация API", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                f"Swagger UI: {BACKEND_URL}/docs",
                f"ReDoc: {BACKEND_URL}/redoc",
                "Базовый префикс REST API: /api",
                "Авторизация: заголовок Authorization: Bearer &lt;token&gt;",
            ],
            s["bullet"],
        )
    )
    flow.extend(image_or_placeholder(screenshots, "09_api_docs.png", "Интерактивная документация API (Swagger UI)", 10, s))
    flow.append(PageBreak())

    # 4
    flow.append(P("4. Входные и выходные данные", s["section"]))
    flow.append(P("4.1. Входные данные (запросы API)", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "<b>JSON-тела</b> — создание/обновление заказов, услуг, пользователей (Content-Type: application/json).",
                "<b>Query-параметры</b> — фильтрация, пагинация (skip, limit, status, search).",
                "<b>Multipart/form-data</b> — загрузка файлов к заказам.",
                "<b>JWT-токен</b> — передаётся в заголовке Authorization при защищённых запросах.",
            ],
            s["bullet"],
        )
    )
    flow.append(P("4.2. Выходные данные (ответы API)", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "JSON — основной формат ответов (модели Pydantic).",
                "HTTP-коды: 200/201 — успех; 400 — ошибка валидации; 401 — не авторизован; 403 — нет прав; 404 — не найдено; 500 — ошибка сервера.",
                "Экспорт отчётов: application/vnd.openxmlformats (Excel), application/vnd.openxmlformats-officedocument.wordprocessingml.document (Word).",
                "Файлы заказов: бинарные потоки с заголовком Content-Disposition.",
            ],
            s["bullet"],
        )
    )
    flow.append(P("4.3. Основные сущности данных", s["subsection"]))
    entities = [
        ("User", "Пользователь системы (email, role, профиль)"),
        ("Client / Technician", "Профили клиента и техника"),
        ("Order / OrderItem", "Заказ и позиции услуг"),
        ("Service / ServiceCategory", "Каталог услуг"),
        ("Material / MaterialRequest", "Склад и заявки"),
        ("Notification", "Уведомления"),
        ("Review / Article / Faq", "Контент и отзывы"),
    ]
    ent_rows = [[P("<b>Сущность</b>", s["body"]), P("<b>Описание</b>", s["body"])]]
    for name, desc in entities:
        ent_rows.append([P(name, s["body"]), P(desc, s["body"])])
    ent_table = Table(ent_rows, colWidths=[5 * cm, 11.5 * cm])
    ent_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7"))]))
    flow.append(ent_table)
    flow.append(PageBreak())

    # 5
    flow.append(P("5. Сообщения", s["section"]))
    flow.append(P("5.1. Сообщения API (для программиста/оператора)", s["subsection"]))
    api_msgs = [
        ("200 OK", "Запрос выполнен успешно.", "Обработать полученные данные."),
        ("201 Created", "Ресурс создан.", "Использовать идентификатор из ответа."),
        ("400 Bad Request", "Ошибка валидации входных данных.", "Проверить тело запроса и схему Pydantic."),
        ("401 Unauthorized", "Токен отсутствует или недействителен.", "Выполнить POST /api/auth/login, обновить токен."),
        ("403 Forbidden", "Недостаточно прав для роли.", "Проверить роль пользователя и политику доступа."),
        ("404 Not Found", "Ресурс не найден.", "Проверить ID/URL запроса."),
        ("422 Unprocessable Entity", "Схема JSON не соответствует модели.", "Исправить поля согласно ответу detail."),
        ("429 Too Many Requests", "Превышен лимит запросов.", "Реализовать backoff, снизить частоту."),
        ("500 Internal Server Error", "Внутренняя ошибка сервера.", "Просмотреть логи uvicorn, состояние БД."),
    ]
    msg_rows = [
        [
            P("<b>Код / сообщение</b>", s["body"]),
            P("<b>Содержание</b>", s["body"]),
            P("<b>Действия</b>", s["body"]),
        ]
    ]
    for code, meaning, action in api_msgs:
        msg_rows.append([P(code, s["body"]), P(meaning, s["body"]), P(action, s["body"])])
    msg_table = Table(msg_rows, colWidths=[3.5 * cm, 6 * cm, 7 * cm])
    msg_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]
        )
    )
    flow.append(msg_table)

    flow.append(P("5.2. Сообщения пользовательского интерфейса", s["subsection"]))
    flow.extend(
        bullet_list(
            [
                "Toast-уведомления (react-toastify) — результат операций: успех, предупреждение, ошибка.",
                "ApiErrorAlert — отображение текста ошибки API на страницах личного кабинета.",
                "Валидация форм (zod) — сообщения под полями ввода на русском языке.",
            ],
            s["bullet"],
        )
    )

    flow.append(P("Приложение А. Тестовые учётные записи", s["subsection"]))
    cred_rows = [
        [P("<b>Роль</b>", s["body"]), P("<b>Email</b>", s["body"]), P("<b>Пароль</b>", s["body"])],
    ]
    for role, email, pwd in [
        ("admin", "admin@dental-lab.ru", "Admin123!"),
        ("manager", "manager1@dental-lab.ru", "Manager123!"),
        ("technician", "technician1@dental-lab.ru", "Tech123!"),
        ("client", "client1@dental-lab.ru", "Client123!"),
    ]:
        cred_rows.append([P(role, s["body"]), P(email, s["body"]), P(pwd, s["body"])])
    cred_table = Table(cred_rows, colWidths=[3 * cm, 6 * cm, 4 * cm])
    cred_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7"))]))
    flow.append(cred_table)

    return flow


def build_pdf(screenshots: dict[str, Path]) -> None:
    font, font_bold = register_fonts()
    styles = build_styles(font, font_bold)

    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Руководство Dental Lab",
        author="Dental Lab",
    )

    story: list = []
    story.append(P("ЭКСПЛУАТАЦИОННАЯ ДОКУМЕНТАЦИЯ", styles["title"]))
    story.append(P(APP_NAME, styles["title"]))
    story.append(P(f"Версия {APP_VERSION}", styles["body"]))
    story.append(Spacer(1, 6 * mm))
    story.append(P(f"Дата формирования: {date.today().strftime('%d.%m.%Y')}", styles["body"]))
    story.append(PageBreak())

    story.append(P("СОДЕРЖАНИЕ", styles["part"]))
    toc = [
        "Часть 1. Руководство пользователя",
        "  1. Общие сведения",
        "  2. Назначение и условия применения",
        "  3. Описание основных функций",
        "  4. Аварийные ситуации",
        "Часть 2. Руководство системного программиста",
        "  1. Назначение и условия применения приложения",
        "  2. Характеристика приложения",
        "  3. Обращение к приложению",
        "  4. Входные и выходные данные",
        "  5. Сообщения",
    ]
    story.extend(P(line, styles["toc"]) for line in toc)
    story.append(PageBreak())

    story.extend(build_user_manual(styles, screenshots))
    story.extend(build_programmer_manual(styles, screenshots))

    doc.build(story)
    print(f"\nPDF создан: {OUTPUT_PDF}")


def main() -> None:
    print("Создание скриншотов...")
    screenshots = asyncio.run(capture_screenshots())
    print(f"Скриншотов: {len(screenshots)}")
    print("Формирование PDF...")
    build_pdf(screenshots)


if __name__ == "__main__":
    main()
