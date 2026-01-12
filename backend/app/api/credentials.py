"""
凭据管理API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.credential import Credential, CredentialPermission, CredentialAccessLog
from app.api.schemas import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
    CredentialListResponse,
    CredentialDecryptResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.core.encryption import encrypt_password, decrypt_password
from datetime import datetime

router = APIRouter(prefix="/credentials", tags=["凭据管理"])


# ============ 凭据CRUD ============

@router.get("", response_model=CredentialListResponse, summary="获取凭据列表")
async def get_credentials(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    resource_type: Optional[str] = Query(None, description="资源类型筛选"),
    resource_id: Optional[int] = Query(None, description="资源ID筛选"),
    credential_type: Optional[str] = Query(None, description="凭据类型筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（用户名或描述）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取凭据列表
    
    - 支持分页
    - 支持按资源类型筛选
    - 支持按资源ID筛选
    - 支持按凭据类型筛选
    - 支持关键词搜索
    - 不返回密码明文
    """
    # 构建查询
    query = select(Credential)
    
    # 应用筛选条件
    conditions = []
    
    if resource_type:
        conditions.append(Credential.resource_type == resource_type)
    
    if resource_id:
        conditions.append(Credential.resource_id == resource_id)
    
    if credential_type:
        conditions.append(Credential.credential_type == credential_type)
    
    if search:
        conditions.append(
            or_(
                Credential.username.ilike(f"%{search}%"),
                Credential.description.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(Credential)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(Credential.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    credentials = result.scalars().all()
    
    return CredentialListResponse(
        total=total,
        items=[CredentialResponse.model_validate(cred) for cred in credentials]
    )


@router.get("/{credential_id}", response_model=CredentialResponse, summary="获取凭据详情")
async def get_credential(
    credential_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取凭据详情（不包含密码明文）
    """
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    return CredentialResponse.model_validate(credential)


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED, summary="创建凭据")
async def create_credential(
    credential_data: CredentialCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建凭据
    
    - **resource_type**: 资源类型（server/device/database/site，必填）
    - **resource_id**: 资源ID（必填）
    - **credential_type**: 凭据类型（password/ssh_key/api_key，必填）
    - **username**: 用户名（可选）
    - **password**: 密码（可选，如果是password类型则必填）
    - **ssh_key_path**: SSH密钥路径（可选）
    - **description**: 描述（可选）
    """
    # 验证凭据类型和密码
    if credential_data.credential_type == "password" and not credential_data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码类型凭据必须提供密码"
        )
    
    # 加密密码
    password_encrypted = None
    if credential_data.password:
        try:
            password_encrypted = encrypt_password(credential_data.password)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"密码加密失败: {str(e)}"
            )
    
    # 创建凭据
    credential = Credential(
        resource_type=credential_data.resource_type,
        resource_id=credential_data.resource_id,
        credential_type=credential_data.credential_type,
        username=credential_data.username,
        password_encrypted=password_encrypted or "",  # 如果为空则设为空字符串
        ssh_key_path=credential_data.ssh_key_path,
        description=credential_data.description,
        is_active=credential_data.is_active,
        created_by=current_user.id
    )
    
    db.add(credential)
    await db.commit()
    await db.refresh(credential)
    
    # 记录访问日志
    log = CredentialAccessLog(
        credential_id=credential.id,
        user_id=current_user.id,
        action="create",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(log)
    await db.commit()
    
    return CredentialResponse.model_validate(credential)


@router.put("/{credential_id}", response_model=CredentialResponse, summary="更新凭据")
async def update_credential(
    credential_id: int,
    credential_data: CredentialUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新凭据信息
    """
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    # 如果更新了密码，需要加密
    if credential_data.password is not None:
        try:
            credential.password_encrypted = encrypt_password(credential_data.password)
            # 记录到历史表（TODO: 实现历史记录功能）
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"密码加密失败: {str(e)}"
            )
    
    # 更新其他字段
    update_data = credential_data.model_dump(exclude_unset=True, exclude={'password'})
    for field, value in update_data.items():
        setattr(credential, field, value)
    
    await db.commit()
    await db.refresh(credential)
    
    # 记录访问日志
    log = CredentialAccessLog(
        credential_id=credential.id,
        user_id=current_user.id,
        action="edit",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(log)
    await db.commit()
    
    return CredentialResponse.model_validate(credential)


@router.delete("/{credential_id}", response_model=MessageResponse, summary="删除凭据")
async def delete_credential(
    credential_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除凭据
    """
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    # 记录访问日志
    log = CredentialAccessLog(
        credential_id=credential.id,
        user_id=current_user.id,
        action="delete",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(log)
    await db.commit()
    
    await db.delete(credential)
    await db.commit()
    
    return MessageResponse(message="凭据删除成功")


@router.post("/{credential_id}/decrypt", response_model=CredentialDecryptResponse, summary="解密凭据")
async def decrypt_credential(
    credential_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    解密凭据密码
    
    注意：此操作会记录访问日志
    """
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    if credential.credential_type != "password" or not credential.password_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该凭据不是密码类型或没有密码"
        )
    
    # 解密密码
    try:
        password = decrypt_password(credential.password_encrypted)
    except Exception as e:
        # 记录失败日志
        log = CredentialAccessLog(
            credential_id=credential.id,
            user_id=current_user.id,
            action="decrypt",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            success=False
        )
        db.add(log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"密码解密失败: {str(e)}"
        )
    
    # 记录访问日志
    log = CredentialAccessLog(
        credential_id=credential.id,
        user_id=current_user.id,
        action="decrypt",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(log)
    await db.commit()
    
    return CredentialDecryptResponse(password=password)


@router.get("/{credential_id}/logs", summary="获取凭据访问日志")
async def get_credential_logs(
    credential_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取凭据访问日志
    """
    # 验证凭据存在
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    # 获取日志
    result = await db.execute(
        select(CredentialAccessLog)
        .where(CredentialAccessLog.credential_id == credential_id)
        .order_by(CredentialAccessLog.accessed_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()
    
    # 转换为字典格式
    log_list = []
    for log in logs:
        log_list.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "accessed_at": log.accessed_at.isoformat() if log.accessed_at else None,
            "success": log.success
        })
    
    return {"total": len(log_list), "items": log_list}
