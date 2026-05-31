from io import BytesIO
from typing import Any, Dict, List

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches


def _sanitize_excel_sheet_title(title: str) -> str:
    """
    Excel worksheet title rules (openpyxl validates similarly):
    - Max length: 31 characters
    - Cannot contain: : \\ / ? * [ ]
    - Cannot be empty
    """
    if title is None:
        title = ""
    cleaned = str(title).strip()
    invalid_chars = {":", "\\", "/", "?", "*", "[", "]"}
    cleaned = "".join(ch for ch in cleaned if ch not in invalid_chars)
    cleaned = cleaned.strip()
    if not cleaned:
        cleaned = "Report"
    return cleaned[:31]


def generate_excel(data: List[Dict[str, Any]], title: str, filters: Dict[str, Any] = None) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = _sanitize_excel_sheet_title(title)

    # Header
    ws.merge_cells('A1:D1')
    ws['A1'] = title
    ws['A1'].font = Font(bold=True, size=16)
    ws['A1'].alignment = Alignment(horizontal='center')

    # Filters summary
    row = 3
    if filters:
        ws['A' + str(row)] = "Фильтры:"
        ws['A' + str(row)].font = Font(bold=True)
        row += 1
        for k, v in filters.items():
            ws['A' + str(row)] = f"{k}: {v}"
            row += 1
        row += 1

    if not data:
        ws['A' + str(row)] = "Нет данных"
        ws['A' + str(row)].font = Font(bold=True)
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    # Headers
    headers = list(data[0].keys()) if data else []
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col)
        cell.value = header.replace('_', ' ').title()
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

    # Data
    for item in data:
        row += 1
        for col, key in enumerate(headers, 1):
            value = item.get(key, '')
            if isinstance(value, dict):
                value = str(value)
            ws.cell(row=row, column=col).value = value

    # Auto size (avoid merged-cell objects which break `column_letter` access)
    from openpyxl.utils import get_column_letter

    max_col = ws.max_column
    for col_idx in range(1, max_col + 1):
        letter = get_column_letter(col_idx)
        max_length = 0

        # start from row=2 to avoid merged header row (A1:D1)
        for row_cells in ws.iter_rows(min_row=2, min_col=col_idx, max_col=col_idx, values_only=False):
            cell = row_cells[0]
            if cell.value is None:
                continue
            max_length = max(max_length, len(str(cell.value)))

        adjusted_width = min(max_length + 2, 50) if max_length else 10
        ws.column_dimensions[letter].width = adjusted_width

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_docx(data: List[Dict[str, Any]], title: str, filters: Dict[str, Any] = None) -> BytesIO:
    doc = Document()

    # Title
    title_p = doc.add_paragraph(title)
    title_p.runs[0].bold = True
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_after = Inches(0.3)

    # Filters
    if filters:
        doc.add_paragraph("Фильтры отчёта:")
        for k, v in filters.items():
            doc.add_paragraph(f"{k.replace('_', ' ').title()}: {v}")
        doc.add_paragraph()

    if not data:
        p = doc.add_paragraph("Нет данных для отчёта.")
        output = BytesIO()
        doc.save(output)
        output.seek(0)
        return output

    # Table
    table = doc.add_table(rows=1, cols=len(data[0]), style='Table Grid')
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Headers
    headers = list(data[0].keys())
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header.replace('_', ' ').title()
        hdr_cells[i].paragraphs[0].runs[0].bold = True

    # Data
    for item in data:
        row_cells = table.add_row().cells
        for i, key in enumerate(headers):
            value = item.get(key, '')
            if isinstance(value, dict):
                value = str(value)
            row_cells[i].text = str(value)

    output = BytesIO()
    doc.save(output)
    output.seek(0)
    return output

