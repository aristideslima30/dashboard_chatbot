from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class WhatsAppProvider(ABC):
    @abstractmethod
    async def send_message(self, to: str, content: str) -> Optional[str]:
        """Envia uma mensagem de texto. Retorna o ID da mensagem."""
        pass

    @abstractmethod
    async def send_media(self, to: str, media_url: str, media_type: str, caption: Optional[str] = None) -> Optional[str]:
        """Envia mídia (imagem, pdf, etc). Retorna o ID da mensagem."""
        pass

    @abstractmethod
    def process_webhook(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Processa os dados recebidos via webhook e normaliza para o sistema."""
        pass
