from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)

@router.post("/", response_model=schemas.Order)
async def create_order(order: schemas.OrderCreate, db: AsyncSession = Depends(get_db)):
    # Criar o pedido
    db_order = models.Order(
        customer_id=order.customer_id,
        total_amount=order.total_amount,
        status=order.status,
        payment_method=order.payment_method
    )
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)

    for item in order.items:
        db_item = models.OrderItem(
            order_id=db_order.id,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        db.add(db_item)
    
    await db.commit()
    
    # Recarregar o pedido com os itens
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.id == db_order.id)
    )
    return result.scalars().first()

@router.get("/", response_model=List[schemas.Order])
async def read_orders(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .options(selectinload(models.Order.customer))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{order_id}", response_model=schemas.Order)
async def read_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .options(selectinload(models.Order.customer))
        .where(models.Order.id == order_id)
    )
    order = result.scalars().first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
