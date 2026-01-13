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
    # 验证资源是否存在
    from app.models.server import Server
    from app.models.device import NetworkDevice
    from app.models.database import Database
    from app.models.site import BusinessSite
    
    resource_exists = False
    if credential_data.resource_type == "server":
        result = await db.execute(
            select(Server).where(Server.id == credential_data.resource_id)
        )
        resource_exists = result.scalar_one_or_none() is not None
    elif credential_data.resource_type == "device":
        result = await db.execute(
            select(NetworkDevice).where(NetworkDevice.id == credential_data.resource_id)
        )
        resource_exists = result.scalar_one_or_none() is not None
    elif credential_data.resource_type == "database":
        result = await db.execute(
            select(Database).where(Database.id == credential_data.resource_id)
        )
        resource_exists = result.scalar_one_or_none() is not None
    elif credential_data.resource_type == "site":
        result = await db.execute(
            select(BusinessSite).where(BusinessSite.id == credential_data.resource_id)
        )
        resource_exists = result.scalar_one_or_none() is not None
    
    if not resource_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"资源不存在: {credential_data.resource_type}#{credential_data.resource_id}"
        )
    
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
    
    # 如果更新了凭据类型，需要清理不相关的字段
    if credential_data.credential_type and credential_data.credential_type != credential.credential_type:
        # 类型切换时，清理不相关的字段
        if credential_data.credential_type == 'password':
            # 切换到密码类型，清空SSH密钥路径
            credential.ssh_key_path = None
        elif credential_data.credential_type == 'ssh_key':
            # 切换到SSH密钥类型，如果使用路径方式，保留ssh_key_path
            # 如果使用内容方式，ssh_key_path会在下面更新
            pass
    
    # 如果更新了密码/私钥，需要加密
    # 注意：对于SSH密钥类型，password字段可能包含私钥内容
    if credential_data.password is not None and credential_data.password.strip():
        try:
            credential.password_encrypted = encrypt_password(credential_data.password)
            # 记录到历史表（TODO: 实现历史记录功能）
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"密码/私钥加密失败: {str(e)}"
            )
    
    # 更新其他字段（排除password，因为已经单独处理）
    update_data = credential_data.model_dump(exclude_unset=True, exclude={'password'})
    for field, value in update_data.items():
        # 对于credential_type，需要特别处理
        if field == 'credential_type':
            if value and value in ['password', 'ssh_key', 'api_key']:
                credential.credential_type = value
        # 对于ssh_key_path，如果更新为None或空字符串，需要清空
        elif field == 'ssh_key_path':
            if value is None or value == '':
                setattr(credential, field, None)
            else:
                setattr(credential, field, value)
        elif value is not None:
            setattr(credential, field, value)
        # 注意：对于Optional字段，如果前端明确传递了None，也应该更新
        # 但这里使用exclude_unset=True，所以只有明确传递的字段才会更新
    
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


# ============ 凭据测试连接 ============

@router.post("/{credential_id}/test", summary="测试凭据连接")
async def test_credential_connection(
    credential_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    测试凭据连接（仅支持服务器SSH连接）
    
    返回连接测试结果
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
    
    if not credential.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="凭据已禁用"
        )
    
    # 目前只支持服务器SSH连接测试
    if credential.resource_type != "server":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目前仅支持服务器SSH连接测试"
        )
    
    # 支持密码和SSH密钥类型
    if credential.credential_type not in ["password", "ssh_key"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目前仅支持密码和SSH密钥类型凭据测试"
        )
    
    # 获取服务器信息
    from app.models.server import Server
    from sqlalchemy.orm import selectinload
    
    server_result = await db.execute(
        select(Server).where(Server.id == credential.resource_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="关联的服务器不存在"
        )
    
    # 测试SSH连接
    import paramiko
    from app.core.ssh_utils import load_ssh_private_key
    
    try:
        pkey = None
        password = None
        
        # 根据凭据类型处理认证
        if credential.credential_type == "password":
            # 密码认证
            password = decrypt_password(credential.password_encrypted)
        elif credential.credential_type == "ssh_key":
            # SSH密钥认证：使用公共函数加载私钥
            pkey = load_ssh_private_key(credential)
        
        # 创建SSH客户端
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 连接参数
        connect_kwargs = {
            "hostname": server.host,
            "port": server.port or 22,
            "username": credential.username or "root",
            "timeout": 10,
        }
        
        # 根据认证方式设置参数
        if pkey:
            connect_kwargs["pkey"] = pkey
        elif password:
            connect_kwargs["password"] = password
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少认证信息：需要密码或SSH密钥"
            )
        
        # 建立连接
        ssh.connect(**connect_kwargs)
        
        # 执行简单命令测试
        stdin, stdout, stderr = ssh.exec_command("echo 'Connection test successful'", timeout=5)
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8', errors='ignore')
        
        # 关闭连接
        ssh.close()
        
        # 记录访问日志
        log = CredentialAccessLog(
            credential_id=credential.id,
            user_id=current_user.id,
            action="test",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            success=True
        )
        db.add(log)
        await db.commit()
        
        return {
            "success": True,
            "message": "连接测试成功",
            "output": output.strip(),
            "server_host": server.host,
            "server_port": server.port or 22,
            "username": credential.username or "root"
        }
    
    except paramiko.AuthenticationException as e:
        # 记录失败日志
        log = CredentialAccessLog(
            credential_id=credential.id,
            user_id=current_user.id,
            action="test",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            success=False
        )
        db.add(log)
        await db.commit()
        
        auth_error_msg = "SSH认证失败"
        if credential.credential_type == "password":
            auth_error_msg += "，请检查用户名和密码是否正确"
        elif credential.credential_type == "ssh_key":
            auth_error_msg += "。可能的原因：\n"
            auth_error_msg += "1. 私钥与服务器上的公钥不匹配\n"
            auth_error_msg += "2. 服务器未配置对应的公钥（需要将公钥添加到 ~/.ssh/authorized_keys）\n"
            auth_error_msg += "3. 用户名不正确\n"
            auth_error_msg += "4. 私钥格式错误或已损坏\n"
            auth_error_msg += f"\n详细错误: {str(e)}"
        else:
            auth_error_msg += f"。详细错误: {str(e)}"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=auth_error_msg
        )
    except paramiko.SSHException as e:
        log = CredentialAccessLog(
            credential_id=credential.id,
            user_id=current_user.id,
            action="test",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            success=False
        )
        db.add(log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSH连接错误: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"连接测试失败: {str(e)}\n{traceback.format_exc()}")
        
        log = CredentialAccessLog(
            credential_id=credential.id,
            user_id=current_user.id,
            action="test",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            success=False
        )
        db.add(log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"连接测试失败: {str(e)}"
        )
