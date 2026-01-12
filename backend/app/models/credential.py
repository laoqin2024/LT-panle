from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class CredentialType(str, enum.Enum):
    PASSWORD = "password"
    SSH_KEY = "ssh_key"
    API_KEY = "api_key"


class ResourceType(str, enum.Enum):
    SERVER = "server"
    DEVICE = "device"
    DATABASE = "database"
    SITE = "site"


class PermissionType(str, enum.Enum):
    VIEW = "view"
    USE = "use"
    EDIT = "edit"
    DELETE = "delete"


class Credential(Base):
    __tablename__ = "credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    resource_type = Column(String(50), nullable=False)  # server, device, database, site
    resource_id = Column(Integer, nullable=False, index=True)
    credential_type = Column(String(50), nullable=False)  # password, ssh_key, api_key
    username = Column(String(255))
    password_encrypted = Column(Text, nullable=False)  # 加密后的密码
    ssh_key_path = Column(String(500))  # SSH密钥路径
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    created_by_user = relationship("User", foreign_keys=[created_by])
    permissions = relationship("CredentialPermission", back_populates="credential", cascade="all, delete-orphan")
    access_logs = relationship("CredentialAccessLog", back_populates="credential", cascade="all, delete-orphan")
    history = relationship("CredentialHistory", back_populates="credential", cascade="all, delete-orphan")
    
    # 多态关系（根据resource_type关联不同表）- 使用 viewonly 避免外键问题
    # 这些关系仅用于查询，不用于外键约束


class CredentialPermission(Base):
    __tablename__ = "credential_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey('credentials.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    permission_type = Column(String(50), nullable=False)  # view, use, edit, delete
    granted_by = Column(Integer, ForeignKey('users.id'))
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # 权限过期时间
    
    # 关系
    credential = relationship("Credential", back_populates="permissions")
    user = relationship("User", foreign_keys=[user_id])
    granted_by_user = relationship("User", foreign_keys=[granted_by])


class CredentialAccessLog(Base):
    __tablename__ = "credential_access_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey('credentials.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)  # view, use, decrypt, edit, delete
    ip_address = Column(String(45))
    user_agent = Column(Text)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    success = Column(Boolean, default=True)
    
    # 关系
    credential = relationship("Credential", back_populates="access_logs")
    user = relationship("User", foreign_keys=[user_id])


class CredentialHistory(Base):
    __tablename__ = "credential_history"
    
    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey('credentials.id'), nullable=False)
    password_encrypted = Column(Text, nullable=False)  # 历史密码（加密）
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    changed_by = Column(Integer, ForeignKey('users.id'))
    reason = Column(Text)  # 变更原因
    
    # 关系
    credential = relationship("Credential", back_populates="history")
    changed_by_user = relationship("User", foreign_keys=[changed_by])

