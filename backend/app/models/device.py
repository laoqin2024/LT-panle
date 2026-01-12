from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class NetworkDevice(Base):
    __tablename__ = "network_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    ip = Column(String(45), nullable=False, index=True)
    device_type = Column(String(50))  # Router, Switch, Firewall等
    model = Column(String(100))  # 设备型号，如：华为 S5700
    vendor = Column(String(50), default='huawei')  # 厂商：huawei, cisco, h3c等
    system_version = Column(String(100))  # 系统版本，如：VRP 5.170
    protocol = Column(String(20), default='SSH')  # SSH, Telnet, SNMP
    snmp_version = Column(String(10))  # v1, v2c, v3
    snmp_community = Column(String(100))
    network_type = Column(String(50), default='direct')  # direct, vpn, jump, tunnel
    jump_host_id = Column(Integer, ForeignKey('servers.id'), nullable=True)  # 跳板机ID
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
    interfaces = relationship("DeviceInterface", back_populates="device", cascade="all, delete-orphan")
    vlans = relationship("DeviceVLAN", back_populates="device", cascade="all, delete-orphan")
    # credentials 关系在 Credential 模型中定义（多态关系）
    configs = relationship("DeviceConfig", back_populates="device", cascade="all, delete-orphan")


class DeviceInterface(Base):
    __tablename__ = "device_interfaces"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('network_devices.id'), nullable=False)
    name = Column(String(100), nullable=False)  # 接口名称，如：GigabitEthernet0/0/1
    interface_type = Column(String(50))  # physical, vlan, loopback等
    status = Column(String(20))  # up, down, admin_down
    speed = Column(String(20))  # 10M, 100M, 1G, 10G等
    duplex = Column(String(20))  # full, half
    bytes_in = Column(BigInteger, default=0)
    bytes_out = Column(BigInteger, default=0)
    packets_in = Column(BigInteger, default=0)
    packets_out = Column(BigInteger, default=0)
    errors_in = Column(BigInteger, default=0)
    errors_out = Column(BigInteger, default=0)
    last_update = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    device = relationship("NetworkDevice", back_populates="interfaces")


class DeviceVLAN(Base):
    __tablename__ = "device_vlans"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('network_devices.id'), nullable=False)
    vlan_id = Column(Integer, nullable=False)
    name = Column(String(100))
    member_count = Column(Integer, default=0)  # 成员接口数量
    description = Column(Text)
    last_update = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    device = relationship("NetworkDevice", back_populates="vlans")


class DeviceConfig(Base):
    __tablename__ = "device_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('network_devices.id'), nullable=False)
    config_name = Column(String(255), nullable=False)  # 配置文件名
    file_path = Column(String(500))  # 配置文件路径
    config_content = Column(Text)  # 配置内容（可选，大文本）
    file_size = Column(BigInteger)
    backup_type = Column(String(50), default='manual')  # manual, auto
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # 关系
    device = relationship("NetworkDevice", back_populates="configs")
    created_by_user = relationship("User", foreign_keys=[created_by])

