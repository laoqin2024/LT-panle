from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Backup(Base):
    __tablename__ = "backups"
    
    id = Column(Integer, primary_key=True, index=True)
    backup_name = Column(String(255), nullable=False, index=True)
    backup_type = Column(String(50), nullable=False)  # manual, daily, weekly, monthly
    file_path = Column(String(500))
    file_size = Column(BigInteger)
    status = Column(String(50), default='in_progress')  # completed, failed, in_progress
    backup_metadata = Column(Text)  # JSON格式的元数据（metadata是保留字，改为backup_metadata）
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    # 关系
    created_by_user = relationship("User", foreign_keys=[created_by])
    restores = relationship("Restore", back_populates="backup", cascade="all, delete-orphan")


class Restore(Base):
    __tablename__ = "restores"
    
    id = Column(Integer, primary_key=True, index=True)
    backup_id = Column(Integer, ForeignKey('backups.id'), nullable=False)
    status = Column(String(50), default='in_progress')  # completed, failed, in_progress
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text)
    restored_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    backup = relationship("Backup", back_populates="restores")
    restored_by_user = relationship("User", foreign_keys=[restored_by])

