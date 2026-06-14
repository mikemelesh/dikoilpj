"""Брендинг и константы оформления отчётов."""
import os

APP_NAME = os.getenv("REPORT_APP_NAME", "Dental Lab")
APP_SUBTITLE = os.getenv(
    "REPORT_APP_SUBTITLE",
    "Система управления зуботехнической лабораторией",
)
APP_TAGLINE = os.getenv(
    "REPORT_APP_TAGLINE",
    "Зуботехническая лаборатория полного цикла",
)
DOCUMENT_FOOTER = (
    f"Документ сформирован автоматически в системе {APP_NAME}. "
    "Служебная информация — не для публичного распространения."
)

# Цветовая палитра (HEX без #)
COLOR_BRAND_DARK = "1B3A6B"
COLOR_BRAND_ACCENT = "4472C4"
COLOR_BRAND_MID = "2F5496"
COLOR_SECTION_BG = "D6E4F0"
COLOR_META_BG = "F5F7FA"
COLOR_ZEBRA = "EEF2F7"
COLOR_WHITE = "FFFFFF"
COLOR_TEXT_MUTED = "595959"
COLOR_BORDER = "8EA9DB"
COLOR_ACCENT_LINE = "4472C4"

DATA_SECTION_TITLE_RU = "Сводные данные"
RECORD_COUNT_LABEL_RU = "Записей в отчёте"
