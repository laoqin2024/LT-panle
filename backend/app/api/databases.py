"""
数据库管理API路由
"""
from typing import Optional
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.database import Database
from app.models.server import Server
from app.api.schemas import (
    DatabaseCreate,
    DatabaseUpdate,
    DatabaseResponse,
    DatabaseListResponse,
    DatabaseTestResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/databases", tags=["数据库管理"])


# ============ 数据库CRUD ============

@router.get("", response_model=DatabaseListResponse, summary="获取数据库列表")
async def get_databases(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    status: Optional[str] = Query(None, description="状态筛选"),
    db_type: Optional[str] = Query(None, description="数据库类型筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（名称或主机）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取数据库列表
    
    - 支持分页
    - 支持按状态筛选
    - 支持按数据库类型筛选
    - 支持关键词搜索（名称或主机）
    """
    # 构建查询
    query = select(Database).options(selectinload(Database.jump_host))
    
    # 应用筛选条件
    conditions = []
    
    if status:
        conditions.append(Database.status == status)
    
    if db_type:
        conditions.append(Database.type == db_type)
    
    if search:
        conditions.append(
            or_(
                Database.name.ilike(f"%{search}%"),
                Database.host.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Database)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Database.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    databases = result.scalars().all()
    
    return DatabaseListResponse(
        total=total,
        items=[DatabaseResponse.model_validate(db) for db in databases]
    )


@router.get("/{database_id}", response_model=DatabaseResponse, summary="获取数据库详情")
async def get_database(
    database_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取数据库详情
    """
    result = await db.execute(
        select(Database)
        .options(selectinload(Database.jump_host))
        .where(Database.id == database_id)
    )
    database = result.scalar_one_or_none()
    
    if not database:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据库不存在"
        )
    
    return DatabaseResponse.model_validate(database)


@router.post("", response_model=DatabaseResponse, status_code=status.HTTP_201_CREATED, summary="创建数据库连接")
async def create_database(
    database_data: DatabaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建数据库连接
    
    - **name**: 数据库名称（必填）
    - **type**: 数据库类型（PostgreSQL/MySQL/SQL Server，必填）
    - **host**: 主机地址（必填）
    - **port**: 端口（必填）
    - **database**: 数据库名（必填）
    - **network_type**: 网络类型（direct/vpn/jump/tunnel，默认direct）
    - **jump_host_id**: 跳板机ID（可选）
    - **description**: 描述（可选）
    """
    # 如果指定了跳板机，验证跳板机是否存在
    if database_data.jump_host_id:
        jump_host_result = await db.execute(
            select(Server).where(Server.id == database_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 检查主机、端口和数据库名组合是否已存在
    existing_result = await db.execute(
        select(Database).where(
            Database.host == database_data.host,
            Database.port == database_data.port,
            Database.database == database_data.database
        )
    )
    existing_database = existing_result.scalar_one_or_none()
    if existing_database:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该主机、端口和数据库名组合已存在"
        )
    
    # 创建数据库连接
    database = Database(
        name=database_data.name,
        type=database_data.type,
        host=database_data.host,
        port=database_data.port,
        database=database_data.database,
        network_type=database_data.network_type,
        jump_host_id=database_data.jump_host_id,
        vpn_config=database_data.vpn_config,
        tunnel_config=database_data.tunnel_config,
        description=database_data.description,
        status="unknown",  # 初始状态为unknown
        created_by=current_user.id
    )
    
    db.add(database)
    await db.commit()
    await db.refresh(database)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Database)
        .options(selectinload(Database.jump_host))
        .where(Database.id == database.id)
    )
    database = result.scalar_one()
    
    return DatabaseResponse.model_validate(database)


@router.put("/{database_id}", response_model=DatabaseResponse, summary="更新数据库连接")
async def update_database(
    database_id: int,
    database_data: DatabaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新数据库连接信息
    """
    # 获取数据库
    result = await db.execute(
        select(Database)
        .options(selectinload(Database.jump_host))
        .where(Database.id == database_id)
    )
    database = result.scalar_one_or_none()
    
    if not database:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据库不存在"
        )
    
    # 如果更新了跳板机，验证跳板机是否存在
    if database_data.jump_host_id is not None:
        jump_host_result = await db.execute(
            select(Server).where(Server.id == database_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 如果更新了主机、端口或数据库名，检查是否与其他数据库冲突
    host = database_data.host or database.host
    port = database_data.port or database.port
    database_name = database_data.database or database.database
    
    if (database_data.host or database_data.port or database_data.database) and \
       (host != database.host or port != database.port or database_name != database.database):
        existing_result = await db.execute(
            select(Database).where(
                Database.host == host,
                Database.port == port,
                Database.database == database_name,
                Database.id != database_id
            )
        )
        existing_database = existing_result.scalar_one_or_none()
        if existing_database:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该主机、端口和数据库名组合已被其他数据库使用"
            )
    
    # 更新字段
    update_data = database_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(database, field, value)
    
    await db.commit()
    await db.refresh(database)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Database)
        .options(selectinload(Database.jump_host))
        .where(Database.id == database.id)
    )
    database = result.scalar_one()
    
    return DatabaseResponse.model_validate(database)


@router.delete("/{database_id}", response_model=MessageResponse, summary="删除数据库连接")
async def delete_database(
    database_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除数据库连接
    """
    result = await db.execute(
        select(Database).where(Database.id == database_id)
    )
    database = result.scalar_one_or_none()
    
    if not database:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据库不存在"
        )
    
    await db.delete(database)
    await db.commit()
    
    return MessageResponse(message="数据库连接删除成功")


@router.post("/{database_id}/test", response_model=DatabaseTestResponse, summary="测试数据库连接")
async def test_database_connection(
    database_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    测试数据库连接
    
    注意：此接口需要数据库凭据（用户名和密码），这些信息存储在Credential表中
    实际实现需要：
    1. 从Credential表获取该数据库的凭据
    2. 根据数据库类型使用相应的驱动进行连接测试
    3. 返回连接结果和耗时
    """
    # 获取数据库信息
    result = await db.execute(
        select(Database).where(Database.id == database_id)
    )
    database = result.scalar_one_or_none()
    
    if not database:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据库不存在"
        )
    
    # TODO: 实现实际的数据库连接测试
    # 这里返回一个示例结构，实际需要：
    # 1. 从Credential表查询该数据库的凭据
    # 2. 根据database.type使用相应的驱动（psycopg2, pymysql, pyodbc等）
    # 3. 尝试连接并记录耗时
    # 4. 更新数据库的status和last_check字段
    
    start_time = time.time()
    # 模拟连接测试
    connection_time = time.time() - start_time
    
    return DatabaseTestResponse(
        success=True,
        message="连接测试功能待实现，需要从Credential表获取凭据",
        connection_time=connection_time
    )
