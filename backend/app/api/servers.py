"""
服务器管理API路由
"""
import asyncio
import socket
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from datetime import datetime
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

logger = logging.getLogger(__name__)
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
    try:
        # 构建查询
        query = select(Server).options(
            selectinload(Server.jump_host),
            selectinload(Server.default_credential)
        )
        
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
        
        # 转换为响应模型
        items = []
        for server in servers:
            try:
                # 确保必要字段有默认值
                if not server.network_type:
                    server.network_type = "direct"
                if not server.port:
                    server.port = 22
                
                items.append(ServerResponse.model_validate(server))
            except Exception as e:
                import traceback
                logger.error(
                    f"转换服务器数据失败 (ID={server.id}, Name={server.name}): {e}\n"
                    f"服务器数据: id={server.id}, name={server.name}, host={server.host}, "
                    f"port={server.port}, network_type={server.network_type}, "
                    f"status={server.status}\n"
                    f"堆栈跟踪:\n{traceback.format_exc()}",
                    exc_info=True
                )
                # 如果单个服务器转换失败，尝试使用基本字段创建响应
                try:
                    # 创建一个最小化的响应对象
                    server_dict = {
                        "id": server.id,
                        "name": server.name or f"服务器 {server.id}",
                        "host": server.host or "未知",
                        "port": server.port or 22,
                        "server_type": server.server_type,
                        "network_type": server.network_type or "direct",
                        "jump_host_id": server.jump_host_id,
                        "default_credential_id": server.default_credential_id,
                        "vpn_config": server.vpn_config,
                        "tunnel_config": server.tunnel_config,
                        "description": server.description,
                        "status": server.status or "unknown",
                        "os_info": server.os_info,
                        "last_check": server.last_check,
                        "created_at": server.created_at,
                        "updated_at": server.updated_at,
                        "created_by": server.created_by,
                        "jump_host": None,
                        "default_credential": None,
                    }
                    items.append(ServerResponse(**server_dict))
                    logger.warning(f"使用备用方法成功转换服务器 (ID={server.id})")
                except Exception as e2:
                    logger.error(f"备用转换方法也失败 (ID={server.id}): {e2}", exc_info=True)
                    # 只有在所有方法都失败时才跳过
                    continue
        
        return ServerListResponse(
            total=total,
            items=items
        )
    except Exception as e:
        import traceback
        logger.error(f"获取服务器列表失败: {e}\n{traceback.format_exc()}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取服务器列表失败: {str(e)}"
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
    try:
        result = await db.execute(
            select(Server)
            .options(
                selectinload(Server.jump_host),
                selectinload(Server.default_credential)
            )
            .where(Server.id == server_id)
        )
        server = result.scalar_one_or_none()
        
        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="服务器不存在"
            )
        
        # 确保必要字段有默认值
        if not server.network_type:
            server.network_type = "direct"
        if not server.port:
            server.port = 22
        
        try:
            return ServerResponse.model_validate(server)
        except Exception as e:
            import traceback
            logger.error(
                f"转换服务器数据失败 (ID={server.id}, Name={server.name}): {e}\n"
                f"服务器数据: id={server.id}, name={server.name}, host={server.host}, "
                f"port={server.port}, network_type={server.network_type}, "
                f"status={server.status}\n"
                f"堆栈跟踪:\n{traceback.format_exc()}",
                exc_info=True
            )
            # 使用备用方法手动构建响应对象
            server_dict = {
                "id": server.id,
                "name": server.name or f"服务器 {server.id}",
                "host": server.host or "未知",
                "port": server.port or 22,
                "server_type": server.server_type,
                "network_type": server.network_type or "direct",
                "jump_host_id": server.jump_host_id,
                "default_credential_id": server.default_credential_id,
                "vpn_config": server.vpn_config,
                "tunnel_config": server.tunnel_config,
                "description": server.description,
                "status": server.status or "unknown",
                "os_info": server.os_info,
                "last_check": server.last_check,
                "created_at": server.created_at,
                "updated_at": server.updated_at,
                "created_by": server.created_by,
                "jump_host": None,
                "default_credential": None,
            }
            return ServerResponse(**server_dict)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"获取服务器详情失败 (ID={server_id}): {e}\n{traceback.format_exc()}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取服务器详情失败: {str(e)}"
        )


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
    
    # 如果指定了默认凭据，验证凭据是否存在
    if server_data.default_credential_id:
        from app.models.credential import Credential
        credential_result = await db.execute(
            select(Credential).where(Credential.id == server_data.default_credential_id)
        )
        credential = credential_result.scalar_one_or_none()
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的凭据不存在"
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
        default_credential_id=server_data.default_credential_id,
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
        .options(
            selectinload(Server.jump_host),
            selectinload(Server.default_credential)
        )
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
        .options(
            selectinload(Server.jump_host),
            selectinload(Server.default_credential)
        )
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
    
    # 如果更新了默认凭据，验证凭据是否存在
    if server_data.default_credential_id is not None:
        from app.models.credential import Credential
        credential_result = await db.execute(
            select(Credential).where(Credential.id == server_data.default_credential_id)
        )
        credential = credential_result.scalar_one_or_none()
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的凭据不存在"
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
        .options(
            selectinload(Server.jump_host),
            selectinload(Server.default_credential)
        )
        .where(Server.id == server.id)
    )
    server = result.scalar_one()
    
    # 确保必要字段有默认值
    if not server.network_type:
        server.network_type = "direct"
    if not server.port:
        server.port = 22
    
    try:
        return ServerResponse.model_validate(server)
    except Exception as e:
        import traceback
        logger.error(
            f"转换服务器数据失败 (ID={server.id}, Name={server.name}): {e}\n"
            f"服务器数据: id={server.id}, name={server.name}, host={server.host}, "
            f"port={server.port}, network_type={server.network_type}, "
            f"status={server.status}\n"
            f"堆栈跟踪:\n{traceback.format_exc()}",
            exc_info=True
        )
        # 使用备用方法手动构建响应对象
        server_dict = {
            "id": server.id,
            "name": server.name or f"服务器 {server.id}",
            "host": server.host or "未知",
            "port": server.port or 22,
            "server_type": server.server_type,
            "network_type": server.network_type or "direct",
            "jump_host_id": server.jump_host_id,
            "default_credential_id": server.default_credential_id,
            "vpn_config": server.vpn_config,
            "tunnel_config": server.tunnel_config,
            "description": server.description,
            "status": server.status or "unknown",
            "os_info": server.os_info,
            "last_check": server.last_check,
            "created_at": server.created_at,
            "updated_at": server.updated_at,
            "created_by": server.created_by,
            "jump_host": None,
            "default_credential": None,
        }
        return ServerResponse(**server_dict)


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


