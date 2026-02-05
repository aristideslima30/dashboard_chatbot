from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(
    prefix="/customers",
    tags=["customers"],
)

@router.post("/", response_model=schemas.Customer)
async def create_customer(customer: schemas.CustomerCreate, db: AsyncSession = Depends(get_db)):
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    try:
        await db.commit()
        await db.refresh(db_customer)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Customer already exists or invalid data")
    return db_customer

@router.get("/", response_model=List[schemas.Customer])
async def read_customers(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Customer).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{customer_id}", response_model=schemas.Customer)
async def read_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Customer).where(models.Customer.id == customer_id))
    customer = result.scalars().first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer
