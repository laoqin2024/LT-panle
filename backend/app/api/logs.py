"""
操作日志API路由
用于查看系统操作日志
"""
from typing import Optional
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.system import OperationLog
from app.models.user import User
from app.api.schemas import (
    OperationLogResponse,
    OperationLogListResponse,
)
from app.api.dependencies import get_current_active_user

router = APIRouter(prefix="/logs", tags=["操作日志"])


@router.get("", response_model=OperationLogListResponse, summary="获取操作日志列表")
async def get_operation_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取操作日志列表
    
    - **user_id**: 用户ID筛选
    - **action**: 操作类型筛选（如：create, update, delete）
    - **resource_type**: 资源类型筛选（如：server, device, database）
    - **resource_id**: 资源ID筛选
    - **start_time**: 开始时间筛选
    - **end_time**: 结束时间筛选
    - **search**: 搜索关键词（搜索操作类型和详情）
    """
    # 普通用户只能查看自己的日志
    if not current_user.is_superuser:
        user_id = current_user.id
    
    # 构建查询
    query = select(OperationLog).options(selectinload(OperationLog.user))
    
    # 应用筛选条件
    conditions = []
    
    if user_id is not None:
        conditions.append(OperationLog.user_id == user_id)
    
    if action:
        conditions.append(OperationLog.action.ilike(f"%{action}%"))
    
    if resource_type:
        conditions.append(OperationLog.resource_type == resource_type)
    
    if resource_id is not None:
        conditions.append(OperationLog.resource_id == resource_id)
    
    if start_time:
        conditions.append(OperationLog.created_at >= start_time)
    
    if end_time:
        conditions.append(OperationLog.created_at <= end_time)
    
    if search:
        conditions.append(
            or_(
                OperationLog.action.ilike(f"%{search}%"),
                OperationLog.details.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # 获取总数
    count_query = select(func.count()).select_from(OperationLog)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取分页数据
    result = await db.execute(
        query.order_by(OperationLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()
    
    # 转换为响应格式
    log_list = []
    for log in logs:
        # 解析details JSON
        details_str = None
        if log.details:
            try:
                details_obj = json.loads(log.details)
                details_str = json.dumps(details_obj, ensure_ascii=False, indent=2)
            except:
                details_str = log.details
        
        log_list.append(OperationLogResponse(
            id=log.id,
            user_id=log.user_id,
            username=log.user.username if log.user else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=details_str,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            created_at=log.created_at,
        ))
    
    return OperationLogListResponse(total=total, items=log_list)


@router.get("/{log_id}", response_model=OperationLogResponse, summary="获取操作日志详情")
async def get_operation_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取操作日志详情
    普通用户只能查看自己的日志
    """
    result = await db.execute(
        select(OperationLog)
        .options(selectinload(OperationLog.user))
        .where(OperationLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="操作日志不存在"
        )
    
    # 权限检查
    if not current_user.is_superuser and log.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查看其他用户的操作日志"
        )
    
    # 解析details JSON
    details_str = None
    if log.details:
        try:
            details_obj = json.loads(log.details)
            details_str = json.dumps(details_obj, ensure_ascii=False, indent=2)
        except:
            details_str = log.details
    
    return OperationLogResponse(
        id=log.id,
        user_id=log.user_id,
        username=log.user.username if log.user else None,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        details=details_str,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
    )


@router.get("/stats/summary", summary="获取操作日志统计")
async def get_log_stats(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取操作日志统计信息
    包括操作类型统计、资源类型统计等
    """
    # 普通用户只能查看自己的统计
    if not current_user.is_superuser:
        user_condition = OperationLog.user_id == current_user.id
    else:
        user_condition = None
    
    # 时间筛选
    time_conditions = []
    if start_time:
        time_conditions.append(OperationLog.created_at >= start_time)
    if end_time:
        time_conditions.append(OperationLog.created_at <= end_time)
    
    # 构建基础查询条件
    base_conditions = []
    if user_condition:
        base_conditions.append(user_condition)
    if time_conditions:
        base_conditions.extend(time_conditions)
    
    base_where = and_(*base_conditions) if base_conditions else None
    
    # 操作类型统计
    action_query = select(
        OperationLog.action,
        func.count().label('count')
    ).group_by(OperationLog.action)
    
    if base_where:
        action_query = action_query.where(base_where)
    
    action_result = await db.execute(action_query.order_by(func.count().desc()).limit(10))
    action_stats = {row.action: row.count for row in action_result.fetchall()}
    
    # 资源类型统计
    resource_query = select(
        OperationLog.resource_type,
        func.count().label('count')
    ).where(OperationLog.resource_type.isnot(None)).group_by(OperationLog.resource_type)
    
    if base_where:
        resource_query = resource_query.where(base_where)
    
    resource_result = await db.execute(resource_query.order_by(func.count().desc()).limit(10))
    resource_stats = {row.resource_type: row.count for row in resource_result.fetchall()}
    
    # 用户操作统计（仅超级用户）
    user_stats = {}
    if current_user.is_superuser:
        user_query = select(
            OperationLog.user_id,
            func.count().label('count')
        ).group_by(OperationLog.user_id)
        
        if base_where:
            user_query = user_query.where(base_where)
        
        user_result = await db.execute(
            user_query.order_by(func.count().desc()).limit(10)
        )
        
        # 获取用户名
        for row in user_result.fetchall():
            user_result_detail = await db.execute(
                select(User).where(User.id == row.user_id)
            )
            user = user_result_detail.scalar_one_or_none()
            if user:
                user_stats[user.username] = row.count
    
    # 总日志数
    total_query = select(func.count()).select_from(OperationLog)
    if base_where:
        total_query = total_query.where(base_where)
    total_result = await db.execute(total_query)
    total = total_result.scalar()
    
    return {
        "total": total,
        "action_stats": action_stats,
        "resource_stats": resource_stats,
        "user_stats": user_stats,
    }
