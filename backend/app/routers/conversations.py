from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, Form, Request
import os
import uuid
import shutil
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from ..database import get_db, SessionLocal
from ..models import models
from ..schemas import schemas
from ..services.chatbot import generate_chat_response
from ..services.whatsapp_service import get_whatsapp_service
import json

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@router.get("/metrics", response_model=schemas.ConversationMetrics)
async def get_conversation_metrics(db: AsyncSession = Depends(get_db)):
    # 1. Métricas básicas de Conversas (Counts)
    total_conversations = await db.scalar(select(func.count(models.Conversation.id)))
    open_conversations = await db.scalar(select(func.count(models.Conversation.id)).where(models.Conversation.status == "open"))
    closed_conversations = await db.scalar(select(func.count(models.Conversation.id)).where(models.Conversation.status == "closed"))
    
    now = datetime.now(timezone.utc)
    abandoned_threshold = now - timedelta(hours=24)
    abandoned_conversations = await db.scalar(
        select(func.count(models.Conversation.id)).where(
            models.Conversation.status == "open",
            models.Conversation.updated_at < abandoned_threshold
        )
    )

    # 2. Métricas Financeiras e de Conversão (Join com Orders)
    financial_metrics = await db.execute(
        select(
            func.count(models.Conversation.id).label("conversations_with_orders"),
            func.coalesce(func.sum(models.Order.total_amount), 0.0).label("total_revenue")
        )
        .join(models.Order, models.Conversation.order_id == models.Order.id)
    )
    fin_row = financial_metrics.one()
    conversations_with_orders = fin_row.conversations_with_orders
    total_revenue_from_conversations = float(fin_row.total_revenue)

    conversion_rate = (conversations_with_orders / total_conversations) if total_conversations > 0 else 0.0
    avg_ticket_from_conversations = (total_revenue_from_conversations / conversations_with_orders) if conversations_with_orders > 0 else 0.0

    # 3. Métricas de Mensagens (Respondidas vs Sem Resposta)
    # Conversas que têm pelo menos uma mensagem de AGENT ou BOT
    responded_subquery = select(models.Message.conversation_id).where(
        models.Message.sender_type.in_([models.SenderType.AGENT, models.SenderType.BOT])
    ).distinct()
    
    responded_conversations = await db.scalar(
        select(func.count(models.Conversation.id)).where(models.Conversation.id.in_(responded_subquery))
    )

    # Conversas que têm mensagens de CUSTOMER mas NÃO têm de AGENT/BOT
    # (Simplificação: Total - Respondidas pode incluir conversas vazias, então vamos ser mais precisos)
    has_customer_msg_subquery = select(models.Message.conversation_id).where(
        models.Message.sender_type == models.SenderType.CUSTOMER
    ).distinct()

    unanswered_conversations = await db.scalar(
        select(func.count(models.Conversation.id)).where(
            models.Conversation.id.in_(has_customer_msg_subquery),
            models.Conversation.id.notin_(responded_subquery)
        )
    )

    # 4. Tempos Médios (SLA e Resposta)
    # Para performance, calculamos isso apenas nas conversas recentes (últimos 30 dias) ou limitamos a query
    # Carregando apenas colunas necessárias para o cálculo em memória (evita carregar blobs/textos grandes)
    
    cutoff_date = now - timedelta(days=30)
    
    # Query otimizada para buscar apenas timestamps e sender_types de mensagens recentes
    messages_result = await db.execute(
        select(models.Message.conversation_id, models.Message.sender_type, models.Message.timestamp)
        .join(models.Conversation, models.Message.conversation_id == models.Conversation.id)
        .where(models.Conversation.updated_at >= cutoff_date)
        .order_by(models.Message.conversation_id, models.Message.timestamp)
    )
    
    # Processamento em memória otimizado (apenas tuplas, não objetos ORM completos)
    # Agrupando por conversa
    from collections import defaultdict
    conversation_msgs = defaultdict(list)
    for row in messages_result.all():
        conversation_msgs[row.conversation_id].append(row)

    first_response_deltas = []
    resolution_deltas = []
    sla_threshold = timedelta(minutes=5)
    conversations_out_of_sla = 0

    for conv_id, msgs in conversation_msgs.items():
        if not msgs:
            continue
            
        first_customer_msg = next((m for m in msgs if m.sender_type == models.SenderType.CUSTOMER), None)
        first_response_msg = next((m for m in msgs if m.sender_type in (models.SenderType.AGENT, models.SenderType.BOT)), None)
        
        if first_customer_msg and first_response_msg:
            if first_response_msg.timestamp > first_customer_msg.timestamp:
                delta = first_response_msg.timestamp - first_customer_msg.timestamp
                first_response_deltas.append(delta.total_seconds())
                if delta > sla_threshold:
                    conversations_out_of_sla += 1
        
        # Resolução (aproximada: último msg - primeiro msg do cliente, se conversa fechada... 
        # mas aqui não temos o status da conversa na query leve. 
        # Vamos assumir que para cálculo de média geral, pegamos a duração da interação)
        # Para ser preciso, precisaríamos do status da conversa.
        # Vamos buscar o status das conversas processadas
    
    # Se precisarmos do status para resolution time correto, podemos fazer um join ou carregar IDs
    # Mas para simplificar e manter performance, vamos assumir:
    avg_first_response_time_seconds = (sum(first_response_deltas) / len(first_response_deltas)) if first_response_deltas else 0.0
    
    # Resolution Time requer saber se está closed. 
    # Vamos fazer uma query separada rápida para resolution time apenas de closed conversations recentes
    closed_recent_msgs = await db.execute(
        select(models.Message.conversation_id, models.Message.timestamp)
        .join(models.Conversation, models.Message.conversation_id == models.Conversation.id)
        .where(
            models.Conversation.status == "closed",
            models.Conversation.updated_at >= cutoff_date
        )
        .order_by(models.Message.conversation_id, models.Message.timestamp)
    )
    
    closed_map = defaultdict(list)
    for row in closed_recent_msgs.all():
        closed_map[row.conversation_id].append(row.timestamp)
        
    for times in closed_map.values():
        if len(times) >= 2:
            delta = times[-1] - times[0]
            resolution_deltas.append(delta.total_seconds())

    avg_resolution_time_seconds = (sum(resolution_deltas) / len(resolution_deltas)) if resolution_deltas else 0.0

    return schemas.ConversationMetrics(
        total_conversations=total_conversations,
        open_conversations=open_conversations,
        closed_conversations=closed_conversations,
        abandoned_conversations=abandoned_conversations,
        responded_conversations=responded_conversations,
        unanswered_conversations=unanswered_conversations,
        avg_first_response_time_seconds=avg_first_response_time_seconds,
        avg_resolution_time_seconds=avg_resolution_time_seconds,
        conversations_out_of_sla=conversations_out_of_sla,
        conversations_with_orders=conversations_with_orders,
        conversion_rate=conversion_rate,
        total_revenue_from_conversations=total_revenue_from_conversations,
        avg_ticket_from_conversations=avg_ticket_from_conversations,
    )

