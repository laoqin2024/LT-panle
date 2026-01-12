from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BusinessGroup(Base):
    __tablename__ = "business_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    type = Column(String(50))  # 分组类型
    description = Column(Text)
    parent_id = Column(Integer, ForeignKey('business_groups.id'), nullable=True)  # 支持树形结构
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    parent = relationship("BusinessGroup", remote_side=[id], backref="children")
    sites = relationship("BusinessSite", back_populates="group")


class BusinessSite(Base):
    __tablename__ = "business_sites"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    url = Column(String(255), nullable=False)
    type = Column(String(50))  # Web应用、API服务、文档站点等
    group_id = Column(Integer, ForeignKey('business_groups.id'), nullable=True)
    description = Column(Text)
    status = Column(String(20), default='unknown')  # online, offline, warning, unknown
    last_check = Column(DateTime(timezone=True))
    last_response_time = Column(Integer)  # 响应时间（毫秒）
    ssl_expiry = Column(DateTime(timezone=True))  # SSL证书过期时间
    is_monitored = Column(Boolean, default=True)  # 是否监控
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    group = relationship("BusinessGroup", back_populates="sites")
    applications = relationship("Application", back_populates="site")

