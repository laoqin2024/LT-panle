from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# 用户角色关联表
user_role_table = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
)

# 角色权限关联表
role_permission_table = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id'), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role_id = Column(Integer, ForeignKey('roles.id'), default=2)  # 默认普通用户
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    role = relationship("Role", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary=role_permission_table, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    resource = Column(String(50), nullable=False)  # server, device, database等
    action = Column(String(50), nullable=False)  # create, read, update, delete
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    roles = relationship("Role", secondary=role_permission_table, back_populates="permissions")


class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    token = Column(String(500), unique=True, nullable=False, index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    user = relationship("User", back_populates="sessions")

