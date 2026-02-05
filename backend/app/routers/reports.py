from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case, distinct, and_
from typing import List
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
)


@router.get("/salespeople", response_model=List[schemas.Salesperson])
async def get_salespeople(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User.id, models.User.name).order_by(models.User.name)
    )
    rows = result.all()
    return [schemas.Salesperson(id=row.id, name=row.name) for row in rows]

@router.get("/sales-metrics", response_model=schemas.SalesMetrics)
async def get_sales_metrics(
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    customer_id: int | None = None,
    salesperson_id: int | None = None,
    channel: str | None = None,
    product_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now()
    if period_end is None:
        period_end = now
    else:
        # If it's a date only, ensure it includes the whole day
        if period_end.hour == 0 and period_end.minute == 0 and period_end.second == 0:
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)

    if period_start is None:
        period_start = datetime(now.year, now.month, 1)

    # Base conditions (filters except date)
    base_conditions = []
    if customer_id:
        base_conditions.append(models.Order.customer_id == customer_id)
    if salesperson_id:
        base_conditions.append(models.Order.salesperson_id == salesperson_id)
    if channel:
        if channel.lower() == "whatsapp":
            base_conditions.append(models.Order.payment_method == models.PaymentMethod.PIX)
        elif channel.lower() == "balcão":
            base_conditions.append(models.Order.payment_method != models.PaymentMethod.PIX)
    
    if product_name:
        # Optimized: Create subquery once if needed, but here we can just join if we are careful, 
        # or stick to subquery logic but applied consistently.
        # Subquery is safer for "Order has at least one item with product_name" logic without duplicating Order rows in main query
        product_order_ids_subq = (
            select(models.OrderItem.order_id)
            .where(models.OrderItem.product_name.ilike(f"%{product_name}%"))
            .distinct()
        )
        base_conditions.append(models.Order.id.in_(product_order_ids_subq))

    # --- 1. Main Period Summary (Revenue + Orders) ---
    summary_conditions = base_conditions + [
        models.Order.created_at >= period_start,
        models.Order.created_at <= period_end,
    ]
    
    # --- 2. Cost for Main Period ---
    # Cost requires join with OrderItem. If we filter by product_name, we only sum cost of matching items or all items in matching orders?
    # Original logic: 
    #   product_order_ids_subq filters ORDERS. 
    #   Then cost query joins OrderItem and sums cost. 
    #   So it sums cost of ALL items in the filtered orders.
    
    summary_query = select(
        func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
        func.count(models.Order.id).label("orders"),
    ).where(*summary_conditions)

    cost_query = select(
        func.coalesce(func.sum(models.OrderItem.cost * models.OrderItem.quantity), 0.0).label("total_cost")
    ).join(models.Order, models.OrderItem.order_id == models.Order.id).where(*summary_conditions)

    # --- 3. Fixed Periods (Today, Week, Month, Previous Month) ---
    # We can combine these into one query on Order table for Revenue/Orders
    # And one query on OrderItem table for Costs
    
    today_start = datetime(now.year, now.month, now.day)
    tomorrow_start = today_start + timedelta(days=1)
    
    week_start = today_start - timedelta(days=today_start.weekday())
    next_week_start = week_start + timedelta(days=7)
    
    current_month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1)

    if now.month == 1:
        previous_month_start = datetime(now.year - 1, 12, 1)
    else:
        previous_month_start = datetime(now.year, now.month - 1, 1)
    
    # Combined Metrics Query (Revenue & Orders for all fixed periods)
    metrics_query = select(
        # Today
        func.coalesce(func.sum(case((and_(models.Order.created_at >= today_start, models.Order.created_at < tomorrow_start), models.Order.total_amount), else_=0)), 0).label("rev_today"),
        func.count(case((and_(models.Order.created_at >= today_start, models.Order.created_at < tomorrow_start), models.Order.id))).label("ord_today"),
        
        # Week
        func.coalesce(func.sum(case((and_(models.Order.created_at >= week_start, models.Order.created_at < next_week_start), models.Order.total_amount), else_=0)), 0).label("rev_week"),
        func.count(case((and_(models.Order.created_at >= week_start, models.Order.created_at < next_week_start), models.Order.id))).label("ord_week"),
        
        # Current Month
        func.coalesce(func.sum(case((and_(models.Order.created_at >= current_month_start, models.Order.created_at < next_month_start), models.Order.total_amount), else_=0)), 0).label("rev_month"),
        func.count(case((and_(models.Order.created_at >= current_month_start, models.Order.created_at < next_month_start), models.Order.id))).label("ord_month"),
        
        # Previous Month
        func.coalesce(func.sum(case((and_(models.Order.created_at >= previous_month_start, models.Order.created_at < current_month_start), models.Order.total_amount), else_=0)), 0).label("rev_prev_month"),
        func.count(case((and_(models.Order.created_at >= previous_month_start, models.Order.created_at < current_month_start), models.Order.id))).label("ord_prev_month"),
    ).where(*base_conditions) # Apply base filters (customer, channel, etc) to all these

    # Combined Cost Query (Cost for all fixed periods)
    cost_metrics_query = select(
        # Today Cost
        func.coalesce(func.sum(case((and_(models.Order.created_at >= today_start, models.Order.created_at < tomorrow_start), models.OrderItem.cost * models.OrderItem.quantity), else_=0)), 0).label("cost_today"),
        # Week Cost
        func.coalesce(func.sum(case((and_(models.Order.created_at >= week_start, models.Order.created_at < next_week_start), models.OrderItem.cost * models.OrderItem.quantity), else_=0)), 0).label("cost_week"),
        # Month Cost
        func.coalesce(func.sum(case((and_(models.Order.created_at >= current_month_start, models.Order.created_at < next_month_start), models.OrderItem.cost * models.OrderItem.quantity), else_=0)), 0).label("cost_month"),
    ).join(models.Order, models.OrderItem.order_id == models.Order.id).where(*base_conditions)

    # Execute main aggregates
    # We can run these in parallel logically, but async session executes sequentially on connection
    summary_res = await db.execute(summary_query)
    cost_res = await db.execute(cost_query)
    metrics_res = await db.execute(metrics_query)
    cost_metrics_res = await db.execute(cost_metrics_query)

    summary_row = summary_res.one()
    total_cost_row = cost_res.one()
    metrics_row = metrics_res.one()
    cost_metrics_row = cost_metrics_res.one()

    # Process Summary
    revenue = float(summary_row.revenue or 0.0)
    orders = int(summary_row.orders or 0)
    total_cost = float(total_cost_row.total_cost or 0.0)
    ticket_medio = float(revenue / orders) if orders > 0 else 0.0
    gross_profit = revenue - total_cost
    average_margin = float(gross_profit / orders) if orders > 0 else 0.0
    
    summary = schemas.SalesSummary(
        revenue=revenue,
        orders=orders,
        ticket_medio=ticket_medio,
        average_margin=average_margin,
        total_discount=0.0,
        total_cost=total_cost,
        gross_profit=gross_profit,
    )

    # Process Fixed Periods
    # Today
    rev_today = float(metrics_row.rev_today)
    ord_today = int(metrics_row.ord_today)
    cost_today = float(cost_metrics_row.cost_today)
    profit_today = rev_today - cost_today

    # Week
    rev_week = float(metrics_row.rev_week)
    ord_week = int(metrics_row.ord_week)
    cost_week = float(cost_metrics_row.cost_week)
    profit_week = rev_week - cost_week

    # Month
    rev_month = float(metrics_row.rev_month)
    ord_month = int(metrics_row.ord_month)
    cost_month = float(cost_metrics_row.cost_month)
    profit_month = rev_month - cost_month

    # Comparison (Current vs Previous Month)
    rev_prev_month = float(metrics_row.rev_prev_month)
    ord_prev_month = int(metrics_row.ord_prev_month)
    
    comparison = schemas.MonthComparison(
        current_revenue=rev_month,
        previous_revenue=rev_prev_month,
        current_orders=ord_month,
        previous_orders=ord_prev_month,
    )

    # --- Charts (Group By) ---
    # These remain separate queries as they return lists
    
    # By Day
    by_day_result = await db.execute(
        select(
            func.date_trunc("day", models.Order.created_at).label("date"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
            func.count(models.Order.id).label("orders"),
        )
        .where(*summary_conditions)
        .group_by("date")
        .order_by("date")
    )
    by_day = [
        schemas.SalesTimeSeries(date=row.date, revenue=float(row.revenue), orders=int(row.orders))
        for row in by_day_result.all()
    ]

    # By Week
    by_week_result = await db.execute(
        select(
            func.date_trunc("week", models.Order.created_at).label("date"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
            func.count(models.Order.id).label("orders"),
        )
        .where(*summary_conditions)
        .group_by("date")
        .order_by("date")
    )
    by_week = [
        schemas.SalesTimeSeries(date=row.date, revenue=float(row.revenue), orders=int(row.orders))
        for row in by_week_result.all()
    ]

    # By Month
    by_month_result = await db.execute(
        select(
            func.date_trunc("month", models.Order.created_at).label("date"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
            func.count(models.Order.id).label("orders"),
        )
        .where(*summary_conditions)
        .group_by("date")
        .order_by("date")
    )
    by_month = [
        schemas.SalesTimeSeries(date=row.date, revenue=float(row.revenue), orders=int(row.orders))
        for row in by_month_result.all()
    ]

    # By Payment Method
    payment_result = await db.execute(
        select(
            models.Order.payment_method,
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("total"),
            func.count(models.Order.id).label("count"),
        )
        .where(*summary_conditions)
        .group_by(models.Order.payment_method)
    )
    by_payment_method = []
    channel_totals: dict[str, float] = {}
    
    for row in payment_result.all():
        method_name = row.payment_method.value if row.payment_method else "unknown"
        total = float(row.total or 0.0)
        by_payment_method.append(
            schemas.SalesByPaymentMethod(
                payment_method=method_name,
                total=total,
                count=int(row.count or 0),
            )
        )
        # Channel logic
        chan = "WhatsApp" if method_name == models.PaymentMethod.PIX.value else "Balcão"
        channel_totals[chan] = channel_totals.get(chan, 0.0) + total

    by_channel = [
        schemas.SalesByChannel(channel=name, total=total, percentage=0.0)
        for name, total in channel_totals.items()
    ]
    total_channel_revenue = sum(c.total for c in by_channel)
    for c in by_channel:
        if total_channel_revenue > 0:
            c.percentage = (c.total / total_channel_revenue) * 100

    # By Product
    product_result = await db.execute(
        select(
            models.OrderItem.product_name,
            func.coalesce(func.sum(models.OrderItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(models.OrderItem.unit_price * models.OrderItem.quantity), 0.0).label("total_revenue"),
            func.coalesce(func.sum(models.OrderItem.cost * models.OrderItem.quantity), 0.0).label("total_cost"),
        )
        .join(models.Order, models.OrderItem.order_id == models.Order.id)
        .where(*summary_conditions)
        .group_by(models.OrderItem.product_name)
    )
    by_product = []
    for row in product_result.all():
        if not row.product_name: continue
        rev = float(row.total_revenue)
        cost = float(row.total_cost)
        prof = rev - cost
        margin = (prof / rev * 100) if rev > 0 else 0.0
        by_product.append(schemas.SalesByProduct(
            product_name=row.product_name,
            quantity=int(row.quantity),
            total_revenue=rev,
            total_cost=cost,
            total_profit=prof,
            margin_percent=margin
        ))

    # By Hour (Garantir 24 horas)
    by_hour_result = await db.execute(
        select(
            func.extract("hour", models.Order.created_at).label("hour"),
            func.count(models.Order.id).label("count"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
        )
        .where(*summary_conditions)
        .group_by("hour")
        .order_by("hour")
    )
    
    hour_data = {int(row.hour): row for row in by_hour_result.all()}
    by_hour = []
    for h in range(24):
        if h in hour_data:
            row = hour_data[h]
            by_hour.append(schemas.SalesByHour(hour=h, count=int(row.count), revenue=float(row.revenue)))
        else:
            by_hour.append(schemas.SalesByHour(hour=h, count=0, revenue=0.0))

    # By Weekday
    weekday_result = await db.execute(
        select(
            func.extract("dow", models.Order.created_at).label("day_of_week"),
            func.count(models.Order.id).label("count"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("revenue"),
        )
        .where(*summary_conditions)
        .group_by("day_of_week")
        .order_by("day_of_week")
    )
    weekday_names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    by_weekday = []
    for row in weekday_result.all():
        idx = int(row.day_of_week)
        name = weekday_names[idx] if 0 <= idx < len(weekday_names) else str(idx)
        by_weekday.append(schemas.SalesByWeekDay(
            day_of_week=idx, day_name=name, count=int(row.count), revenue=float(row.revenue)
        ))

    return schemas.SalesMetrics(
        period_start=period_start,
        period_end=period_end,
        summary=summary,
        by_day=by_day,
        by_week=by_week,
        by_month=by_month,
        comparison=comparison,
        by_payment_method=by_payment_method,
        by_channel=by_channel,
        by_product=by_product,
        by_hour=by_hour,
        by_weekday=by_weekday,
        today=schemas.PeriodFinancial(revenue=rev_today, gross_profit=profit_today, orders=ord_today),
        current_week=schemas.PeriodFinancial(revenue=rev_week, gross_profit=profit_week, orders=ord_week),
        current_month=schemas.PeriodFinancial(revenue=rev_month, gross_profit=profit_month, orders=ord_month),
    )

@router.get("/orders-report", response_model=List[schemas.OrderReportItem])
async def get_orders_report(
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    customer_id: int | None = None,
    salesperson_id: int | None = None,
    channel: str | None = None,
    product_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now()
    if period_end is None:
        period_end = now
    if period_start is None:
        period_start = datetime(now.year, now.month, 1)

    conditions = [
        models.Order.created_at >= period_start,
        models.Order.created_at <= period_end,
    ]
    if customer_id:
        conditions.append(models.Order.customer_id == customer_id)
    if salesperson_id:
        conditions.append(models.Order.salesperson_id == salesperson_id)
    if channel:
        if channel.lower() == "whatsapp":
            conditions.append(models.Order.payment_method == models.PaymentMethod.PIX)
        elif channel.lower() == "balcão":
            conditions.append(models.Order.payment_method != models.PaymentMethod.PIX)

    if product_name:
        product_order_ids_subq = (
            select(models.OrderItem.order_id)
            .join(models.Order, models.OrderItem.order_id == models.Order.id)
            .where(
                models.OrderItem.product_name.ilike(f"%{product_name}%"),
                *conditions,
            )
            .distinct()
        )
        conditions.append(models.Order.id.in_(product_order_ids_subq))

    query = (
        select(
            models.Order.id,
            models.Order.created_at,
            models.Customer.name.label("customer_name"),
            models.User.name.label("salesperson_name"),
            models.Order.total_amount,
            models.Order.status,
            models.Order.payment_method,
            func.count(models.OrderItem.id).label("items_count")
        )
        .join(models.Customer, models.Order.customer_id == models.Customer.id)
        .join(models.User, models.Order.salesperson_id == models.User.id)
        .outerjoin(models.OrderItem, models.Order.id == models.OrderItem.order_id)
        .where(*conditions)
        .group_by(models.Order.id, models.Customer.name, models.User.name)
        .order_by(desc(models.Order.created_at))
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        schemas.OrderReportItem(
            id=row.id,
            created_at=row.created_at,
            customer_name=row.customer_name,
            salesperson_name=row.salesperson_name,
            total_amount=float(row.total_amount or 0.0),
            status=row.status.value if row.status else "unknown",
            payment_method=row.payment_method.value if row.payment_method else None,
            items_count=int(row.items_count or 0)
        )
        for row in rows
    ]

@router.get("/service-metrics", response_model=schemas.ServiceMetrics)
async def get_service_metrics(
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now()
    if period_end is None:
        period_end = now
    else:
        if period_end.hour == 0 and period_end.minute == 0 and period_end.second == 0:
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)

    if period_start is None:
        period_start = datetime(now.year, now.month, 1)

    # Total conversations in period
    total_conv_result = await db.execute(
        select(func.count(models.Conversation.id))
        .where(
            models.Conversation.created_at >= period_start,
            models.Conversation.created_at <= period_end
        )
    )
    total_conversations = int(total_conv_result.scalar_one() or 0)

    # Open conversations (current state, maybe not strictly period bound but useful context)
    # If we want created in period AND currently open:
    open_conv_result = await db.execute(
        select(func.count(models.Conversation.id))
        .where(
            models.Conversation.created_at >= period_start,
            models.Conversation.created_at <= period_end,
            models.Conversation.status == "open"
        )
    )
    open_conversations = int(open_conv_result.scalar_one() or 0)
    
    closed_conversations = total_conversations - open_conversations

    # Total messages in period
    total_msg_result = await db.execute(
        select(func.count(models.Message.id))
        .where(
            models.Message.timestamp >= period_start,
            models.Message.timestamp <= period_end
        )
    )
    total_messages = int(total_msg_result.scalar_one() or 0)

    avg_messages = float(total_messages) / float(total_conversations) if total_conversations > 0 else 0.0

    return schemas.ServiceMetrics(
        total_conversations=total_conversations,
        open_conversations=open_conversations,
        closed_conversations=closed_conversations,
        total_messages=total_messages,
        avg_messages_per_conversation=avg_messages
    )



@router.get("/customer-metrics", response_model=schemas.CustomerMetrics)
async def get_customer_metrics(
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now()
    if period_end is None:
        period_end = now
    else:
        if period_end.hour == 0 and period_end.minute == 0 and period_end.second == 0:
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)

    if period_start is None:
        # Default for metrics if not provided is the last 90 days
        period_start = now - timedelta(days=90)

    # Determine grouping based on period length
    diff_days = (period_end - period_start).days
    grouping = "day" if diff_days <= 62 else "month"

    total_customers_result = await db.execute(
        select(func.count(models.Customer.id))
    )
    total_customers = int(total_customers_result.scalar_one() or 0)

    orders_period_result = await db.execute(
        select(
            models.Order.customer_id,
            func.count(models.Order.id).label("orders_count"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("total_revenue"),
        )
        .where(
            models.Order.created_at >= period_start,
            models.Order.created_at <= period_end,
        )
        .group_by(models.Order.customer_id)
    )
    orders_rows = orders_period_result.all()

    customers_with_orders = len(orders_rows)
    total_orders_period = sum(int(r.orders_count or 0) for r in orders_rows)
    total_revenue_period = sum(float(r.total_revenue or 0.0) for r in orders_rows)

    active_customers = customers_with_orders
    inactive_customers = max(total_customers - active_customers, 0)

    repeat_customers = sum(1 for r in orders_rows if int(r.orders_count or 0) >= 2)
    occasional_customers = sum(1 for r in orders_rows if 0 < int(r.orders_count or 0) < 2)

    repeat_rate = (
        float(repeat_customers) / float(customers_with_orders)
        if customers_with_orders > 0
        else 0.0
    )

    avg_orders_per_customer = (
        float(total_orders_period) / float(customers_with_orders)
        if customers_with_orders > 0
        else 0.0
    )

    avg_ticket_per_customer = (
        float(total_revenue_period) / float(customers_with_orders)
        if customers_with_orders > 0
        else 0.0
    )

    new_customers_result = await db.execute(
        select(func.count(models.Customer.id)).where(
            models.Customer.created_at >= period_start,
            models.Customer.created_at <= period_end,
        )
    )
    new_customers = int(new_customers_result.scalar_one() or 0)

    summary = schemas.CustomerSummary(
        total_customers=total_customers,
        active_customers=active_customers,
        inactive_customers=inactive_customers,
        new_customers=new_customers,
        repeat_rate=repeat_rate,
        avg_orders_per_customer=avg_orders_per_customer,
        avg_ticket_per_customer=avg_ticket_per_customer,
        recurring_customers=repeat_customers,
        occasional_customers=occasional_customers,
    )

    new_by_period_result = await db.execute(
        select(
            func.date_trunc(grouping, models.Customer.created_at).label("date"),
            func.count(models.Customer.id).label("count"),
        )
        .where(
            models.Customer.created_at >= period_start,
            models.Customer.created_at <= period_end,
        )
        .group_by("date")
        .order_by("date")
    )
    new_by_period_rows = new_by_period_result.all()
    new_customers_by_period = [
        schemas.CustomersTimeSeries(
            date=row.date,
            count=int(row.count or 0),
        )
        for row in new_by_period_rows
    ]

    top_customers_result = await db.execute(
        select(
            models.Customer.id.label("customer_id"),
            models.Customer.name,
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("total_revenue"),
            func.count(models.Order.id).label("orders_count"),
        )
        .join(models.Order, models.Order.customer_id == models.Customer.id)
        .where(
            models.Order.created_at >= period_start,
            models.Order.created_at <= period_end,
        )
        .group_by(models.Customer.id, models.Customer.name)
        .order_by(desc("total_revenue"))
        .limit(10)
    )
    top_rows = top_customers_result.all()
    top_customers = []
    for row in top_rows:
        revenue = float(row.total_revenue or 0.0)
        orders_count = int(row.orders_count or 0)
        if orders_count > 0:
            avg_ticket = revenue / float(orders_count)
        else:
            avg_ticket = 0.0
        top_customers.append(
            schemas.TopCustomer(
                customer_id=row.customer_id,
                name=row.name,
                total_revenue=revenue,
                orders_count=orders_count,
                avg_ticket=avg_ticket,
            )
        )

    return schemas.CustomerMetrics(
        period_start=period_start,
        period_end=period_end,
        summary=summary,
        new_customers_by_period=new_customers_by_period,
        top_customers=top_customers,
    )
