from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="业务系统集中管理面板 API",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # 前端开发地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Laoqin Panel API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# 导入路由
from app.api import auth, sites, servers, devices, databases, applications, credentials, backups, settings, network, monitoring, users, logs
from app.api.websocket import websocket_monitoring

# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(servers.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(databases.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(credentials.router, prefix="/api")
app.include_router(backups.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(logs.router, prefix="/api")

# 注册WebSocket路由
from fastapi import WebSocket as FastAPIWebSocket

@app.websocket("/ws/monitoring")
async def websocket_endpoint(websocket: FastAPIWebSocket):
    await websocket_monitoring(websocket, channel="monitoring")

# 启动后台任务（可选）
# 注意：在生产环境中，应该使用Celery或单独的进程来运行后台任务
# import asyncio
# from app.services.alert_service import start_alert_checker
# 
# @app.on_event("startup")
# async def startup_event():
#     """应用启动时执行"""
#     # 启动告警检查后台任务
#     # start_alert_checker()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

