from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(100), nullable=False, index=True)  # 操作类型
    resource_type = Column(String(50))  # server, device, database等
    resource_id = Column(Integer)  # 资源ID
    details = Column(Text)  # 操作详情（JSON格式）
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # 关系
    user = relationship("User", foreign_keys=[user_id])


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # null表示系统通知
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default='info')  # info, warning, error, success
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # 关系
    user = relationship("User", foreign_keys=[user_id])


class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text)  # JSON格式存储
    description = Column(Text)
    category = Column(String(50))  # backup, notification, security, system等
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    updated_by_user = relationship("User", foreign_keys=[updated_by])

