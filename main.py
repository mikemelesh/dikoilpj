from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from datetime import datetime, timedelta
from typing import Optional, List
from jose import jwt
from jose.exceptions import JWTError
import enum
import bcrypt
from pydantic import BaseModel, EmailStr

# Настройки
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# База данных
SQLALCHEMY_DATABASE_URL = "sqlite:///./dental_lab.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enums
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    TECHNICIAN = "technician"
    LEGAL_CLIENT = "legal_client"
    INDIVIDUAL_CLIENT = "individual_client"

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentType(str, enum.Enum):
    CASH = "cash"
    CASHLESS = "cashless"
    PREPAYMENT = "prepayment"

# Модели базы данных
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(Enum(UserRole))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Для юр. лиц
    company_name = Column(String, nullable=True)
    unp = Column(String, nullable=True)  # УНП для РБ
    company_address = Column(String, nullable=True)
    
    orders = relationship("Order", back_populates="client", foreign_keys="Order.client_id")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    base_price = Column(Float)
    material = Column(String)
    production_time_days = Column(Integer)
    category = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order_items = relationship("OrderItem", back_populates="service")

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(Text)
    unit = Column(String)  # кг, шт, л и т.д.
    price_per_unit = Column(Float)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    
    supplier = relationship("Supplier", back_populates="materials")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(String)
    
    materials = relationship("Material", back_populates="supplier")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"))
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    payment_type = Column(Enum(PaymentType))
    total_price = Column(Float, default=0)
    notes = Column(Text, nullable=True)
    rejection_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    client = relationship("User", back_populates="orders", foreign_keys=[client_id])
    technician = relationship("User", foreign_keys=[technician_id])
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    service_id = Column(Integer, ForeignKey("services.id"))
    quantity = Column(Integer, default=1)
    unit_price = Column(Float)
    notes = Column(Text, nullable=True)
    
    order = relationship("Order", back_populates="items")
    service = relationship("Service", back_populates="order_items")

# Создание таблиц
Base.metadata.create_all(bind=engine)

# Pydantic модели
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: UserRole
    company_name: Optional[str] = None
    unp: Optional[str] = None
    company_address: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class ServiceCreate(BaseModel):
    name: str
    description: str
    base_price: float
    material: str
    production_time_days: int
    category: str

class OrderCreate(BaseModel):
    service_ids: List[int]
    quantities: List[int]
    payment_type: PaymentType
    notes: Optional[str] = None

class OrderApprovalRequest(BaseModel):
    approved: bool
    message: Optional[str] = None

# Утилиты
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    # Clean up the hash - remove any whitespace
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.strip()
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (UnknownHashError, Exception):
        # Fallback to direct bcrypt verification if passlib fails
        try:
            # Ensure both are bytes for bcrypt
            if isinstance(hashed_password, str):
                hashed_password_bytes = hashed_password.encode('utf-8')
            else:
                hashed_password_bytes = hashed_password
            if isinstance(plain_password, str):
                plain_password_bytes = plain_password.encode('utf-8')
            else:
                plain_password_bytes = plain_password
            return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)
        except Exception:
            return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Инициализация приложения
app = FastAPI(title="Dental Lab API")
templates = Jinja2Templates(directory="./templates")

# Создание тестовых данных
def init_db():
    # Add rejection_message column if it doesn't exist
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE orders ADD COLUMN rejection_message TEXT"))
            conn.commit()
    except Exception:
        pass  # Column already exists or table doesn't exist yet
    
    db = SessionLocal()
    
    # Проверка существования админа
    admin = db.query(User).filter(User.email == "admin@dentallab.by").first()
    if not admin:
        admin = User(
            email="admin@dentallab.by",
            hashed_password=get_password_hash("admin123"),
            full_name="Администратор",
            phone="+375291234567",
            role=UserRole.ADMIN
        )
        db.add(admin)
    
    # Добавление услуг
    if db.query(Service).count() == 0:
        services = [
            Service(
                name="Металлокерамическая коронка",
                description="Прочная коронка на основе металлического каркаса с керамическим покрытием",
                base_price=150.0,
                material="Металлокерамика",
                production_time_days=7,
                category="Коронки"
            ),
            Service(
                name="Циркониевая коронка",
                description="Эстетичная и прочная коронка из диоксида циркония",
                base_price=300.0,
                material="Диоксид циркония",
                production_time_days=10,
                category="Коронки"
            ),
            Service(
                name="Съемный протез полный",
                description="Полный съемный протез на верхнюю или нижнюю челюсть",
                base_price=500.0,
                material="Акриловая пластмасса",
                production_time_days=14,
                category="Протезы"
            ),
            Service(
                name="Бюгельный протез",
                description="Частичный съемный протез с металлическим каркасом",
                base_price=700.0,
                material="Металл + акрил",
                production_time_days=14,
                category="Протезы"
            ),
            Service(
                name="Керамический винир",
                description="Тонкая керамическая накладка для эстетической реставрации",
                base_price=250.0,
                material="Керамика E-max",
                production_time_days=7,
                category="Виниры"
            ),
            Service(
                name="Вкладка культевая",
                description="Литая культевая вкладка под коронку",
                base_price=80.0,
                material="Кобальт-хром",
                production_time_days=5,
                category="Вкладки"
            ),
            Service(
                name="Временная коронка",
                description="Временная пластмассовая коронка",
                base_price=30.0,
                material="Пластмасса",
                production_time_days=2,
                category="Коронки"
            )
        ]
        db.add_all(services)
    
    db.commit()
    db.close()

