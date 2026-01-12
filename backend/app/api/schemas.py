"""
API请求和响应模型
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ============ 认证相关 ============

class LoginRequest(BaseModel):
    """登录请求"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token响应"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role_id: int
    role_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """刷新Token请求"""
    refresh_token: str


# ============ 通用响应 ============

class MessageResponse(BaseModel):
    """消息响应"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """错误响应"""
    message: str
    detail: Optional[str] = None
    error_code: Optional[str] = None


# ============ 业务站点相关 ============

class BusinessGroupBase(BaseModel):
    """业务分组基础模型"""
    name: str
    type: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0


class BusinessGroupCreate(BusinessGroupBase):
    """创建业务分组请求"""
    pass


class BusinessGroupUpdate(BaseModel):
    """更新业务分组请求"""
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None


class BusinessGroupResponse(BusinessGroupBase):
    """业务分组响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessSiteBase(BaseModel):
    """业务站点基础模型"""
    name: str
    url: str
    type: Optional[str] = None
    group_id: Optional[int] = None
    description: Optional[str] = None
    is_monitored: bool = True


class BusinessSiteCreate(BusinessSiteBase):
    """创建业务站点请求"""
    pass


class BusinessSiteUpdate(BaseModel):
    """更新业务站点请求"""
    name: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    group_id: Optional[int] = None
    description: Optional[str] = None
    is_monitored: Optional[bool] = None


class BusinessSiteResponse(BusinessSiteBase):
    """业务站点响应"""
    id: int
    status: str
    last_check: Optional[datetime] = None
    last_response_time: Optional[int] = None
    ssl_expiry: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    group: Optional[BusinessGroupResponse] = None

    class Config:
        from_attributes = True


class BusinessSiteListResponse(BaseModel):
    """业务站点列表响应"""
    total: int
    items: list[BusinessSiteResponse]


# ============ 服务器相关 ============

class ServerBase(BaseModel):
    """服务器基础模型"""
    name: str
    host: str
    port: int = 22
    server_type: Optional[str] = None
    network_type: str = "direct"  # direct, vpn, jump, tunnel
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class ServerCreate(ServerBase):
    """创建服务器请求"""
    pass


class ServerUpdate(BaseModel):
    """更新服务器请求"""
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    server_type: Optional[str] = None
    network_type: Optional[str] = None
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class ServerResponse(ServerBase):
    """服务器响应"""
    id: int
    status: str
    os_info: Optional[dict] = None
    last_check: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    jump_host: Optional["ServerResponse"] = None

    class Config:
        from_attributes = True


class ServerListResponse(BaseModel):
    """服务器列表响应"""
    total: int
    items: list[ServerResponse]


# ============ 网络设备相关 ============

class NetworkDeviceBase(BaseModel):
    """网络设备基础模型"""
    name: str
    ip: str
    device_type: Optional[str] = None  # Router, Switch, Firewall等
    model: Optional[str] = None  # 设备型号
    vendor: str = "huawei"  # 厂商
    system_version: Optional[str] = None  # 系统版本
    protocol: str = "SSH"  # SSH, Telnet, SNMP
    snmp_version: Optional[str] = None
    snmp_community: Optional[str] = None
    network_type: str = "direct"  # direct, vpn, jump, tunnel
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class NetworkDeviceCreate(NetworkDeviceBase):
    """创建网络设备请求"""
    pass


class NetworkDeviceUpdate(BaseModel):
    """更新网络设备请求"""
    name: Optional[str] = None
    ip: Optional[str] = None
    device_type: Optional[str] = None
    model: Optional[str] = None
    vendor: Optional[str] = None
    system_version: Optional[str] = None
    protocol: Optional[str] = None
    snmp_version: Optional[str] = None
    snmp_community: Optional[str] = None
    network_type: Optional[str] = None
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class DeviceInterfaceResponse(BaseModel):
    """设备接口响应"""
    id: int
    device_id: int
    name: str
    interface_type: Optional[str] = None
    status: Optional[str] = None
    speed: Optional[str] = None
    duplex: Optional[str] = None
    bytes_in: int = 0
    bytes_out: int = 0
    packets_in: int = 0
    packets_out: int = 0
    errors_in: int = 0
    errors_out: int = 0
    last_update: Optional[datetime] = None

    class Config:
        from_attributes = True


