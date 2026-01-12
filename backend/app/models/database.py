from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Database(Base):
    __tablename__ = "databases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # PostgreSQL, MySQL, SQL Server
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database = Column(String(100), nullable=False)
    network_type = Column(String(50), default='direct')  # direct, vpn, jump, tunnel
    jump_host_id = Column(Integer, ForeignKey('servers.id'), nullable=True)
    vpn_config = Column(JSON, nullable=True)
    tunnel_config = Column(JSON, nullable=True)
    status = Column(String(20), default='unknown')  # online, offline, warning
    description = Column(Text)
    last_check = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    jump_host = relationship("Server", foreign_keys=[jump_host_id])
    # credentials 关系在 Credential 模型中定义（多态关系）
    backups = relationship("DatabaseBackup", back_populates="database", cascade="all, delete-orphan")
    created_by_user = relationship("User", foreign_keys=[created_by])


class DatabaseBackup(Base):
    __tablename__ = "database_backups"
    
    id = Column(Integer, primary_key=True, index=True)
    database_id = Column(Integer, ForeignKey('databases.id'), nullable=False)
    backup_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_size = Column(BigInteger)
    backup_type = Column(String(50), default='manual')  # manual, auto
    status = Column(String(50), default='completed')  # completed, failed, in_progress
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    database = relationship("Database", back_populates="backups")
    created_by_user = relationship("User", foreign_keys=[created_by])

