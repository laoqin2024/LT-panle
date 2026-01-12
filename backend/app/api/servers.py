"""
服务器管理API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.server import Server
from app.api.schemas import (
    ServerCreate,
    ServerUpdate,
    ServerResponse,
    ServerListResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/servers", tags=["服务器管理"])


# ============ 服务器CRUD ============

@router.get("", response_model=ServerListResponse, summary="获取服务器列表")
async def get_servers(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    status: Optional[str] = Query(None, description="状态筛选"),
    server_type: Optional[str] = Query(None, description="服务器类型筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（名称或主机）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器列表
    
    - 支持分页
    - 支持按状态筛选
    - 支持按服务器类型筛选
    - 支持关键词搜索（名称或主机）
    """
    # 构建查询
    query = select(Server).options(selectinload(Server.jump_host))
    
    # 应用筛选条件
    conditions = []
    
    if status:
        conditions.append(Server.status == status)
    
    if server_type:
        conditions.append(Server.server_type == server_type)
    
    if search:
        conditions.append(
            or_(
                Server.name.ilike(f"%{search}%"),
                Server.host.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Server)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Server.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    servers = result.scalars().all()
    
    return ServerListResponse(
        total=total,
        items=[ServerResponse.model_validate(server) for server in servers]
    )


@router.get("/{server_id}", response_model=ServerResponse, summary="获取服务器详情")
async def get_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器详情
    """
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.jump_host))
        .where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    return ServerResponse.model_validate(server)


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED, summary="创建服务器")
async def create_server(
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建服务器
    
    - **name**: 服务器名称（必填）
    - **host**: 主机地址（必填）
    - **port**: SSH端口（默认22）
    - **server_type**: 服务器类型（可选）
    - **network_type**: 网络类型（direct/vpn/jump/tunnel，默认direct）
    - **jump_host_id**: 跳板机ID（可选）
    - **description**: 描述（可选）
    """
    # 如果指定了跳板机，验证跳板机是否存在
    if server_data.jump_host_id:
        jump_host_result = await db.execute(
            select(Server).where(Server.id == server_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 检查主机和端口组合是否已存在
    existing_result = await db.execute(
        select(Server).where(
            Server.host == server_data.host,
            Server.port == server_data.port
        )
    )
    existing_server = existing_result.scalar_one_or_none()
    if existing_server:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该主机和端口组合已存在"
        )
    
    # 创建服务器
    server = Server(
        name=server_data.name,
        host=server_data.host,
        port=server_data.port,
        server_type=server_data.server_type,
        network_type=server_data.network_type,
        jump_host_id=server_data.jump_host_id,
        vpn_config=server_data.vpn_config,
        tunnel_config=server_data.tunnel_config,
        description=server_data.description,
        status="unknown",  # 初始状态为unknown
        created_by=current_user.id
    )
    
    db.add(server)
    await db.commit()
    await db.refresh(server)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.jump_host))
        .where(Server.id == server.id)
    )
    server = result.scalar_one()
    
    return ServerResponse.model_validate(server)


@router.put("/{server_id}", response_model=ServerResponse, summary="更新服务器")
async def update_server(
    server_id: int,
    server_data: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新服务器信息
    """
    # 获取服务器
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.jump_host))
        .where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 如果更新了跳板机，验证跳板机是否存在（且不能是自己）
    if server_data.jump_host_id is not None:
        if server_data.jump_host_id == server_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将服务器设置为自己的跳板机"
            )
        jump_host_result = await db.execute(
            select(Server).where(Server.id == server_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 如果更新了主机或端口，检查是否与其他服务器冲突
    host = server_data.host or server.host
    port = server_data.port or server.port
    if (server_data.host or server_data.port) and (host != server.host or port != server.port):
        existing_result = await db.execute(
            select(Server).where(
                Server.host == host,
                Server.port == port,
                Server.id != server_id
            )
        )
        existing_server = existing_result.scalar_one_or_none()
        if existing_server:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该主机和端口组合已被其他服务器使用"
            )
    
    # 更新字段
    update_data = server_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)
    
    await db.commit()
    await db.refresh(server)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Server)
        .options(selectinload(Server.jump_host))
        .where(Server.id == server.id)
    )
    server = result.scalar_one()
    
    return ServerResponse.model_validate(server)


@router.delete("/{server_id}", response_model=MessageResponse, summary="删除服务器")
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除服务器
    """
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查是否有其他服务器使用此服务器作为跳板机
    dependent_result = await db.execute(
        select(Server).where(Server.jump_host_id == server_id)
    )
    dependent_servers = dependent_result.scalars().all()
    if dependent_servers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="有其他服务器使用此服务器作为跳板机，请先修改或删除这些服务器"
        )
    
    await db.delete(server)
    await db.commit()
    
    return MessageResponse(message="服务器删除成功")


@router.get("/{server_id}/metrics", summary="获取服务器监控数据")
async def get_server_metrics(
    server_id: int,
    start_time: Optional[str] = Query(None, description="开始时间（ISO格式）"),
    end_time: Optional[str] = Query(None, description="结束时间（ISO格式）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器监控数据（从TimescaleDB查询）
    
    注意：此接口需要TimescaleDB的server_metrics表有数据
    """
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # TODO: 实现从TimescaleDB查询监控数据
    # 这里返回一个示例结构，实际需要查询server_metrics表
    return {
        "server_id": server_id,
        "message": "监控数据查询功能待实现",
        "note": "需要从TimescaleDB的server_metrics表查询数据"
    }

