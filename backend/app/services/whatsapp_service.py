from typing import Optional, Dict, Any
import httpx
import logging
from .whatsapp_base import WhatsAppProvider

logger = logging.getLogger(__name__)

class ZApiProvider(WhatsAppProvider):
    def __init__(self, instance_id: str, token: str, client_token: Optional[str] = None):
        self.instance_id = instance_id
        self.token = token
        self.client_token = client_token
        self.base_url = f"https://api.z-api.io/instances/{instance_id}/token/{token}"

    def _get_headers(self):
        headers = {"Content-Type": "application/json"}
        if self.client_token:
            headers["Client-Token"] = self.client_token
        return headers

    async def send_message(self, to: str, content: str) -> Optional[str]:
        """Envia uma mensagem de texto via Z-API. Retorna o ID da mensagem se sucesso."""
        url = f"{self.base_url}/send-text"
        
        # Garantir que o número esteja no formato correto (DDI+DDD+Número)
        clean_phone = "".join(filter(str.isdigit, to))
        
        payload = {
            "phone": clean_phone,
            "message": content
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                if response.status_code in [200, 201]:
                    res_data = response.json()
                    return res_data.get("messageId")
                logger.error(f"Erro Z-API send_message: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"Exceção Z-API send_message: {str(e)}")
            return None

    async def send_media(self, to: str, media_url: str, media_type: str, caption: Optional[str] = None) -> Optional[str]:
        """Envia mídia via Z-API. Retorna o ID da mensagem se sucesso."""
        # Mapeamento de tipos para endpoints da Z-API
        endpoint = "send-image" if media_type == "image" else "send-document"
        if media_type == "pdf":
            endpoint = "send-document"
            
        url = f"{self.base_url}/{endpoint}"
        clean_phone = "".join(filter(str.isdigit, to))
        
        payload = {
            "phone": clean_phone,
            "image" if media_type == "image" else "document": media_url,
        }
        
        if caption:
            payload["caption"] = caption

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                if response.status_code in [200, 201]:
                    res_data = response.json()
                    return res_data.get("messageId")
                logger.error(f"Erro Z-API send_media: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"Exceção Z-API send_media: {str(e)}")
            return None

    def process_webhook(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa o webhook da Z-API e normaliza os dados.
        """
        # Logar o payload completo para depuração extrema
        import json
        print(f"DEBUG: RAW WEBHOOK PAYLOAD: {json.dumps(data, indent=2)}")
        
        # Tentar pegar o tipo de evento de várias formas
        event_type = data.get("type") or data.get("event") or data.get("action")
        print(f"DEBUG: ZApiProvider.process_webhook - event_type: {event_type}")
        
        # Se for um evento de desconexão ou status, ignoramos silenciosamente mas logamos
        if event_type in ["Disconnected", "Connected", "MessageStatus"]:
            print(f"DEBUG: Evento informativo ignorado: {event_type}")
            return {}

        # Se não tiver 'type', tentamos inferir se é uma mensagem
        if not event_type:
            if "phone" in data or "message" in data:
                event_type = "ReceivedMessage"
                print("DEBUG: Event type ausente, inferindo ReceivedMessage")
            else:
                print("DEBUG: Webhook sem tipo e sem dados de mensagem ignorado")
                return {}
        
        # Aceitar tipos conhecidos ou inferidos
        # on-message-received é comum em algumas versões da Z-API
        if event_type not in ["ReceivedMessage", "SendMessage", "ReceivedCallback", "on-message-received", "message-received"]:
            print(f"DEBUG: Webhook com tipo desconhecido ignorado: {event_type}")
            return {}

        # Filtrar mensagens de grupo
        is_group = data.get("isGroup", False)
        # Se vier de um grupo (ou tiver JID de grupo), ignoramos por enquanto
        phone = data.get("phone", "")
        if is_group or (phone and "@g.us" in str(phone)):
             print(f"DEBUG: Mensagem de grupo detectada ({phone}). Ignorando.")
             return {}

        # Extrair dados básicos - Z-API pode ter estruturas variadas
        # Tentamos pegar do nível raiz ou de dentro de 'data' se existir
        phone = data.get("phone")
        sender_name = data.get("senderName") or data.get("pushName") or "Cliente"
        from_me = data.get("fromMe", False) or (event_type == "SendMessage")
        whatsapp_id = data.get("messageId")
        
        # Extrair conteúdo da mensagem com máxima flexibilidade
        content = ""
        if isinstance(data.get("text"), dict):
            content = data.get("text", {}).get("message", "")
        elif isinstance(data.get("message"), dict):
            # Alguns formatos da Z-API trazem message como objeto
            content = data.get("message", {}).get("text", "") or data.get("message", {}).get("message", "")
        else:
            content = data.get("text") or data.get("message") or ""
        
        # Se content ainda for dict por algum motivo, converter para string
        if isinstance(content, dict):
            import json
            content = json.dumps(content)
        
        content = str(content)

        # Se não achou no text ou message, tenta no caption (para mídias)
        if not content:
            content = data.get("caption") or ""
        
        # Verificar se é mídia
        is_media = False
        media_url = None
        if "image" in data:
            is_media = True
            media_url = data["image"].get("url")
        elif "document" in data:
            is_media = True
            media_url = data["document"].get("url")

        return {
            "remote_id": f"{phone}@c.us",
            "phone": phone,
            "sender_name": sender_name,
            "content": content,
            "from_me": from_me,
            "whatsapp_id": whatsapp_id,
            "is_media": is_media,
            "media_url": media_url
        }

class EvolutionProvider(WhatsAppProvider):
    # ... (mantendo o anterior por segurança se necessário, mas o factory vai mudar)
    async def send_message(self, to: str, content: str) -> bool:
        print(f"Enviando mensagem para {to}: {content}")
        return True

    async def send_media(self, to: str, media_url: str, media_type: str, caption: Optional[str] = None) -> bool:
        print(f"Enviando mídia {media_type} para {to}: {media_url}")
        return True

    def process_webhook(self, data: Dict[str, Any]) -> Dict[str, Any]:
        event = data.get("event")
        payload = data.get("data", {})
        if event != "messages.upsert":
            return {}
        message = payload.get("message", {})
        key = payload.get("key", {})
        if key.get("fromMe"):
            return {"from_me": True}
        content = ""
        if "conversation" in message:
            content = message["conversation"]
        elif "extendedTextMessage" in message:
            content = message["extendedTextMessage"].get("text", "")
        sender_name = payload.get("pushName") or "Cliente"
        remote_id = key.get("remoteJid")
        return {
            "remote_id": remote_id,
            "sender_name": sender_name,
            "content": content,
            "from_me": False
        }

def get_whatsapp_service() -> WhatsAppProvider:
    # Dados fornecidos pelo usuário
    INSTANCE_ID = "3EE310AFD25642C9A84486CEC38C003A"
    TOKEN = "6EE6E8FF28B522C090269684"
    CLIENT_TOKEN = "F9e0bef67d6d74f799bb10fc975d97b2bS" # Token de segurança da conta
    return ZApiProvider(instance_id=INSTANCE_ID, token=TOKEN, client_token=CLIENT_TOKEN)
