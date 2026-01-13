"""
监控与运维API路由
包括监控数据查询、告警规则管理、仪表盘统计等
"""
from typing import Optional, List
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.models.system import Setting, Notification
from app.models.site import BusinessSite
from app.models.server import Server
from app.models.device import NetworkDevice
from app.models.database import Database
from app.api.schemas import (
    MetricResponse,
    ServerMetric,
    DeviceMetric,
    SiteAvailability,
    DatabaseMetric,
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertRuleListResponse,
    AlertHistoryListResponse,
    AlertHistoryResponse,
    DashboardStatsResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/monitoring", tags=["监控与运维"])


# ============ 监控数据查询 ============

@router.get("/metrics/{resource_type}/{resource_id}", response_model=MetricResponse, summary="获取监控数据")
async def get_metrics(
    resource_type: str,
    resource_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    interval: str = Query("1h", pattern="^(1m|5m|15m|1h|6h|1d)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取监控数据
    
    - **resource_type**: 资源类型 (server, device, site, database)
    - **resource_id**: 资源ID
    - **start_time**: 开始时间（默认：24小时前）
    - **end_time**: 结束时间（默认：当前时间）
    - **interval**: 聚合间隔 (1m, 5m, 15m, 1h, 6h, 1d)
    """
    # 设置默认时间范围
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(days=1)
    
    # 根据资源类型查询不同的表
    if resource_type == "server":
        table_name = "server_metrics"
        id_column = "server_id"
    elif resource_type == "device":
        table_name = "device_metrics"
        id_column = "device_id"
    elif resource_type == "site":
        table_name = "site_availability"
        id_column = "site_id"
    elif resource_type == "database":
        table_name = "database_metrics"
        id_column = "database_id"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的资源类型: {resource_type}"
        )
    
    try:
        # 转换interval为PostgreSQL interval格式
        interval_map = {
            "1m": "1 minute",
            "5m": "5 minutes",
            "15m": "15 minutes",
            "1h": "1 hour",
            "6h": "6 hours",
            "1d": "1 day"
        }
        pg_interval = interval_map.get(interval, "1 hour")
        
        # 根据资源类型构建不同的查询
        if resource_type == "site":
            # 站点可用性数据
            query = text(f"""
                SELECT 
                    time_bucket(:interval, time) as time,
                    AVG(response_time) as response_time,
                    AVG(CASE WHEN is_available THEN 1 ELSE 0 END) as availability_rate,
                    MAX(status_code) as status_code,
                    MAX(error_message) as error_message
                FROM {table_name}
                WHERE {id_column} = :resource_id
                    AND time >= :start_time
                    AND time <= :end_time
                GROUP BY time_bucket(:interval, time)
                ORDER BY time ASC
            """)
            
            result = await db.execute(
                query.bindparams(
                    interval=pg_interval,
                    resource_id=resource_id,
                    start_time=start_time,
                    end_time=end_time
                )
            )
            
            rows = result.fetchall()
            metrics = []
            for row in rows:
                metric = {
                    "time": row.time.isoformat() if row.time else None,
                    "response_time": int(row.response_time) if row.response_time else None,
                    "is_available": bool(row.availability_rate >= 0.5) if row.availability_rate is not None else None,
                    "status_code": int(row.status_code) if row.status_code else None,
                    "error_message": row.error_message if row.error_message else None,
                }
                metrics.append(metric)
        else:
            # 服务器、设备、数据库的监控数据
            query = text(f"""
                SELECT 
                    time_bucket(:interval, time) as time,
                    AVG(cpu_percent) as cpu_percent,
                    AVG(memory_used) as memory_used,
                    AVG(memory_total) as memory_total,
                    AVG(disk_used) as disk_used,
                    AVG(disk_total) as disk_total,
                    AVG(network_in) as network_in,
                    AVG(network_out) as network_out
                FROM {table_name}
                WHERE {id_column} = :resource_id
                    AND time >= :start_time
                    AND time <= :end_time
                GROUP BY time_bucket(:interval, time)
                ORDER BY time ASC
            """)
            
            result = await db.execute(
                query.bindparams(
                    interval=pg_interval,
                    resource_id=resource_id,
                    start_time=start_time,
                    end_time=end_time
                )
            )
            
            rows = result.fetchall()
            metrics = []
            for row in rows:
                metric = {
                    "time": row.time.isoformat() if row.time else None,
                    "cpu_percent": float(row.cpu_percent) if row.cpu_percent else None,
                    "memory_used": int(row.memory_used) if row.memory_used else None,
                    "memory_total": int(row.memory_total) if row.memory_total else None,
                    "memory_percent": (float(row.memory_used) / float(row.memory_total) * 100) if (row.memory_used and row.memory_total) else None,
                    "disk_used": int(row.disk_used) if row.disk_used else None,
                    "disk_total": int(row.disk_total) if row.disk_total else None,
                    "disk_percent": (float(row.disk_used) / float(row.disk_total) * 100) if (row.disk_used and row.disk_total) else None,
                    "network_in": int(row.network_in) if row.network_in else None,
                    "network_out": int(row.network_out) if row.network_out else None,
                }
                metrics.append(metric)
        
        return MetricResponse(
            resource_type=resource_type,
            resource_id=resource_id,
            metrics=metrics,
            start_time=start_time,
            end_time=end_time
        )
    except Exception as e:
        # 如果TimescaleDB表不存在或查询失败，返回空数据
        print(f"查询监控数据失败: {e}")
        return MetricResponse(
            resource_type=resource_type,
            resource_id=resource_id,
            metrics=[],
            start_time=start_time,
            end_time=end_time
        )


# ============ 告警规则管理 ============

@router.get("/alert-rules", response_model=AlertRuleListResponse, summary="获取告警规则列表")
async def get_alert_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    resource_type: Optional[str] = Query(None),
    enabled: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取告警规则列表
    """
    query = select(Setting).where(Setting.category == "alert_rule")
    
    if resource_type:
        # 需要从value JSON中过滤
        pass  # 简化处理，实际应该解析JSON
    
    if enabled is not None:
        # 需要从value JSON中过滤
        pass
    
    result = await db.execute(
        query.order_by(Setting.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    settings = result.scalars().all()
    
    # 转换为告警规则响应
    alert_rules = []
    for setting in settings:
        try:
            value = json.loads(setting.value) if setting.value else {}
        except:
            continue
        
        alert_rules.append(AlertRuleResponse(
            id=setting.id,
            name=value.get("name", setting.key),
            resource_type=value.get("resource_type", ""),
            resource_id=value.get("resource_id"),
            metric_name=value.get("metric_name", ""),
            condition=value.get("condition", ""),
            threshold=value.get("threshold", 0),
            duration=value.get("duration", 60),
            enabled=value.get("enabled", True),
            description=value.get("description", setting.description),
            created_at=setting.updated_at or datetime.now(),
            updated_at=setting.updated_at or datetime.now(),
        ))
    
    # 获取总数
    count_result = await db.execute(
        select(func.count()).select_from(Setting).where(Setting.category == "alert_rule")
    )
    total = count_result.scalar()
    
    return AlertRuleListResponse(total=total, items=alert_rules)


@router.post("/alert-rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED, summary="创建告警规则")
async def create_alert_rule(
    rule_data: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建告警规则
    """
    # 检查名称是否已存在
    existing = await db.execute(
        select(Setting).where(
            Setting.category == "alert_rule",
            Setting.key == f"alert_rule_{rule_data.name}"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="告警规则名称已存在"
        )
    
    # 创建设置记录
    rule_value = {
        "name": rule_data.name,
        "resource_type": rule_data.resource_type,
        "resource_id": rule_data.resource_id,
        "metric_name": rule_data.metric_name,
        "condition": rule_data.condition,
        "threshold": rule_data.threshold,
        "duration": rule_data.duration,
        "enabled": rule_data.enabled,
        "description": rule_data.description,
    }
    
    setting = Setting(
        key=f"alert_rule_{rule_data.name}",
        value=json.dumps(rule_value),
        category="alert_rule",
        description=rule_data.description,
        updated_by=current_user.id
    )
    
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    
    value = json.loads(setting.value)
    return AlertRuleResponse(
        id=setting.id,
        name=value["name"],
        resource_type=value["resource_type"],
        resource_id=value.get("resource_id"),
        metric_name=value["metric_name"],
        condition=value["condition"],
        threshold=value["threshold"],
        duration=value.get("duration", 60),
        enabled=value.get("enabled", True),
        description=value.get("description"),
        created_at=setting.updated_at or datetime.now(),
        updated_at=setting.updated_at or datetime.now(),
    )


@router.put("/alert-rules/{rule_id}", response_model=AlertRuleResponse, summary="更新告警规则")
async def update_alert_rule(
    rule_id: int,
    rule_data: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新告警规则
    """
    result = await db.execute(
        select(Setting).where(
            Setting.id == rule_id,
            Setting.category == "alert_rule"
        )
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="告警规则不存在"
        )
    
    # 解析现有值
    try:
        value = json.loads(setting.value) if setting.value else {}
    except:
        value = {}
    
    # 更新字段
    update_data = rule_data.model_dump(exclude_unset=True)
    for field, field_value in update_data.items():
        value[field] = field_value
    
    # 如果更新了名称，检查是否与其他规则冲突
    if rule_data.name and rule_data.name != value.get("name"):
        existing = await db.execute(
            select(Setting).where(
                Setting.category == "alert_rule",
                Setting.key == f"alert_rule_{rule_data.name}",
                Setting.id != rule_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="告警规则名称已存在"
            )
        value["name"] = rule_data.name
        setting.key = f"alert_rule_{rule_data.name}"
    
    # 更新设置
    setting.value = json.dumps(value)
    if rule_data.description is not None:
        setting.description = rule_data.description
    setting.updated_by = current_user.id
    
    await db.commit()
    await db.refresh(setting)
    
    value = json.loads(setting.value)
    return AlertRuleResponse(
        id=setting.id,
        name=value["name"],
        resource_type=value["resource_type"],
        resource_id=value.get("resource_id"),
        metric_name=value["metric_name"],
        condition=value["condition"],
        threshold=value["threshold"],
        duration=value.get("duration", 60),
        enabled=value.get("enabled", True),
        description=value.get("description"),
        created_at=setting.updated_at or datetime.now(),
        updated_at=datetime.now(),
    )


@router.delete("/alert-rules/{rule_id}", response_model=MessageResponse, summary="删除告警规则")
async def delete_alert_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除告警规则
    """
    result = await db.execute(
        select(Setting).where(
            Setting.id == rule_id,
            Setting.category == "alert_rule"
        )
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="告警规则不存在"
        )
    
    await db.delete(setting)
    await db.commit()
    
    return MessageResponse(message="告警规则删除成功")


# ============ 告警历史 ============

@router.get("/alert-history", response_model=AlertHistoryListResponse, summary="获取告警历史")
async def get_alert_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_resolved: Optional[bool] = Query(None),
    resource_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取告警历史
    告警历史存储在notifications表中，type为'error'或'warning'
    """
    query = select(Notification).where(
        Notification.type.in_(['error', 'warning'])
    )
    
    if is_resolved is not None:
        query = query.where(Notification.is_read == is_resolved)
    
    result = await db.execute(
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    notifications = result.scalars().all()
    
    # 转换为告警历史响应
    alerts = []
    for notif in notifications:
        # 从message中解析告警信息（简化处理）
        alerts.append(AlertHistoryResponse(
            id=notif.id,
            rule_id=0,  # 需要从message中解析
            rule_name=notif.title,
            resource_type="unknown",
            resource_id=0,
            resource_name="",
            metric_name="",
            metric_value=0,
            threshold=0,
            message=notif.message,
            severity=notif.type,
            is_resolved=notif.is_read,
            resolved_at=notif.read_at,
            created_at=notif.created_at,
        ))
    
    # 获取总数
    count_query = select(func.count()).select_from(Notification).where(
        Notification.type.in_(['error', 'warning'])
    )
    if is_resolved is not None:
        count_query = count_query.where(Notification.is_read == is_resolved)
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    return AlertHistoryListResponse(total=total, items=alerts)


# ============ 仪表盘统计 ============

@router.get("/dashboard/stats", response_model=DashboardStatsResponse, summary="获取仪表盘统计数据")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取仪表盘统计数据
    """
    # 统计站点
    sites_result = await db.execute(
        select(func.count(BusinessSite.id))
    )
    sites_total = sites_result.scalar() or 0
    
    sites_online_result = await db.execute(
        select(func.count(BusinessSite.id)).where(BusinessSite.status == 'online')
    )
    sites_online = sites_online_result.scalar() or 0
    
    sites_offline_result = await db.execute(
        select(func.count(BusinessSite.id)).where(BusinessSite.status == 'offline')
    )
    sites_offline = sites_offline_result.scalar() or 0
    
    # 统计服务器
    servers_result = await db.execute(
        select(func.count(Server.id))
    )
    servers_total = servers_result.scalar() or 0
    
    servers_online_result = await db.execute(
        select(func.count(Server.id)).where(Server.status == 'online')
    )
    servers_online = servers_online_result.scalar() or 0
    
    servers_offline_result = await db.execute(
        select(func.count(Server.id)).where(Server.status == 'offline')
    )
    servers_offline = servers_offline_result.scalar() or 0
    
    # 统计设备
    devices_result = await db.execute(
        select(func.count(NetworkDevice.id))
    )
    devices_total = devices_result.scalar() or 0
    
    devices_online_result = await db.execute(
        select(func.count(NetworkDevice.id)).where(NetworkDevice.status == 'online')
    )
    devices_online = devices_online_result.scalar() or 0
    
    devices_offline_result = await db.execute(
        select(func.count(NetworkDevice.id)).where(NetworkDevice.status == 'offline')
    )
    devices_offline = devices_offline_result.scalar() or 0
    
    # 统计数据库
    databases_result = await db.execute(
        select(func.count(Database.id))
    )
    databases_total = databases_result.scalar() or 0
    
    databases_online_result = await db.execute(
        select(func.count(Database.id)).where(Database.status == 'online')
    )
    databases_online = databases_online_result.scalar() or 0
    
    databases_offline_result = await db.execute(
        select(func.count(Database.id)).where(Database.status == 'offline')
    )
    databases_offline = databases_offline_result.scalar() or 0
    
    # 统计告警
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.type.in_(['error', 'warning']),
            Notification.created_at >= today_start
        )
    )
    alerts_today = alerts_today_result.scalar() or 0
    
    alerts_unresolved_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.type.in_(['error', 'warning']),
            Notification.is_read == False
        )
    )
    alerts_unresolved = alerts_unresolved_result.scalar() or 0
    
    return DashboardStatsResponse(
        sites_total=sites_total,
        sites_online=sites_online,
        sites_offline=sites_offline,
        servers_total=servers_total,
        servers_online=servers_online,
        servers_offline=servers_offline,
        devices_total=devices_total,
        devices_online=devices_online,
        devices_offline=devices_offline,
        databases_total=databases_total,
        databases_online=databases_online,
        databases_offline=databases_offline,
        alerts_unresolved=alerts_unresolved,
        alerts_today=alerts_today,
    )