# API endpoints
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        company_name=user.company_name,
        unp=user.unp,
        company_address=user.company_address
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(
        data={"sub": new_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "role": new_user.role.value}

@app.post("/api/login", response_model=Token)
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not db_user.hashed_password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "role": db_user.role.value}

@app.get("/api/services")
async def get_services(db: Session = Depends(get_db)):
    services = db.query(Service).filter(Service.is_active == True).all()
    return services

@app.get("/service/{service_id}", response_class=HTMLResponse)
async def service_detail_page(service_id: int, request: Request):
    return templates.TemplateResponse("service_detail.html", {"request": request})

@app.post("/api/services")
async def create_service(service: ServiceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    new_service = Service(**service.dict())
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service

@app.post("/api/orders")
async def create_order(order: OrderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Генерация номера заказа
    order_count = db.query(Order).count() + 1
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{order_count:04d}"
    
    new_order = Order(
        order_number=order_number,
        client_id=current_user.id,
        payment_type=order.payment_type,
        notes=order.notes,
        status=OrderStatus.PENDING
    )
    db.add(new_order)
    db.flush()
    
    total = 0
    for service_id, quantity in zip(order.service_ids, order.quantities):
        service = db.query(Service).filter(Service.id == service_id).first()
        if service:
            item = OrderItem(
                order_id=new_order.id,
                service_id=service_id,
                quantity=quantity,
                unit_price=service.base_price
            )
            db.add(item)
            total += service.base_price * quantity
    
    new_order.total_price = total
    db.commit()
    db.refresh(new_order)
    return new_order

@app.get("/api/orders")
async def get_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
        orders = db.query(Order).all()
    elif current_user.role == UserRole.TECHNICIAN:
        orders = db.query(Order).filter(Order.technician_id == current_user.id).all()
    else:
        orders = db.query(Order).filter(Order.client_id == current_user.id).all()
    
    # Convert to dict and include client info
    result = []
    for order in orders:
        order_dict = {
            "id": order.id,
            "order_number": order.order_number,
            "client_id": order.client_id,
            "technician_id": order.technician_id,
            "status": order.status.value if isinstance(order.status, OrderStatus) else str(order.status),
            "payment_type": order.payment_type.value if isinstance(order.payment_type, PaymentType) else str(order.payment_type),
            "total_price": float(order.total_price),
            "notes": order.notes,
            "rejection_message": getattr(order, 'rejection_message', None),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "approved_at": order.approved_at.isoformat() if order.approved_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "client": {
                "id": order.client.id,
                "full_name": order.client.full_name,
                "email": order.client.email
            } if order.client else None,
            "items": [{"id": item.id, "service_id": item.service_id, "quantity": item.quantity, "unit_price": float(item.unit_price)} for item in order.items]
        }
        result.append(order_dict)
    return result

@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        if order.client_id != current_user.id and order.technician_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return order

@app.patch("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int, 
    status: OrderStatus, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    if status == OrderStatus.APPROVED:
        order.approved_at = datetime.utcnow()
        order.rejection_message = None
    elif status == OrderStatus.COMPLETED:
        order.completed_at = datetime.utcnow()
    
    db.commit()
    return order

@app.post("/api/orders/{order_id}/approve")
async def approve_or_reject_order(
    order_id: int,
    request: OrderApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if request.approved:
        order.status = OrderStatus.APPROVED
        order.approved_at = datetime.utcnow()
        order.rejection_message = None
    else:
        order.status = OrderStatus.CANCELLED
        order.rejection_message = request.message
    
    db.commit()
    db.refresh(order)
    return order

@app.get("/api/users")
async def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    users = db.query(User).all()
    return users

# HTML Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/services", response_class=HTMLResponse)
async def services_page(request: Request):
    return templates.TemplateResponse("services.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/cabinet", response_class=HTMLResponse)
async def cabinet_page(request: Request):
    return templates.TemplateResponse("cabinet.html", {"request": request})

@app.on_event("startup")
async def startup_event():
    init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)