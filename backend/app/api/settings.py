"""
系统设置API路由
"""
from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.system import Setting
from app.api.schemas import (
    SettingsResponse,
    SettingsUpdateRequest,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["系统设置"])


# ============ 系统设置CRUD ============

@router.get("", response_model=SettingsResponse, summary="获取系统设置")
async def get_settings(
    category: Optional[str] = Query(None, description="设置分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取系统设置
    
    - 支持按分类筛选
    - 返回按分类组织的设置
    """
    query = select(Setting)
    
    if category:
        query = query.where(Setting.category == category)
    
    result = await db.execute(query)
    settings = result.scalars().all()
    
    # 按分类组织设置
    response_data = {}
    for setting in settings:
        cat = setting.category or "system"
        if cat not in response_data:
            response_data[cat] = {}
        
        # 解析JSON值
        try:
            value = json.loads(setting.value) if setting.value else None
        except:
            value = setting.value
        
        response_data[cat][setting.key] = value
    
    return SettingsResponse(**response_data)


@router.put("", response_model=MessageResponse, summary="更新系统设置")
async def update_settings(
    settings_data: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    批量更新系统设置
    
    - 可以更新多个分类的设置
    - 设置值以JSON格式存储
    """
    categories = {
        "backup": settings_data.backup,
        "system": settings_data.system,
        "notification": settings_data.notification,
        "security": settings_data.security,
    }
    
    updated_count = 0
    
    for category, values in categories.items():
        if values is None:
            continue
        
        for key, value in values.items():
            # 查找或创建设置
            result = await db.execute(
                select(Setting).where(
                    Setting.key == key,
                    Setting.category == category
                )
            )
            setting = result.scalar_one_or_none()
            
            if setting:
                # 更新现有设置
                setting.value = json.dumps(value) if value is not None else None
                setting.updated_by = current_user.id
            else:
                # 创建新设置
                setting = Setting(
                    key=key,
                    value=json.dumps(value) if value is not None else None,
                    category=category,
                    updated_by=current_user.id
                )
                db.add(setting)
            
            updated_count += 1
    
    await db.commit()
    
    return MessageResponse(message=f"成功更新 {updated_count} 项设置")


@router.get("/{key}", summary="获取单个设置")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取单个系统设置
    """
    result = await db.execute(
        select(Setting).where(Setting.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="设置不存在"
        )
    
    # 解析JSON值
    try:
        value = json.loads(setting.value) if setting.value else None
    except:
        value = setting.value
    
    return {
        "key": setting.key,
        "value": value,
        "category": setting.category,
        "description": setting.description,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
    }


@router.put("/{key}", summary="更新单个设置")
async def update_setting(
    key: str,
    value: dict,
    category: Optional[str] = Query(None, description="设置分类"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新单个系统设置
    """
    result = await db.execute(
        select(Setting).where(Setting.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        # 更新现有设置
        setting.value = json.dumps(value) if value else None
        if category:
            setting.category = category
        setting.updated_by = current_user.id
    else:
        # 创建新设置
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="创建新设置时必须提供category参数"
            )
        setting = Setting(
            key=key,
            value=json.dumps(value) if value else None,
            category=category,
            updated_by=current_user.id
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return MessageResponse(message="设置更新成功")
