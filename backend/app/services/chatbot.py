from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.db.sqlite import SqliteDb
import os
from datetime import datetime

def get_greeting():
    """Retorna a saudação baseada na hora atual."""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "Bom dia"
    elif 12 <= hour < 18:
        return "Boa tarde"
    else:
        return "Boa noite"

def get_chatbot_agent(session_id: str = None, customer_name: str = None):
    """
    Retorna uma instância do agente Agno configurada com o framework Agno.
    """
    # Configuração do banco de dados para persistência das sessões
    db = SqliteDb(
        db_file="agno_storage.db",
        session_table="chatbot_sessions"
    )

    greeting = get_greeting()
    name_part = f", {customer_name}" if customer_name and customer_name != "Cliente" else ""
    
    # Mensagem exata solicitada pelo usuário
    reception_message = f"{greeting}{name_part}! Sou a Sofia assistente de IA da 3A Frios, como posso ajudar você hoje na 3A Frios? Enquanto você escolhe, nosso Atendimento vai lhe ajudar, só um momento."
    
    instructions = [
        "Você é a Sofia, assistente de IA da 3A Frios.",
        "Sua ÚNICA função é enviar a mensagem de recepção e nada mais.",
        f"A mensagem que você deve enviar é: '{reception_message}'",
        "NÃO tente conversar.",
        "NÃO responda perguntas.",
        "Apenas retorne o texto da mensagem de recepção acima."
    ]

    return Agent(
        name="Sofia",
        model=OpenAIChat(id="gpt-4o"),
        db=db,
        instructions=instructions,
        session_id=session_id,
        read_chat_history=True,
        markdown=False 
    )

async def generate_chat_response(message: str, session_id: str, customer_name: str = None) -> str:
    """
    Gera uma resposta usando o Agno Agent.
    """
    agent = get_chatbot_agent(session_id=session_id, customer_name=customer_name)
    # agent.run é síncrono no agno (phidata legado)
    response = agent.run(message)
    return response.content if hasattr(response, 'content') else str(response)
