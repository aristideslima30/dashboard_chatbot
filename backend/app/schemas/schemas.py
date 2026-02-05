from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

# Enums
class OrderStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    DELIVERING = "delivering"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    PIX = "pix"

class SenderType(str, Enum):
    CUSTOMER = "customer"
    BOT = "bot"
    AGENT = "agent"

# --- Customer ---
class CustomerBase(BaseModel):
    name: str
    phone: str

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Order ---
class OrderItemBase(BaseModel):
    quantity: int
    unit_price: float

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    product_name: Optional[str] = None # Para facilitar exibição

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    customer_id: int
    total_amount: float
    status: OrderStatus
    payment_method: Optional[PaymentMethod] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class Order(OrderBase):
    id: int
    created_at: datetime
    items: List[OrderItem] = []
    customer: Optional[Customer] = None

    class Config:
        from_attributes = True

# --- Conversation ---
class MessageBase(BaseModel):
    content: str
    sender_type: SenderType

class MessageCreate(MessageBase):
    conversation_id: int

class Message(MessageBase):
    id: int
    conversation_id: int
    timestamp: datetime
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    customer_id: int
    status: str

class ConversationCreate(ConversationBase):
    order_id: Optional[int] = None

class Conversation(ConversationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[Message] = []
    customer: Optional[Customer] = None
    order_id: Optional[int] = None

    class Config:
        from_attributes = True

class SalesByDay(BaseModel):
    date: datetime
    total: float

class SalesByStatus(BaseModel):
    status: str
    count: int

class SalesByChannel(BaseModel):
    channel: str
    total: float
    percentage: float


class SalesSummary(BaseModel):
    revenue: float
    orders: int
    ticket_medio: float
    average_margin: float
    total_discount: float
    total_cost: float
    gross_profit: float

class SalesTimeSeries(BaseModel):
    date: datetime
    revenue: float
    orders: int


class SalesByPaymentMethod(BaseModel):
    payment_method: str
    total: float
    count: int


class MonthComparison(BaseModel):
    current_revenue: float
    previous_revenue: float
    current_orders: int
    previous_orders: int


class PeriodFinancial(BaseModel):
    revenue: float
    gross_profit: float
    orders: int

# Moved classes to be defined before usage in SalesMetrics
class SalesByProduct(BaseModel):
    product_name: str
    quantity: int
    total_revenue: float
    total_cost: float
    total_profit: float
    margin_percent: float

class SalesByHour(BaseModel):
    hour: int
    count: int
    revenue: float

class SalesByWeekDay(BaseModel):
    day_of_week: int  # 0=Sunday, 6=Saturday (or database specific)
    day_name: str
    count: int
    revenue: float

class SalesMetrics(BaseModel):
    period_start: datetime
    period_end: datetime
    summary: SalesSummary
    by_day: List[SalesTimeSeries]
    by_week: List[SalesTimeSeries]
    by_month: List[SalesTimeSeries]
    comparison: MonthComparison
    by_payment_method: List[SalesByPaymentMethod]
    by_channel: List[SalesByChannel]
    today: PeriodFinancial
    current_week: PeriodFinancial
    current_month: PeriodFinancial
    by_product: List[SalesByProduct]
    by_hour: List[SalesByHour]
    by_weekday: List[SalesByWeekDay]

class OrderReportItem(BaseModel):
    id: int
    created_at: datetime
    customer_name: str
    salesperson_name: Optional[str] = None
    total_amount: float
    status: str
    payment_method: Optional[str] = None
    items_count: int

class Salesperson(BaseModel):
    id: int
    name: str

class ServiceMetrics(BaseModel):
    total_conversations: int
    open_conversations: int
    closed_conversations: int
    total_messages: int
    avg_messages_per_conversation: float


class ConversationMetrics(BaseModel):
    total_conversations: int
    open_conversations: int
    closed_conversations: int
    abandoned_conversations: int
    responded_conversations: int
    unanswered_conversations: int
    avg_first_response_time_seconds: float
    avg_resolution_time_seconds: float
    conversations_out_of_sla: int
    conversations_with_orders: int
    conversion_rate: float
    total_revenue_from_conversations: float
    avg_ticket_from_conversations: float


class BroadcastEncarteRequest(BaseModel):
    content: str
    customer_ids: Optional[List[int]] = None

class CustomerSummary(BaseModel):
    total_customers: int
    active_customers: int
    inactive_customers: int
    new_customers: int
    repeat_rate: float
    avg_orders_per_customer: float
    avg_ticket_per_customer: float
    recurring_customers: int
    occasional_customers: int


class CustomersTimeSeries(BaseModel):
    date: datetime
    count: int


class TopCustomer(BaseModel):
    customer_id: int
    name: str
    total_revenue: float
    orders_count: int
    avg_ticket: float


class CustomerMetrics(BaseModel):
    period_start: datetime
    period_end: datetime
    summary: CustomerSummary
    new_customers_by_period: List[CustomersTimeSeries]
    top_customers: List[TopCustomer]


class TopProduct(BaseModel):
    product_name: str
    quantity: int
    total_revenue: float


class DashboardMetrics(BaseModel):
    total_revenue: float
    total_orders: int
    total_customers: int
    ticket_medio: float
    
    # KPIs financeiros
    revenue_today: float
    revenue_month: float
    orders_today: int
    orders_month: int
    gross_profit: float
    gross_margin_percent: float
    growth_vs_last_month_percent: float
    
    # KPIs operacionais
    active_conversations: int
    pending_orders: int
    in_progress_orders: int
    late_orders: int
    cancellation_rate: float
    whatsapp_orders_percentage: float
    
    sales_by_day: List[SalesByDay]
    sales_by_status: List[SalesByStatus]
    sales_by_channel: List[SalesByChannel]
    top_products: List[TopProduct]
