"""
Роутер для калькулятора услуг.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.client import Client
from ..models.order import OrderStatus
from ..models.promotion import Promotion, PromotionAppliesTo
from ..models.service import Service
from ..schemas.calculator import (
    CalculatedItem,
    CalculatorRequest,
    CalculatorResponse,
    PromotionInfo,
)

router = APIRouter(prefix="/calculator", tags=["calculator"])


@router.post("/calculate", response_model=CalculatorResponse)
async def calculate_order(
    request: CalculatorRequest,
    db: Session = Depends(get_db),
):
    """
    Рассчитать стоимость заказа.
    Публичный эндпоинт.
    
    - items: список услуг и количества
    - client_id: опционально для применения скидки клиента
    """
    # Проверяем услуги и считаем сумму
    calculated_items: List[CalculatedItem] = []
    subtotal = Decimal("0.00")
    
    for item_req in request.items:
        service = db.query(Service).filter(Service.id == item_req.service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Услуга с ID {item_req.service_id} не найдена"
            )
        if not service.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Услуга '{service.name}' неактивна"
            )
        
        item_total = service.base_price * item_req.quantity
        subtotal += item_total
        
        calculated_items.append(CalculatedItem(
            service_id=service.id,
            service_name=service.name,
            quantity=item_req.quantity,
            unit_price=service.base_price,
            total=item_total,
        ))
    
    # Определяем скидку клиента
    discount_percent = 0.0
    if request.client_id:
        client = db.query(Client).filter(Client.id == request.client_id).first()
        if client:
            discount_percent = client.discount_percent or 0.0
    
    # Находим активные акции
    today = date.today()
    active_promotions = db.query(Promotion).filter(
        Promotion.is_active == True,
        Promotion.start_date <= today,
        Promotion.end_date >= today,
    ).all()
    
    # Применяем акции (максимальная скидка)
    max_promo_discount = 0.0
    promotion_info_list: List[PromotionInfo] = []
    
    for promo in active_promotions:
        applies = False
        
        if promo.applies_to == PromotionAppliesTo.ALL:
            applies = True
        elif promo.applies_to == PromotionAppliesTo.SERVICE:
            # Проверяем, есть ли в заказе услуга с target_id
            for item_req in request.items:
                if item_req.service_id == promo.target_id:
                    applies = True
                    break
        elif promo.applies_to == PromotionAppliesTo.CATEGORY:
            # Проверяем категорию услуги
            for item_req in request.items:
                service = db.query(Service).filter(Service.id == item_req.service_id).first()
                if service and service.category_id == promo.target_id:
                    applies = True
                    break
        
        if applies:
            promotion_info_list.append(PromotionInfo(
                id=promo.id,
                title=promo.title,
                discount_percent=promo.discount_percent,
                applies_to=promo.applies_to.value,
            ))
            max_promo_discount = max(max_promo_discount, promo.discount_percent)
    
    # Используем максимальную скидку (клиент или акция)
    final_discount_percent = max(discount_percent, max_promo_discount)
    discount_amount = subtotal * Decimal(str(final_discount_percent)) / Decimal("100")
    final_price = subtotal - discount_amount
    
    return CalculatorResponse(
        items=calculated_items,
        subtotal=subtotal,
        discount_percent=final_discount_percent,
        discount_amount=discount_amount,
        active_promotions=promotion_info_list,
        final_price=final_price,
    )
