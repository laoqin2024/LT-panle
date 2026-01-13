from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Server(Base):
    __tablename__ = "servers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    host = Column(String(255), nullable=False, index=True)
    port = Column(Integer, default=22)
    server_type = Column(String(50))  # Linux, Windows
    os_info = Column(JSON)  # 操作系统信息
    status = Column(String(20), default='unknown')  # online, offline, unknown
    network_type = Column(String(50), default='direct')  # direct, vpn, jump, tunnel
    jump_host_id = Column(Integer, ForeignKey('servers.id'), nullable=True)  # 跳板机ID
    vpn_config = Column(JSON, nullable=True)  # VPN配置
    tunnel_config = Column(JSON, nullable=True)  # 内网穿透配置
    default_credential_id = Column(Integer, ForeignKey('credentials.id'), nullable=True)  # 默认凭据ID
    description = Column(Text)
    last_check = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    jump_host = relationship("Server", remote_side=[id])
    default_credential = relationship("Credential", foreign_keys=[default_credential_id])
    # credentials 关系在 Credential 模型中定义（多态关系）
    created_by_user = relationship("User", foreign_keys=[created_by])

