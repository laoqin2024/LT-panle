"""
告警服务
用于检查告警规则并发送通知
"""
import json
import asyncio
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.models.system import Setting, Notification
from app.api.websocket import push_alert_data


async def check_alert_rules():
    """
    检查所有启用的告警规则
    这是一个后台任务，应该定期调用
    """
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        # 获取所有启用的告警规则
        result = await db.execute(
            select(Setting).where(
                Setting.category == "alert_rule"
            )
        )
        rules = result.scalars().all()
        
        for rule_setting in rules:
            try:
                rule_data = json.loads(rule_setting.value) if rule_setting.value else {}
                
                # 检查规则是否启用
                if not rule_data.get("enabled", True):
                    continue
                
                # 检查告警条件
                await check_single_alert_rule(db, rule_setting.id, rule_data)
                
            except Exception as e:
                print(f"检查告警规则失败 (ID: {rule_setting.id}): {e}")


async def check_single_alert_rule(
    db: AsyncSession,
    rule_id: int,
    rule_data: dict
):
    """
    检查单个告警规则
    """
    resource_type = rule_data.get("resource_type")
    resource_id = rule_data.get("resource_id")
    metric_name = rule_data.get("metric_name")
    condition = rule_data.get("condition")
    threshold = rule_data.get("threshold", 0)
    
    if not all([resource_type, metric_name, condition]):
        return
    
    try:
        # 从TimescaleDB查询最新的监控数据
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
            return
        
        # 查询最新的监控数据
        query = text(f"""
            SELECT {metric_name}, time
            FROM {table_name}
            WHERE {id_column} = :resource_id
            ORDER BY time DESC
            LIMIT 1
        """)
        
        result = await db.execute(
            query.bindparams(resource_id=resource_id)
        )
        row = result.fetchone()
        
        if not row:
            return
        
        metric_value = getattr(row, metric_name, None)
        if metric_value is None:
            return
        
        # 检查告警条件
        should_alert = False
        if condition == "gt" and metric_value > threshold:
            should_alert = True
        elif condition == "lt" and metric_value < threshold:
            should_alert = True
        elif condition == "gte" and metric_value >= threshold:
            should_alert = True
        elif condition == "lte" and metric_value <= threshold:
            should_alert = True
        elif condition == "eq" and metric_value == threshold:
            should_alert = True
        
        if should_alert:
            # 创建告警通知
            await create_alert_notification(
                db,
                rule_id,
                rule_data,
                resource_type,
                resource_id,
                metric_name,
                metric_value,
                threshold
            )
    
    except Exception as e:
        print(f"检查告警规则失败: {e}")


async def create_alert_notification(
    db: AsyncSession,
    rule_id: int,
    rule_data: dict,
    resource_type: str,
    resource_id: int,
    metric_name: str,
    metric_value: float,
    threshold: float
):
    """
    创建告警通知
    """
    rule_name = rule_data.get("name", f"告警规则 #{rule_id}")
    condition = rule_data.get("condition", "")
    
    # 构建告警消息
    condition_text = {
        "gt": "大于",
        "lt": "小于",
        "gte": "大于等于",
        "lte": "小于等于",
        "eq": "等于"
    }.get(condition, condition)
    
    message = f"{resource_type} #{resource_id} 的 {metric_name} ({metric_value:.2f}) {condition_text} 阈值 ({threshold:.2f})"
    
    # 确定严重程度
    severity = "warning"
    if metric_value > threshold * 1.5 or metric_value < threshold * 0.5:
        severity = "error"
    
    # 检查是否已存在未解决的相同告警
    existing = await db.execute(
        select(Notification).where(
            Notification.type.in_(['error', 'warning']),
            Notification.is_read == False,
            Notification.message.like(f"%{resource_type} #{resource_id}%{metric_name}%")
        ).order_by(Notification.created_at.desc())
    )
    existing_alert = existing.scalar_one_or_none()
    
    # 如果最近5分钟内已有相同告警，不重复创建
    if existing_alert:
        time_diff = (datetime.utcnow() - existing_alert.created_at).total_seconds()
        if time_diff < 300:  # 5分钟
            return
    
    # 创建通知
    notification = Notification(
        user_id=None,  # 系统通知
        title=f"告警: {rule_name}",
        message=message,
        type=severity,
        is_read=False
    )
    
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    # 通过WebSocket推送告警
    try:
        await push_alert_data({
            "id": notification.id,
            "rule_id": rule_id,
            "rule_name": rule_name,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "threshold": threshold,
            "message": message,
            "severity": severity,
        })
    except Exception as e:
        print(f"推送告警失败: {e}")


# 后台任务（可以集成到Celery或使用asyncio定时任务）
async def alert_checker_loop():
    """
    告警检查循环
    每60秒检查一次告警规则
    """
    while True:
        try:
            await check_alert_rules()
        except Exception as e:
            print(f"告警检查失败: {e}")
        
        await asyncio.sleep(60)  # 每60秒检查一次


def start_alert_checker():
    """
    启动告警检查后台任务
    应该在应用启动时调用
    """
    import asyncio
    loop = asyncio.get_event_loop()
    loop.create_task(alert_checker_loop())
    print("✅ 告警检查后台任务已启动")