class NetworkDeviceResponse(NetworkDeviceBase):
    """网络设备响应"""
    id: int
    status: str
    last_check: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    jump_host: Optional[ServerResponse] = None
    interfaces: list[DeviceInterfaceResponse] = []
    interface_count: Optional[int] = None  # 接口统计（up/down/total）

    class Config:
        from_attributes = True


class NetworkDeviceListResponse(BaseModel):
    """网络设备列表响应"""
    total: int
    items: list[NetworkDeviceResponse]


# ============ 数据库相关 ============

class DatabaseBase(BaseModel):
    """数据库基础模型"""
    name: str
    type: str  # PostgreSQL, MySQL, SQL Server
    host: str
    port: int
    database: str
    network_type: str = "direct"  # direct, vpn, jump, tunnel
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class DatabaseCreate(DatabaseBase):
    """创建数据库连接请求"""
    pass


class DatabaseUpdate(BaseModel):
    """更新数据库连接请求"""
    name: Optional[str] = None
    type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    network_type: Optional[str] = None
    jump_host_id: Optional[int] = None
    vpn_config: Optional[dict] = None
    tunnel_config: Optional[dict] = None
    description: Optional[str] = None


class DatabaseResponse(DatabaseBase):
    """数据库响应"""
    id: int
    status: str
    last_check: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    jump_host: Optional[ServerResponse] = None

    class Config:
        from_attributes = True


class DatabaseListResponse(BaseModel):
    """数据库列表响应"""
    total: int
    items: list[DatabaseResponse]


class DatabaseTestResponse(BaseModel):
    """数据库连接测试响应"""
    success: bool
    message: str
    connection_time: Optional[float] = None  # 连接耗时（秒）


# ============ 应用相关 ============

class ApplicationBase(BaseModel):
    """应用基础模型"""
    name: str
    site_id: Optional[int] = None
    app_type: Optional[str] = None  # Web服务、数据库、缓存等
    config: Optional[dict] = None
    port: Optional[int] = None
    process_name: Optional[str] = None
    description: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    """创建应用请求"""
    pass


class ApplicationUpdate(BaseModel):
    """更新应用请求"""
    name: Optional[str] = None
    site_id: Optional[int] = None
    app_type: Optional[str] = None
    config: Optional[dict] = None
    port: Optional[int] = None
    process_name: Optional[str] = None
    description: Optional[str] = None


class ApplicationResponse(ApplicationBase):
    """应用响应"""
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    site: Optional["BusinessSiteResponse"] = None

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    """应用列表响应"""
    total: int
    items: list[ApplicationResponse]


# ============ 凭据相关 ============

class CredentialBase(BaseModel):
    """凭据基础模型"""
    resource_type: str  # server, device, database, site
    resource_id: int
    credential_type: str  # password, ssh_key, api_key
    username: Optional[str] = None
    password: Optional[str] = None  # 明文密码（仅用于创建/更新，不返回）
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class CredentialCreate(CredentialBase):
    """创建凭据请求"""
    pass


class CredentialUpdate(BaseModel):
    """更新凭据请求"""
    username: Optional[str] = None
    password: Optional[str] = None  # 明文密码（仅用于更新）
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CredentialResponse(BaseModel):
    """凭据响应（不包含密码明文）"""
    id: int
    resource_type: str
    resource_id: int
    credential_type: str
    username: Optional[str] = None
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    # 不返回password_encrypted字段，保护敏感信息

    class Config:
        from_attributes = True


class CredentialListResponse(BaseModel):
    """凭据列表响应"""
    total: int
    items: list[CredentialResponse]


class CredentialDecryptResponse(BaseModel):
    """凭据解密响应"""
    password: str
    message: str = "密码已解密"


class CredentialPermissionResponse(BaseModel):
    """凭据权限响应"""
    id: int
    credential_id: int
    user_id: int
    permission_type: str
    granted_at: datetime
    expires_at: Optional[datetime] = None
    user: Optional[dict] = None  # 用户信息

    class Config:
        from_attributes = True


# ============ 备份恢复相关 ============

class BackupBase(BaseModel):
    """备份基础模型"""
    backup_name: str
    backup_type: str  # manual, daily, weekly, monthly
    backup_metadata: Optional[dict] = None


