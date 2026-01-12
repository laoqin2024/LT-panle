"""
业务站点管理API路由
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.site import BusinessSite, BusinessGroup
from app.api.schemas import (
    BusinessSiteCreate,
    BusinessSiteUpdate,
    BusinessSiteResponse,
    BusinessSiteListResponse,
    BusinessGroupCreate,
    BusinessGroupUpdate,
    BusinessGroupResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/sites", tags=["业务站点"])


# ============ 业务分组CRUD（必须在 /{site_id} 路由之前） ============

@router.get("/groups", response_model=List[BusinessGroupResponse], summary="获取分组列表")
async def get_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取所有业务分组列表
    """
    result = await db.execute(
        select(BusinessGroup).order_by(BusinessGroup.sort_order, BusinessGroup.created_at)
    )
    groups = result.scalars().all()
    
    return [BusinessGroupResponse.model_validate(group) for group in groups]


@router.post("/groups", response_model=BusinessGroupResponse, status_code=status.HTTP_201_CREATED, summary="创建分组")
async def create_group(
    group_data: BusinessGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建业务分组
    """
    # 如果指定了父分组，验证父分组是否存在
    if group_data.parent_id:
        parent_result = await db.execute(
            select(BusinessGroup).where(BusinessGroup.id == group_data.parent_id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的父分组不存在"
            )
    
    # 检查名称是否已存在（同一父分组下）
    existing_result = await db.execute(
        select(BusinessGroup).where(
            BusinessGroup.name == group_data.name,
            BusinessGroup.parent_id == group_data.parent_id
        )
    )
    existing_group = existing_result.scalar_one_or_none()
    if existing_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该分组名称已存在"
        )
    
    # 创建分组
    group = BusinessGroup(**group_data.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    return BusinessGroupResponse.model_validate(group)


@router.put("/groups/{group_id}", response_model=BusinessGroupResponse, summary="更新分组")
async def update_group(
    group_id: int,
    group_data: BusinessGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新业务分组
    """
    result = await db.execute(
        select(BusinessGroup).where(BusinessGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分组不存在"
        )
    
    # 如果更新了父分组，验证父分组是否存在（且不能是自己）
    if group_data.parent_id is not None:
        if group_data.parent_id == group_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将分组设置为自己的父分组"
            )
        parent_result = await db.execute(
            select(BusinessGroup).where(BusinessGroup.id == group_data.parent_id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的父分组不存在"
            )
    
    # 更新字段
    update_data = group_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)
    
    await db.commit()
    await db.refresh(group)
    
    return BusinessGroupResponse.model_validate(group)


@router.delete("/groups/{group_id}", response_model=MessageResponse, summary="删除分组")
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除业务分组
    
    注意：如果分组下有站点或子分组，需要先处理
    """
    result = await db.execute(
        select(BusinessGroup).where(BusinessGroup.id == group_id)
    )
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分组不存在"
        )
    
    # 检查是否有子分组
    children_result = await db.execute(
        select(BusinessGroup).where(BusinessGroup.parent_id == group_id)
    )
    children = children_result.scalars().all()
    if children:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该分组下存在子分组，请先删除子分组"
        )
    
    # 检查是否有站点
    sites_result = await db.execute(
        select(BusinessSite).where(BusinessSite.group_id == group_id)
    )
    sites = sites_result.scalars().all()
    if sites:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该分组下存在站点，请先移除或删除站点"
        )
    
    await db.delete(group)
    await db.commit()
    
    return MessageResponse(message="分组删除成功")


# ============ 业务站点CRUD ============

@router.get("", response_model=BusinessSiteListResponse, summary="获取站点列表")
async def get_sites(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    group_id: Optional[int] = Query(None, description="分组ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（名称或URL）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取业务站点列表
    
    - 支持分页
    - 支持按分组筛选
    - 支持按状态筛选
    - 支持关键词搜索（名称或URL）
    """
    # 构建查询
    query = select(BusinessSite).options(selectinload(BusinessSite.group))
    
    # 应用筛选条件
    conditions = []
    
    if group_id is not None:
        conditions.append(BusinessSite.group_id == group_id)
    
    if status:
        conditions.append(BusinessSite.status == status)
    
    if search:
        conditions.append(
            or_(
                BusinessSite.name.ilike(f"%{search}%"),
                BusinessSite.url.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(BusinessSite)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(BusinessSite.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    sites = result.scalars().all()
    
    return BusinessSiteListResponse(
        total=total,
        items=[BusinessSiteResponse.model_validate(site) for site in sites]
    )


@router.get("/{site_id}", response_model=BusinessSiteResponse, summary="获取站点详情")
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取业务站点详情
    """
    result = await db.execute(
        select(BusinessSite)
        .options(selectinload(BusinessSite.group))
        .where(BusinessSite.id == site_id)
    )
    site = result.scalar_one_or_none()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="站点不存在"
        )
    
    return BusinessSiteResponse.model_validate(site)


@router.post("", response_model=BusinessSiteResponse, status_code=status.HTTP_201_CREATED, summary="创建站点")
async def create_site(
    site_data: BusinessSiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建业务站点
    
    - **name**: 站点名称（必填）
    - **url**: 站点URL（必填）
    - **type**: 站点类型（可选）
    - **group_id**: 所属分组ID（可选）
    - **description**: 描述（可选）
    - **is_monitored**: 是否监控（默认True）
    """
    # 如果指定了分组，验证分组是否存在
    if site_data.group_id:
        group_result = await db.execute(
            select(BusinessGroup).where(BusinessGroup.id == site_data.group_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的分组不存在"
            )
    
    # 检查URL是否已存在
    existing_result = await db.execute(
        select(BusinessSite).where(BusinessSite.url == site_data.url)
    )
    existing_site = existing_result.scalar_one_or_none()
    if existing_site:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该URL已存在"
        )
    
    # 创建站点
    site = BusinessSite(
        name=site_data.name,
        url=site_data.url,
        type=site_data.type,
        group_id=site_data.group_id,
        description=site_data.description,
        is_monitored=site_data.is_monitored,
        status="unknown"  # 初始状态为unknown
    )
    
    db.add(site)
    await db.commit()
    await db.refresh(site)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(BusinessSite)
        .options(selectinload(BusinessSite.group))
        .where(BusinessSite.id == site.id)
    )
    site = result.scalar_one()
    
    return BusinessSiteResponse.model_validate(site)


@router.put("/{site_id}", response_model=BusinessSiteResponse, summary="更新站点")
async def update_site(
    site_id: int,
    site_data: BusinessSiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新业务站点信息
    """
    # 获取站点
    result = await db.execute(
        select(BusinessSite)
        .options(selectinload(BusinessSite.group))
        .where(BusinessSite.id == site_id)
    )
    site = result.scalar_one_or_none()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="站点不存在"
        )
    
    # 如果更新了分组，验证分组是否存在
    if site_data.group_id is not None and site_data.group_id != site.group_id:
        group_result = await db.execute(
            select(BusinessGroup).where(BusinessGroup.id == site_data.group_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的分组不存在"
            )
    
    # 如果更新了URL，检查是否与其他站点冲突
    if site_data.url and site_data.url != site.url:
        existing_result = await db.execute(
            select(BusinessSite).where(
                BusinessSite.url == site_data.url,
                BusinessSite.id != site_id
            )
        )
        existing_site = existing_result.scalar_one_or_none()
        if existing_site:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该URL已被其他站点使用"
            )
    
    # 更新字段
    update_data = site_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(site, field, value)
    
    await db.commit()
    await db.refresh(site)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(BusinessSite)
        .options(selectinload(BusinessSite.group))
        .where(BusinessSite.id == site.id)
    )
    site = result.scalar_one()
    
    return BusinessSiteResponse.model_validate(site)


@router.delete("/{site_id}", response_model=MessageResponse, summary="删除站点")
async def delete_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除业务站点
    """
    result = await db.execute(
        select(BusinessSite).where(BusinessSite.id == site_id)
    )
    site = result.scalar_one_or_none()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="站点不存在"
        )
    
    await db.delete(site)
    await db.commit()
    
    return MessageResponse(message="站点删除成功")


@router.get("/{site_id}/status", summary="获取站点状态")
async def get_site_status(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取站点状态信息（用于监控）
    """
    result = await db.execute(
        select(BusinessSite).where(BusinessSite.id == site_id)
    )
    site = result.scalar_one_or_none()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="站点不存在"
        )
    
    return {
        "id": site.id,
        "name": site.name,
        "url": site.url,
        "status": site.status,
        "last_check": site.last_check,
        "last_response_time": site.last_response_time,
        "ssl_expiry": site.ssl_expiry,
        "is_monitored": site.is_monitored,
    }



