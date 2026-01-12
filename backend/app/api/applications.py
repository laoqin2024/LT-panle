"""
应用管理API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.application import Application
from app.models.site import BusinessSite
from app.api.schemas import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationListResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/applications", tags=["应用管理"])


# ============ 应用CRUD ============

@router.get("", response_model=ApplicationListResponse, summary="获取应用列表")
async def get_applications(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    status: Optional[str] = Query(None, description="状态筛选"),
    app_type: Optional[str] = Query(None, description="应用类型筛选"),
    site_id: Optional[int] = Query(None, description="站点ID筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（名称）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取应用列表
    
    - 支持分页
    - 支持按状态筛选
    - 支持按应用类型筛选
    - 支持按站点ID筛选
    - 支持关键词搜索（名称）
    """
    # 构建查询
    query = select(Application).options(selectinload(Application.site))
    
    # 应用筛选条件
    conditions = []
    
    if status:
        conditions.append(Application.status == status)
    
    if app_type:
        conditions.append(Application.app_type == app_type)
    
    if site_id:
        conditions.append(Application.site_id == site_id)
    
    if search:
        conditions.append(Application.name.ilike(f"%{search}%"))
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Application)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Application.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    applications = result.scalars().all()
    
    return ApplicationListResponse(
        total=total,
        items=[ApplicationResponse.model_validate(app) for app in applications]
    )


@router.get("/{application_id}", response_model=ApplicationResponse, summary="获取应用详情")
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取应用详情
    """
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.site))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="应用不存在"
        )
    
    return ApplicationResponse.model_validate(application)


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED, summary="创建应用")
async def create_application(
    application_data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建应用
    
    - **name**: 应用名称（必填）
    - **site_id**: 关联站点ID（可选）
    - **app_type**: 应用类型（可选）
    - **config**: 应用配置（可选，JSON格式）
    - **port**: 端口（可选）
    - **process_name**: 进程名（可选）
    - **description**: 描述（可选）
    """
    # 如果指定了站点，验证站点是否存在
    if application_data.site_id:
        site_result = await db.execute(
            select(BusinessSite).where(BusinessSite.id == application_data.site_id)
        )
        site = site_result.scalar_one_or_none()
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的站点不存在"
            )
    
    # 创建应用
    application = Application(
        name=application_data.name,
        site_id=application_data.site_id,
        app_type=application_data.app_type,
        config=application_data.config,
        port=application_data.port,
        process_name=application_data.process_name,
        description=application_data.description,
        status="unknown",  # 初始状态为unknown
        created_by=current_user.id
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.site))
        .where(Application.id == application.id)
    )
    application = result.scalar_one()
    
    return ApplicationResponse.model_validate(application)


@router.put("/{application_id}", response_model=ApplicationResponse, summary="更新应用")
async def update_application(
    application_id: int,
    application_data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新应用信息
    """
    # 获取应用
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.site))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="应用不存在"
        )
    
    # 如果更新了站点，验证站点是否存在
    if application_data.site_id is not None:
        site_result = await db.execute(
            select(BusinessSite).where(BusinessSite.id == application_data.site_id)
        )
        site = site_result.scalar_one_or_none()
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的站点不存在"
            )
    
    # 更新字段
    update_data = application_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)
    
    await db.commit()
    await db.refresh(application)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.site))
        .where(Application.id == application.id)
    )
    application = result.scalar_one()
    
    return ApplicationResponse.model_validate(application)


@router.delete("/{application_id}", response_model=MessageResponse, summary="删除应用")
async def delete_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除应用
    """
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="应用不存在"
        )
    
    await db.delete(application)
    await db.commit()
    
    return MessageResponse(message="应用删除成功")


@router.get("/{application_id}/status", summary="获取应用状态")
async def get_application_status(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取应用状态（从服务器监控数据查询）
    
    注意：此接口需要从服务器监控系统查询实际状态
    """
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="应用不存在"
        )
    
    # TODO: 实现实际的状态查询逻辑
    # 需要根据process_name或port从服务器监控系统查询
    return {
        "application_id": application_id,
        "status": application.status,
        "message": "状态查询功能待实现，需要从服务器监控系统查询"
    }

