"""
备份恢复API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.backup import Backup, Restore
from app.api.schemas import (
    BackupCreate,
    BackupResponse,
    BackupListResponse,
    RestoreCreate,
    RestoreResponse,
    RestoreListResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User
from datetime import datetime

router = APIRouter(prefix="/backups", tags=["备份恢复"])


# ============ 备份CRUD ============

@router.get("", response_model=BackupListResponse, summary="获取备份列表")
async def get_backups(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    backup_type: Optional[str] = Query(None, description="备份类型筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取备份列表
    
    - 支持分页
    - 支持按备份类型筛选
    - 支持按状态筛选
    """
    # 构建查询
    query = select(Backup)
    
    # 应用筛选条件
    conditions = []
    
    if backup_type:
        conditions.append(Backup.backup_type == backup_type)
    
    if status:
        conditions.append(Backup.status == status)
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Backup)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Backup.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    backups = result.scalars().all()
    
    # 处理backup_metadata（JSON字符串转dict）
    import json
    items = []
    for backup in backups:
        backup_dict = BackupResponse.model_validate(backup).model_dump()
        if backup.backup_metadata:
            try:
                backup_dict['backup_metadata'] = json.loads(backup.backup_metadata)
            except:
                backup_dict['backup_metadata'] = None
        items.append(BackupResponse(**backup_dict))
    
    return BackupListResponse(
        total=total,
        items=items
    )


@router.get("/{backup_id}", response_model=BackupResponse, summary="获取备份详情")
async def get_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取备份详情
    """
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()
    
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="备份不存在"
        )
    
    # 处理backup_metadata（JSON字符串转dict）
    import json
    backup_dict = BackupResponse.model_validate(backup).model_dump()
    if backup.backup_metadata:
        try:
            backup_dict['backup_metadata'] = json.loads(backup.backup_metadata)
        except:
            backup_dict['backup_metadata'] = None
    
    return BackupResponse(**backup_dict)


@router.post("", response_model=BackupResponse, status_code=status.HTTP_201_CREATED, summary="创建备份")
async def create_backup(
    backup_data: BackupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建备份
    
    - **backup_name**: 备份名称（必填）
    - **backup_type**: 备份类型（manual/daily/weekly/monthly，必填）
    - **backup_metadata**: 备份元数据（可选，JSON格式）
    
    注意：实际备份文件创建需要后台任务处理
    """
    # 创建备份记录
    import json
    backup = Backup(
        backup_name=backup_data.backup_name,
        backup_type=backup_data.backup_type,
        backup_metadata=json.dumps(backup_data.backup_metadata) if backup_data.backup_metadata else None,
        status="in_progress",  # 初始状态为进行中
        created_by=current_user.id
    )
    
    db.add(backup)
    await db.commit()
    await db.refresh(backup)
    
    # TODO: 触发后台任务执行实际备份操作
    # 这里应该使用Celery或其他任务队列来执行备份
    # 备份完成后更新status和file_path、file_size
    
    return BackupResponse.model_validate(backup)


@router.delete("/{backup_id}", response_model=MessageResponse, summary="删除备份")
async def delete_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除备份
    
    注意：此操作会删除备份记录和备份文件
    """
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()
    
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="备份不存在"
        )
    
    # TODO: 删除备份文件
    # import os
    # if backup.file_path and os.path.exists(backup.file_path):
    #     os.remove(backup.file_path)
    
    await db.delete(backup)
    await db.commit()
    
    return MessageResponse(message="备份删除成功")


# ============ 恢复操作 ============

@router.post("/{backup_id}/restore", response_model=RestoreResponse, summary="恢复备份")
async def restore_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    恢复备份
    
    注意：此操作会覆盖当前数据，需要谨慎操作
    """
    # 验证备份存在
    backup_result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = backup_result.scalar_one_or_none()
    
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="备份不存在"
        )
    
    if backup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能恢复已完成的备份"
        )
    
    # 创建恢复记录
    restore = Restore(
        backup_id=backup_id,
        status="in_progress",
        restored_by=current_user.id
    )
    
    db.add(restore)
    await db.commit()
    await db.refresh(restore)
    
    # TODO: 触发后台任务执行实际恢复操作
    # 恢复完成后更新status和completed_at
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Restore)
        .options(selectinload(Restore.backup))
        .where(Restore.id == restore.id)
    )
    restore = result.scalar_one()
    
    return RestoreResponse.model_validate(restore)


@router.get("/restores", response_model=RestoreListResponse, summary="获取恢复历史")
async def get_restores(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    status: Optional[str] = Query(None, description="状态筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取恢复历史列表
    """
    # 构建查询
    query = select(Restore).options(selectinload(Restore.backup))
    
    # 应用筛选条件
    conditions = []
    
    if status:
        conditions.append(Restore.status == status)
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Restore)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Restore.started_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    restores = result.scalars().all()
    
    return RestoreListResponse(
        total=total,
        items=[RestoreResponse.model_validate(restore) for restore in restores]
    )


@router.get("/restores/{restore_id}", response_model=RestoreResponse, summary="获取恢复详情")
async def get_restore(
    restore_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取恢复详情
    """
    result = await db.execute(
        select(Restore)
        .options(selectinload(Restore.backup))
        .where(Restore.id == restore_id)
    )
    restore = result.scalar_one_or_none()
    
    if not restore:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="恢复记录不存在"
        )
    
    return RestoreResponse.model_validate(restore)

