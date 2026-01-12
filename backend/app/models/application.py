from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey('business_sites.id'), nullable=True)
    app_type = Column(String(50))  # Web服务、数据库、缓存等
    config = Column(JSON)  # 应用配置
    status = Column(String(20), default='unknown')  # running, stopped, warning
    port = Column(Integer)
    process_name = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    site = relationship("BusinessSite", back_populates="applications")
    created_by_user = relationship("User", foreign_keys=[created_by])