class BackupCreate(BackupBase):
    """创建备份请求"""
    pass


class BackupResponse(BaseModel):
    """备份响应"""
    id: int
    backup_name: str
    backup_type: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    backup_metadata: Optional[dict] = None
    created_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class BackupListResponse(BaseModel):
    """备份列表响应"""
    total: int
    items: list[BackupResponse]


class RestoreResponse(BaseModel):
    """恢复响应"""
    id: int
    backup_id: int
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    restored_by: int
    backup: Optional[BackupResponse] = None

    class Config:
        from_attributes = True


class RestoreListResponse(BaseModel):
    """恢复列表响应"""
    total: int
    items: list[RestoreResponse]


class RestoreCreate(BaseModel):
    """创建恢复请求"""
    backup_id: int


# ============ 系统设置相关 ============

class SettingBase(BaseModel):
    """系统设置基础模型"""
    key: str
    value: Optional[dict] = None  # JSON格式的值
    description: Optional[str] = None
    category: Optional[str] = None  # backup, notification, security, system等


class SettingCreate(SettingBase):
    """创建系统设置请求"""
    pass


class SettingUpdate(BaseModel):
    """更新系统设置请求"""
    value: Optional[dict] = None
    description: Optional[str] = None


class SettingResponse(BaseModel):
    """系统设置响应"""
    id: int
    key: str
    value: Optional[dict] = None
    description: Optional[str] = None
    category: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


class SettingsResponse(BaseModel):
    """系统设置响应（按分类组织）"""
    backup: Optional[dict] = None
    system: Optional[dict] = None
    notification: Optional[dict] = None
    security: Optional[dict] = None


class SettingsUpdateRequest(BaseModel):
    """批量更新系统设置请求"""
    backup: Optional[dict] = None
    system: Optional[dict] = None
    notification: Optional[dict] = None
    security: Optional[dict] = None


# ============ 网络配置相关 ============

class VPNConfigBase(BaseModel):
    """VPN配置基础模型"""
    name: str
    type: str  # openvpn, wireguard, ipsec
    config_file: Optional[str] = None
    config_content: Optional[str] = None
    description: Optional[str] = None


class VPNConfigCreate(VPNConfigBase):
    """创建VPN配置请求"""
    pass


class VPNConfigResponse(VPNConfigBase):
    """VPN配置响应"""
    id: int
    status: Optional[str] = None  # connected, disconnected
    connected_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VPNConfigListResponse(BaseModel):
    """VPN配置列表响应"""
    total: int
    items: list[VPNConfigResponse]


class TunnelConfigBase(BaseModel):
    """内网穿透配置基础模型"""
    name: str
    server_url: str
    client_token: Optional[str] = None
    description: Optional[str] = None


class TunnelConfigCreate(TunnelConfigBase):
    """创建内网穿透配置请求"""
    pass


class TunnelConfigResponse(TunnelConfigBase):
    """内网穿透配置响应"""
    id: int
    status: Optional[str] = None  # connected, disconnected
    connected_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TunnelConfigListResponse(BaseModel):
    """内网穿透配置列表响应"""
    total: int
    items: list[TunnelConfigResponse]


class NetworkTestRequest(BaseModel):
    """网络连接测试请求"""
    host: str
    port: int
    timeout: Optional[int] = 5


class NetworkTestResponse(BaseModel):
    """网络连接测试响应"""
    success: bool
    message: str
    latency: Optional[float] = None  # 延迟（毫秒）


# ============ 监控相关 ============

class MetricQueryParams(BaseModel):
    """监控数据查询参数"""
    resource_id: int
    resource_type: str  # server, device, site, database
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    interval: Optional[str] = "1h"  # 聚合间隔：1m, 5m, 1h, 1d


class ServerMetric(BaseModel):
    """服务器监控指标"""
    time: datetime
    server_id: int
    cpu_percent: Optional[float] = None
    memory_used: Optional[int] = None
    memory_total: Optional[int] = None
    memory_percent: Optional[float] = None
    disk_used: Optional[int] = None
    disk_total: Optional[int] = None
    disk_percent: Optional[float] = None
    network_in: Optional[int] = None
    network_out: Optional[int] = None
    load_avg_1m: Optional[float] = None
    load_avg_5m: Optional[float] = None
    load_avg_15m: Optional[float] = None


