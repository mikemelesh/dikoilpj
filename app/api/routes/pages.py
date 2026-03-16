from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.core.config import settings


templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)
router = APIRouter(tags=["pages"])


@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/services", response_class=HTMLResponse)
async def services_page(request: Request):
    return templates.TemplateResponse("services.html", {"request": request})


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@router.get("/cabinet", response_class=HTMLResponse)
async def cabinet_page(request: Request):
    return templates.TemplateResponse("cabinet.html", {"request": request})