# ============ 服务器连接测试 ============

@router.post("/{server_id}/test-connection", summary="测试服务器连接")
async def test_server_connection(
    server_id: int,
    credential_id: int = Query(..., description="凭据ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    测试服务器SSH连接
    
    使用指定的凭据测试服务器连接
    """
    # 获取服务器
    result = await db.execute(
        select(Server)
        .options(
            selectinload(Server.jump_host),
            selectinload(Server.default_credential)
        )
        .where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 获取凭据
    from app.models.credential import Credential
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    # 验证凭据是否属于该服务器
    if credential.resource_type != "server" or credential.resource_id != server_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="凭据不属于该服务器"
        )
    
    if not credential.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="凭据已禁用"
        )
    
    # 测试SSH连接
    import paramiko
    from app.core.encryption import decrypt_password
    from app.core.ssh_utils import load_ssh_private_key
    
    try:
        pkey = None
        password = None
        
        # 验证用户名
        username = credential.username
        if not username or not username.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="凭据中缺少用户名"
            )
        
        # 根据凭据类型处理认证
        logger.info(f"开始测试服务器连接: {server.name} ({server.host}:{server.port or 22}), 用户名: {username}, 凭据类型: {credential.credential_type}")
        
        if credential.credential_type == "password":
            try:
                password = decrypt_password(credential.password_encrypted)
                logger.debug(f"密码解密成功，长度: {len(password)}")
            except Exception as e:
                logger.error(f"密码解密失败: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"密码解密失败: {str(e)}"
                )
        elif credential.credential_type == "ssh_key":
            try:
                pkey = load_ssh_private_key(credential)
                logger.debug("SSH私钥加载成功")
            except Exception as e:
                logger.error(f"SSH私钥加载失败: {str(e)}")
                raise
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的凭据类型: {credential.credential_type}"
            )
        
        # 创建SSH客户端
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 连接参数
        connect_kwargs = {
            "hostname": server.host,
            "port": server.port or 22,
            "username": username,
            "timeout": 10,
        }
        
        # 根据认证方式设置参数
        if pkey:
            connect_kwargs["pkey"] = pkey
            logger.debug("使用SSH密钥认证")
        elif password:
            connect_kwargs["password"] = password
            logger.debug("使用密码认证")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少认证信息：需要密码或SSH密钥"
            )
        
        # 建立连接
        logger.info(f"尝试连接到 {server.host}:{server.port or 22}...")
        try:
            ssh.connect(**connect_kwargs)
            logger.info("SSH连接成功")
        except Exception as conn_err:
            logger.error(f"SSH连接失败: {type(conn_err).__name__}: {str(conn_err)}")
            raise
        
        # 执行简单命令测试
        logger.info("执行测试命令...")
        try:
            stdin, stdout, stderr = ssh.exec_command("echo 'Connection test successful' && uname -a", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode('utf-8', errors='ignore')
            error_output = stderr.read().decode('utf-8', errors='ignore')
            logger.info(f"命令执行完成，退出状态: {exit_status}")
        except Exception as cmd_err:
            logger.error(f"命令执行失败: {type(cmd_err).__name__}: {str(cmd_err)}")
            # 即使命令执行失败，也尝试关闭连接
            try:
                ssh.close()
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"命令执行失败: {str(cmd_err)}"
            )
        
        # 关闭连接
        try:
            ssh.close()
            logger.info("SSH连接已关闭")
        except Exception as close_err:
            logger.warning(f"关闭SSH连接时出错: {str(close_err)}")
        
        # 更新服务器状态
        server.status = "online"
        server.last_check = datetime.now()
        await db.commit()
        
        return {
            "success": True,
            "message": "连接测试成功",
            "output": output.strip(),
            "error": error_output.strip() if error_output else None,
            "exit_status": exit_status,
            "server": {
                "id": server.id,
                "name": server.name,
                "host": server.host,
                "port": server.port or 22,
            },
            "credential": {
                "id": credential.id,
                "username": credential.username,
                "credential_type": credential.credential_type
            }
        }
    
    except paramiko.AuthenticationException as e:
        # 更新服务器状态
        server.status = "offline"
        server.last_check = datetime.now()
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
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSH连接错误: {str(e)}"
        )
    except socket.timeout:
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=f"连接超时：无法在10秒内连接到服务器 {server.host}:{server.port or 22}"
        )
    except socket.gaierror as e:
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DNS解析失败：无法解析主机名 {server.host}。请检查主机地址是否正确"
        )
    except Exception as e:
        import traceback
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        
        error_detail = f"连接失败: {str(e)}"
        logger.error(f"服务器连接测试失败: {error_detail}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


# ============ 服务器状态检测 ============

@router.post("/{server_id}/check-status", response_model=MessageResponse, summary="检测服务器状态")
async def check_server_status(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    检测服务器状态（通过TCP连接检测）
    
    通过尝试连接服务器的SSH端口来判断服务器是否在线
    """
    # 获取服务器
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 尝试建立TCP连接检测服务器状态
    port = server.port or 22
    try:
        # 创建socket连接
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)  # 5秒超时
        result = sock.connect_ex((server.host, port))
        sock.close()
        
        if result == 0:
            # 连接成功，服务器在线
            server.status = "online"
            server.last_check = datetime.now()
            await db.commit()
            return MessageResponse(message=f"服务器 {server.name} 在线")
        else:
            # 连接失败，服务器离线
            server.status = "offline"
            server.last_check = datetime.now()
            await db.commit()
            return MessageResponse(message=f"服务器 {server.name} 离线（无法连接到 {server.host}:{port}）")
    except socket.timeout:
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        return MessageResponse(message=f"服务器 {server.name} 离线（连接超时）")
    except socket.gaierror:
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        return MessageResponse(message=f"服务器 {server.name} 离线（DNS解析失败）")
    except Exception as e:
        logger.error(f"检测服务器状态失败 (ID={server_id}): {str(e)}", exc_info=True)
        server.status = "offline"
        server.last_check = datetime.now()
        await db.commit()
        return MessageResponse(message=f"检测失败: {str(e)}")


@router.post("/batch-check-status", response_model=MessageResponse, summary="批量检测服务器状态")
async def batch_check_server_status(
    server_ids: List[int] = Body(..., description="服务器ID列表"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    批量检测服务器状态
    
    通过TCP连接检测多个服务器的状态
    """
    if not server_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="服务器ID列表不能为空"
        )
    
    # 获取服务器列表
    result = await db.execute(
        select(Server).where(Server.id.in_(server_ids))
    )
    servers = result.scalars().all()
    
    if len(servers) != len(server_ids):
        found_ids = {s.id for s in servers}
        missing_ids = set(server_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"以下服务器不存在: {missing_ids}"
        )
    
    results = []
    online_count = 0
    offline_count = 0
    
    # 批量检测状态
    for server in servers:
        port = server.port or 22
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((server.host, port))
            sock.close()
            
            if result == 0:
                server.status = "online"
                online_count += 1
                results.append({
                    "server_id": server.id,
                    "server_name": server.name,
                    "status": "online"
                })
            else:
                server.status = "offline"
                offline_count += 1
                results.append({
                    "server_id": server.id,
                    "server_name": server.name,
                    "status": "offline"
                })
        except Exception as e:
            server.status = "offline"
            offline_count += 1
            results.append({
                "server_id": server.id,
                "server_name": server.name,
                "status": "offline"
            })
            logger.warning(f"检测服务器 {server.name} (ID={server.id}) 状态失败: {str(e)}")
        
        server.last_check = datetime.now()
    
    await db.commit()
    
    message = f"检测完成：{online_count} 台在线，{offline_count} 台离线"
    return MessageResponse(message=message)

