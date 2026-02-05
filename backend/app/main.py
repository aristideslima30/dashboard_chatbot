from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db
from .routers import orders, customers, conversations, dashboard, reports

app = FastAPI(
    title="3A Frios Dashboard API",
    description="API para o sistema de gestão da 3A Frios",
    version="1.0.0",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return {"message": "pong"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start_time = time.time()
    
    path = request.url.path
    method = request.method
    
    # Capturar headers para ver se o LocalTunnel/Z-API está enviando algo
    headers = dict(request.headers)
    print(f"DEBUG: Requisição: {method} {path} - Headers: {headers}")
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    print(f"DEBUG: Resposta: {method} {path} - Status: {response.status_code} - Tempo: {process_time:.2f}ms")
    
    return response

app.include_router(orders.router)
app.include_router(customers.router)
app.include_router(conversations.router)
app.include_router(dashboard.router)
app.include_router(reports.router)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
uploads_dir = os.path.join(static_dir, "uploads")
encartes_dir = os.path.join(static_dir, "encartes")

for d in [static_dir, uploads_dir, encartes_dir]:
    if not os.path.exists(d):
        os.makedirs(d)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
    return {"message": "API da 3A Frios está online!"}
