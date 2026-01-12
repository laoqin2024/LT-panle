"""
用户管理API路由
包括用户、角色、权限的CRUD操作
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.user import User, Role, Permission
from app.api.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
    PermissionResponse,
    PermissionListResponse,
    RolePermissionUpdate,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user, get_current_superuser
from app.core.security import get_password_hash
from app.models.user import User

router = APIRouter(prefix="/users", tags=["用户管理"])


# ============ 角色管理（必须在用户详情路由之前） ============

@router.get("/roles", response_model=RoleListResponse, summary="获取角色列表")
async def get_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取角色列表
    """
    result = await db.execute(select(Role).order_by(Role.id))
    roles = result.scalars().all()
    
    role_list = []
    for role in roles:
        role_list.append(RoleResponse(
            id=role.id,
            name=role.name,
            description=role.description,
            created_at=role.created_at,
        ))
    
    count_result = await db.execute(select(func.count()).select_from(Role))
    total = count_result.scalar()
    
    return RoleListResponse(total=total, items=role_list)


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, summary="创建角色")
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    创建角色
    需要超级用户权限
    """
    # 检查角色名是否已存在
    existing = await db.execute(select(Role).where(Role.name == role_data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="角色名已存在"
        )
    
    role = Role(
        name=role_data.name,
        description=role_data.description,
    )
    
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        created_at=role.created_at,
    )


@router.put("/roles/{role_id}", response_model=RoleResponse, summary="更新角色")
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    更新角色
    需要超级用户权限
    """
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    if role_data.name is not None:
        # 检查角色名是否已被其他角色使用
        existing = await db.execute(
            select(Role).where(Role.name == role_data.name, Role.id != role_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="角色名已被使用"
            )
        role.name = role_data.name
    
    if role_data.description is not None:
        role.description = role_data.description
    
    await db.commit()
    await db.refresh(role)
    
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        created_at=role.created_at,
    )


@router.delete("/roles/{role_id}", response_model=MessageResponse, summary="删除角色")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    删除角色
    需要超级用户权限
    不能删除默认角色（admin, user）
    """
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    # 检查是否为默认角色
    if role.name in ["admin", "user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除默认角色"
        )
    
    # 检查是否有用户使用该角色
    users_result = await db.execute(select(User).where(User.role_id == role_id))
    users = users_result.scalars().all()
    if users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"该角色正在被 {len(users)} 个用户使用，无法删除"
        )
    
    await db.delete(role)
    await db.commit()
    
    return MessageResponse(message="角色删除成功")


# ============ 权限管理（必须在用户详情路由之前） ============

@router.get("/permissions", response_model=PermissionListResponse, summary="获取权限列表")
async def get_permissions(
    resource: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取权限列表
    """
    query = select(Permission)
    
    if resource:
        query = query.where(Permission.resource == resource)
    
    result = await db.execute(query.order_by(Permission.resource, Permission.action))
    permissions = result.scalars().all()
    
    permission_list = []
    for perm in permissions:
        permission_list.append(PermissionResponse(
            id=perm.id,
            name=perm.name,
            resource=perm.resource,
            action=perm.action,
            description=perm.description,
            created_at=perm.created_at,
        ))
    
    count_result = await db.execute(select(func.count()).select_from(Permission))
    total = count_result.scalar()
    
    return PermissionListResponse(total=total, items=permission_list)


# ============ 用户管理 ============

@router.get("", response_model=UserListResponse, summary="获取用户列表")
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    role_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取用户列表
    需要登录，只有超级用户才能查看所有用户
    """
    # 普通用户只能查看自己的信息
    if not current_user.is_superuser:
        result = await db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.id == current_user.id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
        
        return UserListResponse(
            total=1,
            items=[UserResponse(
                id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                role_id=user.role_id,
                role_name=user.role.name if user.role else None,
                is_active=user.is_active,
                is_superuser=user.is_superuser,
                last_login=user.last_login,
                created_at=user.created_at,
            )]
        )
    
    # 超级用户可以查看所有用户
    query = select(User).options(selectinload(User.role))
    
    if search:
        query = query.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%")
            )
        )
    
    if role_id:
        query = query.where(User.role_id == role_id)
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    
    # 获取总数
    count_query = select(func.count()).select_from(User)
    if search:
        count_query = count_query.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%")
            )
        )
    if role_id:
        count_query = count_query.where(User.role_id == role_id)
    if is_active is not None:
        count_query = count_query.where(User.is_active == is_active)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取分页数据
    result = await db.execute(
        query.order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()
    
    user_list = []
    for user in users:
        user_list.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role_id=user.role_id,
            role_name=user.role.name if user.role else None,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            last_login=user.last_login,
            created_at=user.created_at,
        ))
    
    return UserListResponse(total=total, items=user_list)


@router.get("/{user_id}", response_model=UserResponse, summary="获取用户详情")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取用户详情
    普通用户只能查看自己的信息
    """
    if not current_user.is_superuser and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问其他用户信息"
        )
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="创建用户")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    创建用户
    需要超级用户权限
    """
    # 检查用户名是否已存在
    existing_username = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if existing_username.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    existing_email = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已存在"
        )
    
    # 检查角色是否存在
    role_result = await db.execute(select(Role).where(Role.id == user_data.role_id))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="角色不存在"
        )
    
    # 创建用户
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role_id=user_data.role_id,
        is_active=user_data.is_active,
        is_superuser=user_data.is_superuser,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # 重新加载角色关系
    await db.refresh(user, ["role"])
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.put("/{user_id}", response_model=UserResponse, summary="更新用户")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新用户信息
    普通用户只能更新自己的信息（不能修改角色和权限）
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 权限检查
    if not current_user.is_superuser:
        if current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改其他用户信息"
            )
        # 普通用户不能修改角色和权限
        if user_data.role_id is not None or user_data.is_superuser is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改角色和权限"
            )
    
    # 更新字段
    if user_data.username is not None:
        # 检查用户名是否已被其他用户使用
        existing = await db.execute(
            select(User).where(User.username == user_data.username, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已被使用"
            )
        user.username = user_data.username
    
    if user_data.email is not None:
        # 检查邮箱是否已被其他用户使用
        existing = await db.execute(
            select(User).where(User.email == user_data.email, User.id != user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被使用"
            )
        user.email = user_data.email
    
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    
    if user_data.role_id is not None and current_user.is_superuser:
        # 检查角色是否存在
        role_result = await db.execute(select(Role).where(Role.id == user_data.role_id))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="角色不存在"
            )
        user.role_id = user_data.role_id
    
    if user_data.is_active is not None and current_user.is_superuser:
        user.is_active = user_data.is_active
    
    if user_data.is_superuser is not None and current_user.is_superuser:
        user.is_superuser = user_data.is_superuser
    
    if user_data.password is not None:
        user.password_hash = get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(user)
    await db.refresh(user, ["role"])
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.delete("/{user_id}", response_model=MessageResponse, summary="删除用户")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    删除用户
    需要超级用户权限
    不能删除自己
    """
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    await db.delete(user)
    await db.commit()
    
    return MessageResponse(message="用户删除成功")
