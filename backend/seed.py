import asyncio
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, Customer, Order, OrderItem, Conversation, Message, OrderStatus, PaymentMethod, SenderType, User
from app.database import DATABASE_URL
from datetime import datetime, timedelta

# Fix database URL for async
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

async def seed_data():
    async with AsyncSessionLocal() as session:
        # Create Users (Salespeople)
        users_names = ["Ricardo Santos", "Juliana Souza", "Marcos Oliveira"]
        users = []
        for name in users_names:
            user = User(
                name=name,
                email=f"{name.lower().replace(' ', '.')}@3afrios.com.br",
                role="salesperson"
            )
            users.append(user)
            session.add(user)
        await session.flush()

        customers_names = [
            "Ana Beatriz Silva", "Carlos Eduardo Souza", "Fernanda Oliveira",
            "Gabriel Rodrigues", "Helena Costa", "João Pedro Santos",
            "Larissa Martins", "Lucas Ferreira", "Mariana Alves", "Paulo Roberto Lima"
        ]
        customers = []
        for i, name in enumerate(customers_names):
            customer = Customer(
                name=name,
                phone=f"55119999999{i}",
            )
            customers.append(customer)
            session.add(customer)
        await session.flush()

        # Create Orders
        orders = []
        for _ in range(30):
            customer = random.choice(customers)
            salesperson = random.choice(users)
            order = Order(
                customer_id=customer.id,
                salesperson_id=salesperson.id,
                status=random.choice(list(OrderStatus)),
                payment_method=random.choice(list(PaymentMethod)),
                created_at=datetime.now() - timedelta(days=random.randint(0, 30))
            )
            session.add(order)
            await session.flush()
            orders.append(order)

            total_amount = 0
            num_items = random.randint(1, 5)
            products = [
                ("Mussarela Fatiada", 45.0),
                ("Presunto Cozido", 30.0),
                ("Peito de Frango", 22.0),
                ("Bacon Manta", 35.0),
                ("Calabresa Defumada", 28.0),
                ("Queijo Prato", 48.0),
                ("Salame Italiano", 65.0),
                ("Mortadela Defumada", 18.0),
            ]
            for _ in range(num_items):
                quantity = random.randint(1, 3)
                product_name, base_price = random.choice(products)
                unit_price = base_price
                cost = unit_price * 0.6 # 40% margin
                item = OrderItem(
                    order_id=order.id,
                    product_name=product_name,
                    quantity=quantity,
                    unit_price=unit_price,
                    cost=cost
                )
                session.add(item)
                total_amount += unit_price * quantity
            
            order.total_amount = total_amount

        conversation_templates = [
            {
                "status": "open",
                "messages": [
                    ("Olá, gostaria de saber o preço da mussarela fatiada.", SenderType.CUSTOMER),
                    ("Sou a Agno, IA da 3A Frios. Posso te passar tabela e promoções.", SenderType.BOT),
                ],
            },
            {
                "status": "open",
                "messages": [
                    ("Consegue me informar o prazo de entrega para amanhã cedo?", SenderType.CUSTOMER),
                    ("Entrega padrão entre 7h e 10h. Quer confirmar o pedido?", SenderType.AGENT),
                ],
            },
            {
                "status": "closed",
                "messages": [
                    ("Pedido entregue certinho, obrigado!", SenderType.CUSTOMER),
                    ("Eu que agradeço. Qualquer coisa, é só chamar.", SenderType.AGENT),
                ],
            },
            {
                "status": "open",
                "messages": [
                    ("Quero fazer um pedido grande para sexta.", SenderType.CUSTOMER),
                    ("Sou a Agno, IA da 3A Frios. Me envie produtos e quantidades.", SenderType.BOT),
                ],
            },
            {
                "status": "open",
                "messages": [
                    ("Vocês têm peito de frango em promoção?", SenderType.CUSTOMER),
                    ("Temos sim, peito congelado com desconto para atacado.", SenderType.AGENT),
                ],
            },
            {
                "status": "closed",
                "messages": [
                    ("Tive um problema com a última entrega, veio faltando produto.", SenderType.CUSTOMER),
                    ("Já registrei aqui, vamos ajustar no próximo pedido.", SenderType.AGENT),
                ],
            },
            {
                "status": "open",
                "messages": [
                    ("Boa tarde, aceita PIX na entrega?", SenderType.CUSTOMER),
                    ("Aceitamos PIX, crédito, débito e dinheiro.", SenderType.BOT),
                ],
            },
            {
                "status": "open",
                "messages": [
                    ("Pode me mandar a lista de preços atualizada?", SenderType.CUSTOMER),
                    ("Claro, vou te enviar a tabela resumida aqui no WhatsApp.", SenderType.AGENT),
                ],
            },
        ]

        for template in conversation_templates:
            customer = random.choice(customers)
            order = random.choice(orders) if orders else None
            conversation = Conversation(
                customer_id=customer.id,
                status=template["status"],
                order_id=order.id if order else None,
            )
            session.add(conversation)
            await session.flush()

            for content, sender_type in template["messages"]:
                msg = Message(
                    conversation_id=conversation.id,
                    content=content,
                    sender_type=sender_type,
                )
                session.add(msg)

        await session.commit()
        print("Database seeded successfully!")

async def main():
    await init_db()
    await seed_data()

if __name__ == "__main__":
    asyncio.run(main())