@router.post("/", response_model=schemas.Conversation)
async def create_conversation(conversation: schemas.ConversationCreate, db: AsyncSession = Depends(get_db)):
    db_conversation = models.Conversation(**conversation.model_dump())
    db.add(db_conversation)
    await db.commit()
    await db.refresh(db_conversation)
    return db_conversation

@router.get("/", response_model=List[schemas.Conversation])
async def read_conversations(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Conversation)
        .options(selectinload(models.Conversation.customer))
        .options(selectinload(models.Conversation.messages))
        .order_by(models.Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/broadcast-encarte")
async def broadcast_encarte(
    content: str = Form(""),
    file: UploadFile = File(None),
    customer_ids_json: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    customer_ids = []
    if customer_ids_json:
        try:
            customer_ids = json.loads(customer_ids_json)
        except:
            pass

    customers_query = select(models.Customer)
    if customer_ids:
        customers_query = customers_query.where(models.Customer.id.in_(customer_ids))

    customers_result = await db.execute(customers_query)
    customers = customers_result.scalars().all()

    media_url = None
    media_type = None

    if file:
        file_ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        # Salvar em static/encartes
        base_path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "encartes")
        os.makedirs(base_path, exist_ok=True)
        filepath = os.path.join(base_path, filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        media_url = f"/static/encartes/{filename}"
        if file.content_type and file.content_type.startswith("image/"):
            media_type = "image"
        elif file.content_type == "application/pdf":
            media_type = "pdf"
        else:
            media_type = "file"

    sent_to: list[int] = []
    service = get_whatsapp_service()

    for customer in customers:
        conv_result = await db.execute(
            select(models.Conversation)
            .where(
                models.Conversation.customer_id == customer.id,
                models.Conversation.status == "open",
            )
            .order_by(models.Conversation.updated_at.desc())
        )
        conversation = conv_result.scalars().first()

        if conversation is None:
            conversation = models.Conversation(customer_id=customer.id, status="open")
            db.add(conversation)
            await db.flush()

        # Enviar via WhatsApp se tivermos o número
        if customer.phone:
            if media_url:
                # Evolution espera URL completa se for o caso, ou buffer. 
                # Aqui passamos a URL relativa, o service Evolution teria que lidar com isso
                # mas por enquanto vamos enviar o texto.
                await service.send_message(customer.phone, f"{content}\n{media_url}")
            else:
                await service.send_message(customer.phone, content)

        db_message = models.Message(
            conversation_id=conversation.id,
            content=content,
            media_url=media_url,
            media_type=media_type,
            sender_type=models.SenderType.BOT,
        )
        db.add(db_message)
        sent_to.append(customer.id)

    await db.commit()

    return {"sent_to": sent_to}

@router.api_route("/webhook/zapi", methods=["GET", "POST", "PUT", "OPTIONS"])
async def zapi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    print(f"DEBUG: Webhook Z-API chamado via {request.method}")
    print(f"DEBUG: Headers: {dict(request.headers)}")
    
    if request.method == "GET":
        return {"status": "ok", "message": "Z-API Webhook endpoint is active"}
    
    body = await request.body()
    print(f"DEBUG: Raw Body: {body.decode('utf-8', errors='ignore')}")
    
    try:
        data = json.loads(body)
        print(f"DEBUG: Webhook Z-API Payload (Parsed): {json.dumps(data, indent=2)}")
    except Exception as e:
        print(f"Erro ao ler JSON do webhook: {e}")
        return {"status": "error", "message": "Invalid JSON", "details": str(e)}
        
    service = get_whatsapp_service()
    normalized = service.process_webhook(data)
    
    if not normalized:
        print("DEBUG: Webhook ignorado (não é ReceivedMessage)")
        return {"status": "ignored"}

    whatsapp_id = normalized.get("whatsapp_id")
    from_me = normalized.get("from_me", False)
    print(f"DEBUG: whatsapp_id={whatsapp_id}, from_me={from_me}")
    
    # 0. Verificar duplicidade pelo whatsapp_id
    if whatsapp_id:
        existing_msg = await db.execute(select(models.Message).where(models.Message.whatsapp_id == whatsapp_id))
        if existing_msg.scalars().first():
            print(f"DEBUG: Mensagem {whatsapp_id} já processada")
            return {"status": "already_processed"}
    
    remote_id = normalized.get("remote_id") # ex: 5511999999999@c.us
    phone = normalized.get("phone") or (remote_id.split("@")[0] if remote_id else None)
    print(f"DEBUG: phone={phone}")
    
    if not phone:
        return {"status": "no_phone"}

    # 1. Buscar ou criar cliente
    customer_res = await db.execute(select(models.Customer).where(models.Customer.phone == phone))
    customer = customer_res.scalars().first()
    
    if not customer:
        print(f"DEBUG: Criando novo cliente: {normalized.get('sender_name')}")
        customer = models.Customer(name=normalized.get("sender_name", "Cliente"), phone=phone)
        db.add(customer)
        await db.flush()
    elif (customer.name == "Cliente" or not customer.name) and not from_me:
        # Atualizar nome se for o default e a mensagem veio do cliente
        customer.name = normalized.get("sender_name", "Cliente")
        await db.flush()
    
    # 2. Buscar ou criar conversa aberta
    conv_res = await db.execute(
        select(models.Conversation)
        .where(models.Conversation.customer_id == customer.id, models.Conversation.status == "open")
    )
    conversation = conv_res.scalars().first()
    
    if not conversation:
        print(f"DEBUG: Criando nova conversa para o cliente {customer.id}")
        conversation = models.Conversation(customer_id=customer.id, status="open")
        db.add(conversation)
        await db.flush()
    
    # 3. Salvar mensagem
    sender_type = models.SenderType.AGENT if from_me else models.SenderType.CUSTOMER
    
    db_message = models.Message(
        conversation_id=conversation.id,
        content=normalized.get("content"),
        media_url=normalized.get("media_url"),
        media_type="image" if normalized.get("is_media") else None,
        sender_type=sender_type,
        whatsapp_id=whatsapp_id
    )
    db.add(db_message)
    
    # 4. Atualizar timestamp da conversa
    conversation.updated_at = func.now()
    
    await db.commit()
    await db.refresh(db_message)
    print(f"DEBUG: Mensagem salva no banco (ID: {db_message.id})")
    
    # 5. Notificar via WebSocket
    outgoing = {
        "type": "message",
        "id": db_message.id,
        "conversation_id": db_message.conversation_id,
        "content": db_message.content,
        "media_url": db_message.media_url,
        "media_type": db_message.media_type,
        "sender_type": db_message.sender_type.value,
        "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None,
    }
    await manager.broadcast(json.dumps(outgoing))
    print("DEBUG: Broadcast WebSocket enviado")

    # 6. Gerar resposta automática (Chatbot) - APENAS se for do CUSTOMER e se for a PRIMEIRA mensagem
    if not from_me:
        print("DEBUG: Verificando se deve enviar saudação da Sofia")
        # Verificar se já existe alguma mensagem do BOT nesta conversa
        bot_msg_check = await db.execute(
            select(models.Message)
            .where(
                models.Message.conversation_id == conversation.id,
                models.Message.sender_type == models.SenderType.BOT
            )
        )
        already_greeted = bot_msg_check.scalars().first() is not None

        if not already_greeted:
            print("DEBUG: Primeira mensagem do cliente. Sofia irá recepcionar.")
            try:
                response_text = await generate_chat_response(
                    message=normalized.get("content", ""),
                    session_id=f"conv_{conversation.id}",
                    customer_name=customer.name
                )
                print(f"DEBUG: Resposta do Chatbot: {response_text}")
                
                if response_text:
                    # Enviar via Z-API primeiro para pegar o messageId
                    bot_whatsapp_id = await service.send_message(phone, response_text)
                    print(f"DEBUG: Mensagem do Bot enviada via Z-API (ID: {bot_whatsapp_id})")
                    
                    # Salvar mensagem do Bot
                    bot_message = models.Message(
                        conversation_id=conversation.id,
                        content=response_text,
                        sender_type=models.SenderType.BOT,
                        whatsapp_id=bot_whatsapp_id
                    )
                    db.add(bot_message)
                    
                    await db.commit()
                    await db.refresh(bot_message)
                    
                    # Notificar Bot via WebSocket
                    bot_outgoing = {
                        "type": "message",
                        "id": bot_message.id,
                        "conversation_id": bot_message.conversation_id,
                        "content": bot_message.content,
                        "sender_type": bot_message.sender_type.value,
                        "timestamp": bot_message.timestamp.isoformat() if bot_message.timestamp else None,
                    }
                    await manager.broadcast(json.dumps(bot_outgoing))
                    print("DEBUG: Broadcast WebSocket do Bot enviado")
            except Exception as e:
                print(f"DEBUG: Erro ao processar resposta do chatbot: {e}")
        else:
            print("DEBUG: Sofia já recepcionou este cliente. Aguardando atendimento humano.")

    return {"status": "success"}

@router.post("/webhook/evolution")
async def evolution_webhook(data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    service = get_whatsapp_service()
    normalized = service.process_webhook(data)
    
    if not normalized or normalized.get("from_me"):
        return {"status": "ignored"}
    
    remote_id = normalized.get("remote_id") # ex: 5511999999999@s.whatsapp.net
    phone = remote_id.split("@")[0]
    
    # 1. Buscar ou criar cliente
    customer_res = await db.execute(select(models.Customer).where(models.Customer.phone == phone))
    customer = customer_res.scalars().first()
    
    if not customer:
        customer = models.Customer(name=normalized.get("sender_name", "Cliente"), phone=phone)
        db.add(customer)
        await db.flush()
    elif customer.name == "Cliente" or not customer.name:
        # Atualizar nome se for o default
        customer.name = normalized.get("sender_name", "Cliente")
        await db.flush()
    
    # 2. Buscar ou criar conversa aberta
    conv_res = await db.execute(
        select(models.Conversation)
        .where(models.Conversation.customer_id == customer.id, models.Conversation.status == "open")
    )
    conversation = conv_res.scalars().first()
    
    if not conversation:
        conversation = models.Conversation(customer_id=customer.id, status="open")
        db.add(conversation)
        await db.flush()
    
    # 3. Salvar mensagem
    db_message = models.Message(
        conversation_id=conversation.id,
        content=normalized.get("content"),
        sender_type=models.SenderType.CUSTOMER
    )
    db.add(db_message)
    
    # 4. Atualizar timestamp da conversa
    conversation.updated_at = func.now()
    
    await db.commit()
    await db.refresh(db_message)
    
    # 5. Notificar via WebSocket
    outgoing = {
        "type": "message",
        "id": db_message.id,
        "conversation_id": db_message.conversation_id,
        "content": db_message.content,
        "sender_type": db_message.sender_type.value,
        "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None,
    }
    await manager.broadcast(json.dumps(outgoing))
    
    # 6. Lógica da Ana (Boas-vindas)
    bot_responses_count = await db.scalar(
        select(func.count(models.Message.id)).where(
            models.Message.conversation_id == conversation.id,
            models.Message.sender_type == models.SenderType.BOT
        )
    )
    
    if bot_responses_count == 0:
        bot_content = await generate_chat_response(
            message=db_message.content or "",
            session_id=f"conv_{conversation.id}",
            customer_name=customer.name
        )
        
        # Enviar via WhatsApp API
        await service.send_message(phone, bot_content)
        
        # Salvar no banco
        bot_message = models.Message(
            conversation_id=conversation.id,
            content=bot_content,
            sender_type=models.SenderType.BOT
        )
        db.add(bot_message)
        await db.commit()
        await db.refresh(bot_message)
        
        # Notificar WebSocket
        bot_outgoing = {
            "type": "message",
            "id": bot_message.id,
            "conversation_id": bot_message.conversation_id,
            "content": bot_message.content,
            "sender_type": bot_message.sender_type.value,
            "timestamp": bot_message.timestamp.isoformat() if bot_message.timestamp else None,
        }
        await manager.broadcast(json.dumps(bot_outgoing))

    return {"status": "success"}

@router.post("/{conversation_id}/messages", response_model=schemas.Message)
async def send_message_with_attachment(
    conversation_id: int,
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    # 1. Buscar conversa
    result = await db.execute(
        select(models.Conversation).where(models.Conversation.id == conversation_id)
    )
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    media_url = None
    media_type = None

    if file:
        file_ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        base_path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads")
        os.makedirs(base_path, exist_ok=True)
        filepath = os.path.join(base_path, filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        media_url = f"/static/uploads/{filename}"
        if file.content_type and file.content_type.startswith("image/"):
            media_type = "image"
        elif file.content_type == "application/pdf":
            media_type = "pdf"
        else:
            media_type = "file"

    # 2. Salvar mensagem
    db_message = models.Message(
        conversation_id=conversation_id,
        content=content,
        media_url=media_url,
        media_type=media_type,
        sender_type=models.SenderType.AGENT,
    )
    db.add(db_message)
    
    # Update conversation timestamp
    conversation.updated_at = func.now()
    
    await db.commit()
    await db.refresh(db_message)

    # 3. Notificar via WebSocket
    outgoing = {
        "type": "message",
        "id": db_message.id,
        "conversation_id": db_message.conversation_id,
        "content": db_message.content,
        "media_url": db_message.media_url,
        "media_type": db_message.media_type,
        "sender_type": db_message.sender_type.value,
        "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None,
    }
    await manager.broadcast(json.dumps(outgoing))

    # 4. Enviar via WhatsApp API
    service = get_whatsapp_service()
    conv_res = await db.execute(
        select(models.Conversation)
        .options(selectinload(models.Conversation.customer))
        .where(models.Conversation.id == conversation_id)
    )
    conv = conv_res.scalars().first()
    whatsapp_id = None
    if conv and conv.customer and conv.customer.phone:
        if media_url:
            # Se for imagem/documento local, precisamos de uma URL pública.
            full_media_url = media_url
            # Nota: para a Z-API baixar o arquivo, a URL precisa ser pública (ex: ngrok)
            
            whatsapp_id = await service.send_media(
                to=conv.customer.phone,
                media_url=full_media_url,
                media_type=media_type or "file",
                caption=content
            )
        elif content:
            whatsapp_id = await service.send_message(conv.customer.phone, content)
            
    # 5. Atualizar mensagem com o whatsapp_id
    if whatsapp_id:
        db_message.whatsapp_id = whatsapp_id
        await db.commit()

    return db_message

@router.get("/{conversation_id}/messages", response_model=List[schemas.Message])
async def read_messages(conversation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Message)
        .where(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.timestamp.asc())
    )
    return result.scalars().all()

@router.post("/{conversation_id}/attach-order/{order_id}", response_model=schemas.Conversation)
async def attach_order_to_conversation(conversation_id: int, order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Conversation).where(models.Conversation.id == conversation_id)
    )
    conversation = result.scalars().first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    order_result = await db.execute(
        select(models.Order).where(models.Order.id == order_id)
    )
    order = order_result.scalars().first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    conversation.order_id = order_id
    await db.commit()
    await db.refresh(conversation)
    return conversation

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Aqui podemos processar a mensagem, salvar no banco, etc.
            # Por enquanto, apenas echo e broadcast
            # Exemplo de payload esperado: {"conversation_id": 1, "content": "Ola", "sender_type": "customer"}
            try:
                message_data = json.loads(data)

                async with SessionLocal() as db:
                    sender_type_value = message_data.get("sender_type", models.SenderType.CUSTOMER.value)
                    try:
                        sender_type = models.SenderType(sender_type_value)
                    except ValueError:
                        sender_type = models.SenderType.CUSTOMER

                    db_message = models.Message(
                        conversation_id=message_data.get("conversation_id"),
                        content=message_data.get("content"),
                        sender_type=sender_type,
                    )
                    db.add(db_message)
                    
                    # Update conversation timestamp
                    await db.execute(
                        models.Conversation.__table__.update()
                        .where(models.Conversation.id == message_data.get("conversation_id"))
                        .values(updated_at=func.now())
                    )

                    await db.commit()

                    await db.refresh(db_message)

                    outgoing = {
                        "type": "message",
                        "id": db_message.id,
                        "conversation_id": db_message.conversation_id,
                        "content": db_message.content,
                        "sender_type": db_message.sender_type.value,
                        "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None,
                    }

                    await manager.broadcast(json.dumps(outgoing))

                    if db_message.sender_type == models.SenderType.AGENT:
                        # Se um agente responder via painel, enviamos para o WhatsApp
                        service = get_whatsapp_service()
                        conv_res = await db.execute(
                            select(models.Conversation)
                            .options(selectinload(models.Conversation.customer))
                            .where(models.Conversation.id == db_message.conversation_id)
                        )
                        conv = conv_res.scalars().first()
                        if conv and conv.customer and conv.customer.phone:
                            await service.send_message(conv.customer.phone, db_message.content)

                    if db_message.sender_type == models.SenderType.CUSTOMER:
                        # Verificar se o bot já respondeu nesta conversa para não manter conversa
                        # (apenas boas-vindas na primeira interação do cliente)
                        bot_responses_count = await db.scalar(
                            select(func.count(models.Message.id)).where(
                                models.Message.conversation_id == db_message.conversation_id,
                                models.Message.sender_type == models.SenderType.BOT
                            )
                        )

                        if bot_responses_count == 0:
                            # Usar o serviço Agno para gerar a resposta de boas-vindas
                            bot_content = await generate_chat_response(
                                message=db_message.content or "",
                                session_id=f"conv_{db_message.conversation_id}"
                            )

                            bot_message = models.Message(
                                conversation_id=db_message.conversation_id,
                                content=bot_content,
                                sender_type=models.SenderType.BOT,
                            )
                            db.add(bot_message)

                            # Update conversation timestamp
                            await db.execute(
                                models.Conversation.__table__.update()
                                .where(models.Conversation.id == db_message.conversation_id)
                                .values(updated_at=func.now())
                            )

                            await db.commit()
                            await db.refresh(bot_message)

                            bot_outgoing = {
                                "type": "message",
                                "id": bot_message.id,
                                "conversation_id": bot_message.conversation_id,
                                "content": bot_message.content,
                                "sender_type": bot_message.sender_type.value,
                                "timestamp": bot_message.timestamp.isoformat() if bot_message.timestamp else None,
                            }

                            await manager.broadcast(json.dumps(bot_outgoing))
            except Exception as e:
                await manager.broadcast(f"Error processing message from #{client_id}: {str(e)}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client #{client_id} left the chat")
