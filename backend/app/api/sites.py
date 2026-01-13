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


@router.get("/{site_id}/health-score", summary="计算站点健康度评分")
async def calculate_health_score(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    计算站点健康度评分（0-100）
    
    评分规则：
    - 站点状态：在线(30分)、异常(15分)、离线(0分)
    - 响应时间：<500ms(30分)、500-1000ms(20分)、1000-2000ms(10分)、>2000ms(0分)
    - 可用性：过去7天可用性百分比 * 0.3
    - SSL证书：未过期(10分)、30天内过期(5分)、已过期(0分)
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
    
    score = 0
    
    # 1. 站点状态评分（30分）
    if site.status == "online":
        score += 30
    elif site.status == "warning":
        score += 15
    # offline 或 unknown 为 0 分
    
    # 2. 响应时间评分（30分）
    if site.last_response_time:
        if site.last_response_time < 500:
            score += 30
        elif site.last_response_time < 1000:
            score += 20
        elif site.last_response_time < 2000:
            score += 10
        # >2000ms 为 0 分
    
    # 3. 可用性评分（30分）- 需要查询历史数据
    # 这里简化处理，如果有last_check且状态为online，给满分
    # 实际应该查询过去7天的可用性数据
    from datetime import datetime, timezone, timedelta
    if site.status == "online" and site.last_check:
        time_diff = datetime.now(timezone.utc) - site.last_check
        if time_diff < timedelta(hours=1):
            score += 30
        elif time_diff < timedelta(hours=24):
            score += 20
        else:
            score += 10
    
    # 4. SSL证书评分（10分）
    if site.ssl_expiry:
        now = datetime.now(timezone.utc)
        expiry = site.ssl_expiry
        days_until_expiry = (expiry - now).days
        
        if days_until_expiry > 30:
            score += 10
        elif days_until_expiry > 0:
            score += 5
        # 已过期为 0 分
    
    # 更新站点健康度评分
    site.health_score = min(100, max(0, score))
    site.health_score_updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {
        "health_score": site.health_score,
        "breakdown": {
            "status_score": 30 if site.status == "online" else (15 if site.status == "warning" else 0),
            "response_time_score": (
                30 if site.last_response_time and site.last_response_time < 500
                else (20 if site.last_response_time and site.last_response_time < 1000
                else (10 if site.last_response_time and site.last_response_time < 2000 else 0))
            ),
            "availability_score": 30 if site.status == "online" and site.last_check else 0,
            "ssl_score": 10 if site.ssl_expiry and (site.ssl_expiry - datetime.now(timezone.utc)).days > 30 else 0,
        }
    }


@router.post("/{site_id}/check", summary="立即检查站点")
async def check_site_now(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    立即检查站点状态
    
    触发一次站点健康检查，更新站点状态、响应时间和SSL证书信息
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
    
    # TODO: 这里应该调用实际的站点检查服务
    # 目前先返回一个模拟的检查结果
    # 实际实现时应该：
    # 1. 发送HTTP请求检查站点
    # 2. 检查SSL证书过期时间
    # 3. 更新站点状态
    
    from datetime import datetime, timezone
    import httpx
    import ssl
    import socket
    from urllib.parse import urlparse
    
    ssl_error_message = None
    try:
        # 检查站点响应
        # 使用站点配置的超时时间，如果没有配置则使用默认值
        timeout = site.check_timeout if site.check_timeout else 10.0
        
        # 对于HTTPS站点，如果证书验证失败，先尝试不验证证书（用于自签名或IP地址访问）
        verify_ssl = True
        parsed = urlparse(site.url)
        is_https = site.url.startswith("https://")
        
        # 如果是IP地址访问HTTPS，可能需要跳过证书验证
        if is_https:
            try:
                import ipaddress
                ipaddress.ip_address(parsed.hostname)
                # 是IP地址，可能需要跳过SSL验证
                verify_ssl = False
            except ValueError:
                # 不是IP地址，正常验证
                pass
        
        # 如果站点处于维护模式，跳过检查
        if site.is_maintenance:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            if site.maintenance_start and site.maintenance_end:
                if site.maintenance_start <= now <= site.maintenance_end:
                    return {
                        "success": True,
                        "status": "maintenance",
                        "message": "站点处于维护模式",
                        "maintenance_note": site.maintenance_note
                    }
        
        async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
            start_time = datetime.now(timezone.utc)
            try:
                response = await client.get(site.url, follow_redirects=True)
            except httpx.ConnectError as e:
                # 连接错误，可能是SSL验证失败
                if is_https and "SSL" in str(e):
                    # 尝试不验证证书
                    async with httpx.AsyncClient(timeout=10.0, verify=False) as client_no_verify:
                        response = await client_no_verify.get(site.url, follow_redirects=True)
                        ssl_error_message = "SSL证书验证失败（已跳过验证）"
                else:
                    raise
            end_time = datetime.now(timezone.utc)
            
            response_time = int((end_time - start_time).total_seconds() * 1000)
            status_code = response.status_code
            
            # 判断状态
            if status_code < 400:
                if response_time > 2000:
                    new_status = "warning"
                else:
                    new_status = "online"
            else:
                new_status = "offline"
            
            # 检查SSL证书（仅HTTPS）
            ssl_expiry = None
            if is_https:
                try:
                    hostname = parsed.hostname
                    port = parsed.port or 443
                    
                    # 检查是否是IP地址
                    is_ip_address = False
                    try:
                        import ipaddress
                        ipaddress.ip_address(hostname)
                        is_ip_address = True
                    except ValueError:
                        pass
                    
                    # 对于IP地址，创建不验证证书的上下文
                    if is_ip_address:
                        context = ssl.create_default_context()
                        context.check_hostname = False
                        context.verify_mode = ssl.CERT_NONE
                        server_hostname = None
                    else:
                        # 是域名，正常验证
                        context = ssl.create_default_context()
                        server_hostname = hostname
                    
                    with socket.create_connection((hostname, port), timeout=5) as sock:
                        with context.wrap_socket(sock, server_hostname=server_hostname) as ssock:
                            cert = ssock.getpeercert()
                            if cert:
                                from datetime import datetime as dt
                                expiry_str = cert.get('notAfter')
                                if expiry_str:
                                    # 处理不同的日期格式
                                    try:
                                        ssl_expiry = dt.strptime(expiry_str, '%b %d %H:%M:%S %Y %Z')
                                    except ValueError:
                                        try:
                                            ssl_expiry = dt.strptime(expiry_str, '%b %d %H:%M:%S %Y')
                                        except ValueError:
                                            pass
                                    if ssl_expiry:
                                        ssl_expiry = ssl_expiry.replace(tzinfo=timezone.utc)
                except Exception as e:
                    ssl_error_message = f"SSL证书检查失败: {str(e)}"
                    print(f"SSL证书检查失败: {e}")
            
            # 更新站点信息
            site.status = new_status
            site.last_check = datetime.now(timezone.utc)
            site.last_response_time = response_time
            if ssl_expiry:
                site.ssl_expiry = ssl_expiry
            
            await db.commit()
            await db.refresh(site)
            
            message = "检查完成"
            if ssl_error_message:
                message += f"（{ssl_error_message}）"
            
            return {
                "success": True,
                "status": new_status,
                "response_time": response_time,
                "status_code": status_code,
                "ssl_expiry": ssl_expiry.isoformat() if ssl_expiry else None,
                "ssl_warning": ssl_error_message,
                "message": message
            }
            
    except httpx.TimeoutException:
        site.status = "offline"
        site.last_check = datetime.now(timezone.utc)
        site.last_response_time = None
        await db.commit()
        await db.refresh(site)
        
        return {
            "success": False,
            "status": "offline",
            "message": "请求超时"
        }
    except Exception as e:
        site.status = "offline"
        site.last_check = datetime.now(timezone.utc)
        site.last_response_time = None
        await db.commit()
        await db.refresh(site)
        
        return {
            "success": False,
            "status": "offline",
            "message": f"检查失败: {str(e)}"
        }


@router.post("/batch/delete", response_model=MessageResponse, summary="批量删除站点")
async def batch_delete_sites(
    site_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    批量删除站点
    """
    if not site_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请至少选择一个站点"
        )
    
    result = await db.execute(
        select(BusinessSite).where(BusinessSite.id.in_(site_ids))
    )
    sites = result.scalars().all()
    
    if len(sites) != len(site_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分站点不存在"
        )
    
    for site in sites:
        await db.delete(site)
    
    await db.commit()
    
    return MessageResponse(message=f"成功删除 {len(sites)} 个站点")


@router.post("/batch/update-monitoring", response_model=MessageResponse, summary="批量更新监控状态")
async def batch_update_monitoring(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    批量启用/禁用站点监控
    
    请求体格式：
    {
        "site_ids": [1, 2, 3],
        "is_monitored": true
    }
    """
    site_ids = request.get("site_ids", [])
    is_monitored = request.get("is_monitored", True)
    
    if not site_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请至少选择一个站点"
        )
    
    result = await db.execute(
        select(BusinessSite).where(BusinessSite.id.in_(site_ids))
    )
    sites = result.scalars().all()
    
    if len(sites) != len(site_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分站点不存在"
        )
    
    for site in sites:
        site.is_monitored = is_monitored
    
    await db.commit()
    
    action = "启用" if is_monitored else "禁用"
    return MessageResponse(message=f"成功{action} {len(sites)} 个站点的监控")



