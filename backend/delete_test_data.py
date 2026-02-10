
import asyncio
from app.database import SessionLocal
from app.models.models import Customer, Conversation, Message
from sqlalchemy import delete, select

async def clear_data():
    phone = '558894150021'
    async with SessionLocal() as s:
        # 1. Buscar IDs do cliente
        cust_res = await s.execute(select(Customer.id).where(Customer.phone == phone))
        customer_ids = cust_res.scalars().all()
        
        if customer_ids:
            # 2. Buscar IDs das conversas
            conv_res = await s.execute(select(Conversation.id).where(Conversation.customer_id.in_(customer_ids)))
            conversation_ids = conv_res.scalars().all()
            
            if conversation_ids:
                # 3. Deletar mensagens
                await s.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
                # 4. Deletar conversas
                await s.execute(delete(Conversation).where(Conversation.customer_id.in_(customer_ids)))
            
            # 5. Deletar cliente
            await s.execute(delete(Customer).where(Customer.id.in_(customer_ids)))
            
            await s.commit()
            print(f"Dados do telefone {phone} removidos com sucesso.")
        else:
            print(f"Nenhum dado encontrado para o telefone {phone}.")

if __name__ == "__main__":
    asyncio.run(clear_data())
