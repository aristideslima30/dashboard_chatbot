from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, cast, Date, and_, desc, case
from typing import List
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
)


@router.get("/metrics", response_model=schemas.DashboardMetrics)
async def get_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)

    # Mês anterior para comparação
    if now.month == 1:
        previous_month_start = datetime(now.year - 1, 12, 1)
    else:
        previous_month_start = datetime(now.year, now.month - 1, 1)
    previous_month_end = month_start
    late_threshold = now - timedelta(hours=1)

    # 1. Query Agregada para métricas de Orders (Total, Today, Month, Previous Month, Status)
    # Usa func.filter (SQLAlchemy 1.4+) ou CASE WHEN para agregações condicionais numa única passada
    order_metrics_query = select(
        # All time
        func.coalesce(func.sum(models.Order.total_amount), 0).label("total_revenue"),
        func.count(models.Order.id).label("total_orders"),
        
        # Today
        func.coalesce(func.sum(case((models.Order.created_at >= today_start, models.Order.total_amount), else_=0)), 0).label("revenue_today"),
        func.count(case((models.Order.created_at >= today_start, models.Order.id))).label("orders_today"),
        
        # Current Month
        func.coalesce(func.sum(case((models.Order.created_at >= month_start, models.Order.total_amount), else_=0)), 0).label("revenue_month"),
        func.count(case((models.Order.created_at >= month_start, models.Order.id))).label("orders_month"),
        
        # Previous Month (Revenue only for growth calc)
        func.coalesce(func.sum(case(
            (and_(models.Order.created_at >= previous_month_start, models.Order.created_at < previous_month_end), models.Order.total_amount), 
            else_=0
        )), 0).label("revenue_previous_month"),

        # Operational KPIs
        func.count(case((models.Order.status == models.OrderStatus.PENDING, models.Order.id))).label("pending_orders"),
        func.count(case((models.Order.status.in_([models.OrderStatus.PREPARING, models.OrderStatus.DELIVERING]), models.Order.id))).label("in_progress_orders"),
        func.count(case(
            (and_(models.Order.status.in_([models.OrderStatus.PENDING, models.OrderStatus.PREPARING, models.OrderStatus.DELIVERING]), models.Order.created_at < late_threshold), models.Order.id)
        )).label("late_orders"),
        func.count(case(
            (and_(models.Order.created_at >= month_start, models.Order.status == models.OrderStatus.CANCELLED), models.Order.id)
        )).label("cancelled_orders_month"),
        func.count(case(
            (and_(models.Order.created_at >= month_start, models.Order.payment_method == models.PaymentMethod.PIX), models.Order.id)
        )).label("whatsapp_orders_month"),
    )

    # 2. Query para Active Conversations
    active_conversations_query = select(func.count(models.Conversation.id)).where(models.Conversation.status == "open")

    # 3. Query para Total Customers
    total_customers_query = select(func.count(models.Customer.id))

    # 4. Query para Cost Month (Lucro Bruto) - Join separado pois é com OrderItem
    cost_month_query = select(
        func.coalesce(func.sum(models.OrderItem.cost * models.OrderItem.quantity), 0.0).label("total_cost")
    ).join(models.Order, models.OrderItem.order_id == models.Order.id).where(models.Order.created_at >= month_start)

    # Executa as 4 queries principais (idealmente em paralelo se driver suportar, mas sequencial já é mto rápido pq são poucas)
    # Como AsyncSession execute é awaitable, vamos executar sequencialmente por simplicidade e robustez com SQLite/Drivers simples
    
    order_metrics_res = await db.execute(order_metrics_query)
    order_metrics = order_metrics_res.one()
    
    active_conversations = await db.scalar(active_conversations_query) or 0
    total_customers = await db.scalar(total_customers_query) or 0
    
    cost_month_res = await db.execute(cost_month_query)
    total_cost_month = float(cost_month_res.scalar() or 0.0)

    # Processa resultados
    total_revenue = float(order_metrics.total_revenue)
    total_orders = int(order_metrics.total_orders)
    revenue_today = float(order_metrics.revenue_today)
    orders_today = int(order_metrics.orders_today)
    revenue_month = float(order_metrics.revenue_month)
    orders_month = int(order_metrics.orders_month)
    revenue_previous_month = float(order_metrics.revenue_previous_month)
    
    pending_orders = int(order_metrics.pending_orders)
    in_progress_orders = int(order_metrics.in_progress_orders)
    late_orders = int(order_metrics.late_orders)
    cancelled_orders_month = int(order_metrics.cancelled_orders_month)
    whatsapp_orders_month = int(order_metrics.whatsapp_orders_month)

    # Derived Metrics
    ticket_medio = float(total_revenue / total_orders) if total_orders > 0 else 0.0
    
    gross_profit = revenue_month - total_cost_month
    gross_margin_percent = ((gross_profit / revenue_month) * 100.0) if revenue_month > 0 else 0.0
    
    if revenue_previous_month > 0:
        growth_vs_last_month_percent = ((revenue_month - revenue_previous_month) / revenue_previous_month) * 100.0
    else:
        growth_vs_last_month_percent = 0.0 if revenue_month == 0 else 100.0 # Se não tinha receita e agora tem, cresceu 100% (ou infinito)
        
    cancellation_rate = ((cancelled_orders_month / orders_month) * 100.0) if orders_month > 0 else 0.0
    whatsapp_orders_percentage = ((whatsapp_orders_month / orders_month) * 100.0) if orders_month > 0 else 0.0

    # Sales by Status (Group By)
    sales_by_status_result = await db.execute(
        select(models.Order.status, func.count(models.Order.id).label("count"))
        .group_by(models.Order.status)
    )
    sales_by_status = [
        schemas.SalesByStatus(status=row.status.value, count=row.count)
        for row in sales_by_status_result.all()
    ]

    # Channels Logic (Mocked based on revenue share as before, or improved logic)
    # Mantendo lógica anterior para consistência
    whatsapp_total = revenue_month * 0.4
    balcao_total = revenue_month * 0.6
    total_channel_revenue = whatsapp_total + balcao_total
    
    sales_by_channel = [
        schemas.SalesByChannel(channel="WhatsApp", total=whatsapp_total, percentage=(whatsapp_total/total_channel_revenue)*100 if total_channel_revenue > 0 else 0),
        schemas.SalesByChannel(channel="Balcão", total=balcao_total, percentage=(balcao_total/total_channel_revenue)*100 if total_channel_revenue > 0 else 0),
    ]

    # Sales by day (last 30 days)
    sales_by_day_result = await db.execute(
        select(
            func.date_trunc("day", models.Order.created_at).label("date"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("total"),
        )
        .group_by("date")
        .order_by("date")
        .limit(30)
    )
    sales_by_day = [
        schemas.SalesByDay(date=row.date, total=float(row.total))
        for row in sales_by_day_result.all()
    ]

    # Top Products (Top 5)
    top_products_result = await db.execute(
        select(
            models.OrderItem.product_name,
            func.sum(models.OrderItem.quantity).label("quantity"),
            func.sum(models.OrderItem.unit_price * models.OrderItem.quantity).label("total_revenue")
        )
        .join(models.Order, models.OrderItem.order_id == models.Order.id)
        .group_by(models.OrderItem.product_name)
        .order_by(desc("quantity"))
        .limit(5)
    )
    top_products = [
        schemas.TopProduct(
            product_name=row.product_name or "Unknown",
            quantity=int(row.quantity),
            total_revenue=float(row.total_revenue)
        )
        for row in top_products_result.all()
    ]

    return schemas.DashboardMetrics(
        total_revenue=total_revenue,
        total_orders=total_orders,
        total_customers=total_customers,
        ticket_medio=ticket_medio,
        revenue_today=revenue_today,
        revenue_month=revenue_month,
        orders_today=orders_today,
        orders_month=orders_month,
        gross_profit=gross_profit,
        gross_margin_percent=gross_margin_percent,
        growth_vs_last_month_percent=growth_vs_last_month_percent,
        active_conversations=active_conversations,
        pending_orders=pending_orders,
        in_progress_orders=in_progress_orders,
        late_orders=late_orders,
        cancellation_rate=cancellation_rate,
        whatsapp_orders_percentage=whatsapp_orders_percentage,
        sales_by_day=sales_by_day,
        sales_by_status=sales_by_status,
        sales_by_channel=sales_by_channel,
        top_products=top_products,
    )