class DeviceMetric(BaseModel):
    """设备监控指标"""
    time: datetime
    device_id: int
    interface_name: Optional[str] = None
    interface_status: Optional[str] = None
    bytes_in: Optional[int] = None
    bytes_out: Optional[int] = None
    packets_in: Optional[int] = None
    packets_out: Optional[int] = None
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    temperature: Optional[int] = None


class SiteAvailability(BaseModel):
    """站点可用性指标"""
    time: datetime
    site_id: int
    status_code: Optional[int] = None
    response_time: Optional[int] = None
    is_available: Optional[bool] = None
    error_message: Optional[str] = None


class DatabaseMetric(BaseModel):
    """数据库监控指标"""
    time: datetime
    database_id: int
    connections_current: Optional[int] = None
    connections_max: Optional[int] = None
    queries_per_second: Optional[float] = None
    cache_hit_rate: Optional[float] = None
    database_size: Optional[int] = None


class MetricResponse(BaseModel):
    """监控数据响应"""
    resource_type: str
    resource_id: int
    metrics: list[dict]  # 根据resource_type返回不同的指标数据
    start_time: datetime
    end_time: datetime


class AlertRuleBase(BaseModel):
    """告警规则基础模型"""
    name: str
    resource_type: str  # server, device, site, database
    resource_id: Optional[int] = None  # null表示所有资源
    metric_name: str  # cpu_percent, memory_percent, response_time等
    condition: str  # gt, lt, eq, gte, lte
    threshold: float
    duration: int = 60  # 持续时间（秒）
    enabled: bool = True
    description: Optional[str] = None


class AlertRuleCreate(AlertRuleBase):
    """创建告警规则请求"""
    pass


class AlertRuleResponse(AlertRuleBase):
    """告警规则响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AlertRuleListResponse(BaseModel):
    """告警规则列表响应"""
    total: int
    items: list[AlertRuleResponse]


class AlertHistoryResponse(BaseModel):
    """告警历史响应"""
    id: int
    rule_id: int
    rule_name: str
    resource_type: str
    resource_id: int
    resource_name: str
    metric_name: str
    metric_value: float
    threshold: float
    message: str
    severity: str  # info, warning, error, critical
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlertHistoryListResponse(BaseModel):
    """告警历史列表响应"""
    total: int
    items: list[AlertHistoryResponse]


class DashboardStatsResponse(BaseModel):
    """仪表盘统计数据响应"""
    sites_total: int
    sites_online: int
    sites_offline: int
    servers_total: int
    servers_online: int
    servers_offline: int
    devices_total: int
    devices_online: int
    devices_offline: int
    databases_total: int
    databases_online: int
    databases_offline: int
    alerts_unresolved: int
    alerts_today: int


# ============ 用户管理相关 ============

class UserBase(BaseModel):
    """用户基础模型"""
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role_id: int = 2  # 默认普通用户
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(UserBase):
    """创建用户请求"""
    password: str


class UserUpdate(BaseModel):
    """更新用户请求"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    password: Optional[str] = None  # 可选密码更新


class UserListResponse(BaseModel):
    """用户列表响应"""
    total: int
    items: list[UserResponse]


class RoleBase(BaseModel):
    """角色基础模型"""
    name: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    """创建角色请求"""
    pass


class RoleUpdate(BaseModel):
    """更新角色请求"""
    name: Optional[str] = None
    description: Optional[str] = None


class RoleResponse(RoleBase):
    """角色响应"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    """角色列表响应"""
    total: int
    items: list[RoleResponse]


class PermissionBase(BaseModel):
    """权限基础模型"""
    name: str
    resource: str
    action: str
    description: Optional[str] = None


class PermissionResponse(PermissionBase):
    """权限响应"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PermissionListResponse(BaseModel):
    """权限列表响应"""
    total: int
    items: list[PermissionResponse]


class RolePermissionUpdate(BaseModel):
    """角色权限更新请求"""
    permission_ids: list[int]


# ============ 操作日志相关 ============

class OperationLogResponse(BaseModel):
    """操作日志响应"""
    id: int
    user_id: int
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogListResponse(BaseModel):
    """操作日志列表响应"""
    total: int
    items: list[OperationLogResponse]

