from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "Laoqin Panel"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # 数据库配置
    DATABASE_URL: str = "postgresql+asyncpg://laoqin:password@localhost:5432/laoqin_panel"
    DATABASE_SYNC_URL: str = "postgresql://laoqin:password@localhost:5432/laoqin_panel"
    
    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT配置
    SECRET_KEY: str = "your-secret-key-change-in-production"  # 将在初始化时自动生成
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # 加密密钥
    ENCRYPTION_KEY: str = "your-encryption-key-change-in-production"  # 将在初始化时自动生成
    
    # Celery配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # 文件上传
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    
    # 备份配置
    BACKUP_DIR: str = "backups"
    BACKUP_RETENTION_DAYS: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

