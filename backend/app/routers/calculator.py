"""
Роутер для калькулятора услуг.
"""
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.client import Client
from ..models.service import Service
from ..schemas.calculator import (
    CalculatedItem,
    CalculatorRequest,
    CalculatorResponse,
    PromotionInfo,
)
from ..utils.discounts import calculate_discounts_for_client_order

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
    calculated_items: List[CalculatedItem] = []
    subtotal = Decimal("0.00")
    service_ids: List[int] = []
    
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
        service_ids.append(service.id)
        
        calculated_items.append(CalculatedItem(
            service_id=service.id,
            service_name=service.name,
            quantity=item_req.quantity,
            unit_price=service.base_price,
            total=item_total,
        ))
    
    client = None
    if request.client_id:
        client = db.query(Client).filter(Client.id == request.client_id).first()

    breakdown = calculate_discounts_for_client_order(
        db,
        subtotal,
        service_ids,
        client=client,
    )

    promotion_info_list = [
        PromotionInfo(
            id=promo.id,
            title=promo.title,
            discount_percent=promo.discount_percent,
            applies_to=promo.applies_to,
        )
        for promo in breakdown.active_promotions
    ]
    
    return CalculatorResponse(
        items=calculated_items,
        subtotal=subtotal,
        discount_percent=breakdown.discount_percent,
        discount_amount=breakdown.discount_amount,
        loyalty_discount_percent=breakdown.loyalty_discount_percent,
        promotion_discount_percent=breakdown.promotion_discount_percent,
        discount_source=breakdown.discount_source,
        applied_promotion_title=breakdown.applied_promotion_title,
        active_promotions=promotion_info_list,
        final_price=breakdown.final_price,
    )
