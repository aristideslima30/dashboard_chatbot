# 3A Frios - Sistema de Gestão

Sistema completo de gestão para 3A Frios com Dashboard e Chatbot WhatsApp integrado.

## Como rodar

O sistema utiliza Docker para facilitar a execução.

1. Certifique-se de ter o Docker instalado e rodando.
2. Na raiz do projeto, execute:

```bash
docker-compose up -d --build
```

3. Acesse:
   - **Frontend (Dashboard):** http://localhost:3000
   - **Backend (API):** http://localhost:8000
   - **Documentação da API:** http://localhost:8000/docs

## Estrutura

- `backend/`: API em Python (FastAPI)
- `frontend/`: Interface em Next.js + Tailwind + shadcn/ui
- `docker-compose.yml`: Orquestração dos containers
