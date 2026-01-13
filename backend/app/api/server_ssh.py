"""
服务器SSH终端和文件管理API
"""
import json
import asyncio
import base64
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import paramiko
from io import BytesIO
import os

from app.core.database import get_db
from app.models.server import Server
from app.models.credential import Credential
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.core.encryption import decrypt_password
from app.core.ssh_utils import load_ssh_private_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["服务器SSH和文件管理"])

# SSH连接池（存储活跃的SSH连接）
ssh_connections: Dict[int, Dict[str, Any]] = {}


def get_ssh_connection(server_id: int, credential_id: int) -> Optional[paramiko.SSHClient]:
    """获取SSH连接"""
    key = f"{server_id}:{credential_id}"
    if key in ssh_connections:
        conn_info = ssh_connections[key]
        # 检查连接是否仍然有效
        try:
            transport = conn_info["client"].get_transport()
            if transport and transport.is_active():
                return conn_info["client"]
        except:
            pass
    
    return None


def create_ssh_connection(
    server: Server,
    credential: Credential,
    db: AsyncSession
) -> paramiko.SSHClient:
    """创建SSH连接"""
    pkey = None  # SSH私钥对象
    password = None  # 密码
    
    try:
        # 解密凭据
        if credential.credential_type == "password":
            password = decrypt_password(credential.password_encrypted)
        elif credential.credential_type == "ssh_key":
            # SSH密钥认证：使用公共函数加载私钥
            pkey = load_ssh_private_key(credential)
            password = None
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不支持的凭据类型"
            )
        
        # 创建SSH客户端
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 连接参数
        connect_kwargs = {
            "hostname": server.host,
            "port": server.port or 22,
            "username": credential.username,
            "timeout": 10,
        }
        
        # 根据认证方式设置参数
        if credential.credential_type == "ssh_key" and pkey:
            connect_kwargs["pkey"] = pkey
        elif password:
            connect_kwargs["password"] = password
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少认证信息：需要密码或SSH密钥"
            )
        
        # 如果服务器有跳板机，需要通过跳板机连接
        if server.jump_host:
            # 跳板机连接（简化实现，实际应该建立SSH隧道）
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="跳板机连接暂未实现"
            )
        
        # 建立连接
        ssh.connect(**connect_kwargs)
        
        # 存储连接
        key = f"{server.id}:{credential.id}"
        ssh_connections[key] = {
            "client": ssh,
            "server_id": server.id,
            "credential_id": credential.id,
            "created_at": asyncio.get_event_loop().time()
        }
        
        return ssh
    
    except paramiko.AuthenticationException as e:
        # SSH认证失败是业务错误，不是用户认证错误，使用400而不是401
        error_msg = "SSH认证失败"
        if credential.credential_type == "password":
            error_msg += "，请检查用户名和密码是否正确"
        elif credential.credential_type == "ssh_key":
            error_msg += "。可能的原因：\n"
            error_msg += "1. 私钥与服务器上的公钥不匹配\n"
            error_msg += "2. 服务器未配置对应的公钥（需要将公钥添加到 ~/.ssh/authorized_keys）\n"
            error_msg += "3. 用户名不正确\n"
            error_msg += "4. 私钥格式错误或已损坏\n"
            error_msg += f"\n详细错误: {str(e)}"
        else:
            error_msg += f"。详细错误: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    except paramiko.SSHException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSH连接错误: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"连接失败: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"连接失败: {str(e)}"
        )


def close_ssh_connection(server_id: int, credential_id: int):
    """关闭SSH连接"""
    key = f"{server_id}:{credential_id}"
    if key in ssh_connections:
        try:
            ssh_connections[key]["client"].close()
        except:
            pass
        del ssh_connections[key]


# ============ SSH终端WebSocket ============

@router.websocket("/{server_id}/ssh/terminal")
async def ssh_terminal(
    websocket: WebSocket,
    server_id: int,
):
    """
    SSH终端WebSocket端点
    
    查询参数:
    - credential_id: 凭据ID
    - token: 认证token
    
    消息格式:
    - 输入: {"type": "input", "data": "命令或字符"}
    - 调整终端大小: {"type": "resize", "rows": 24, "cols": 80}
    """
    await websocket.accept()
    logger.info(f"WebSocket连接已接受: server_id={server_id}")
    
    try:
        # 从查询参数获取credential_id和token
        query_params = dict(websocket.query_params)
        credential_id = int(query_params.get("credential_id", 0))
        token = query_params.get("token")
        
        logger.info(f"WebSocket参数: credential_id={credential_id}, token={'已提供' if token else '未提供'}")
        
        if not credential_id or not token:
            logger.warning(f"WebSocket参数不完整: credential_id={credential_id}, token={'已提供' if token else '未提供'}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "参数不完整：需要credential_id和token"
                })
            except:
                pass
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # 验证用户（简化处理，实际应该使用依赖注入）
        from app.api.dependencies import get_current_user_from_token
        try:
            current_user = await get_current_user_from_token(token)
            logger.info(f"用户认证成功: {current_user.username}")
        except Exception as e:
            logger.error(f"用户认证失败: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"认证失败: {str(e)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # 获取数据库会话
        from app.core.database import AsyncSessionLocal
        server = None
        credential = None
        
        logger.info(f"查询服务器和凭据: server_id={server_id}, credential_id={credential_id}")
        async with AsyncSessionLocal() as db:
            # 获取服务器和凭据
            server_result = await db.execute(
                select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
            )
            server = server_result.scalar_one_or_none()
            if not server:
                logger.warning(f"服务器不存在: server_id={server_id}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "服务器不存在"
                    })
                except:
                    pass
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            logger.info(f"服务器信息: {server.name} ({server.host}:{server.port or 22})")
            
            credential_result = await db.execute(
                select(Credential).where(Credential.id == credential_id)
            )
            credential = credential_result.scalar_one_or_none()
            if not credential:
                logger.warning(f"凭据不存在: credential_id={credential_id}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "凭据不存在"
                    })
                except:
                    pass
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            logger.info(f"凭据信息: ID={credential.id}, 用户名={credential.username}, 类型={credential.credential_type}")
        
        # 获取或创建SSH连接
        logger.info("检查SSH连接池...")
        ssh = get_ssh_connection(server_id, credential_id)
        if not ssh:
            logger.info("连接池中无可用连接，创建新SSH连接...")
            try:
                # 需要一个新的数据库会话来创建SSH连接
                async with AsyncSessionLocal() as db:
                    ssh = create_ssh_connection(server, credential, db)
                logger.info("SSH连接创建成功")
            except HTTPException as e:
                # HTTPException需要特殊处理，发送错误消息
                logger.error(f"创建SSH连接失败 (HTTPException): {e.detail}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": e.detail
                    })
                except:
                    pass
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
                return
            except Exception as e:
                error_msg = f"创建SSH连接失败: {str(e)}"
                logger.error(f"创建SSH连接失败: {error_msg}", exc_info=True)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": error_msg
                    })
                except:
                    pass
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
                return
        else:
            logger.info("使用连接池中的SSH连接")
        
        # 创建交互式shell
        logger.info("创建SSH交互式shell...")
        try:
            transport = ssh.get_transport()
            if not transport or not transport.is_active():
                logger.error("SSH传输层未激活或不存在")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "SSH传输层未激活"
                    })
                except:
                    pass
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
                return
            
            logger.info("打开SSH会话通道...")
            channel = transport.open_session()
            logger.info("请求PTY...")
            channel.get_pty()
            logger.info("启动shell...")
            channel.invoke_shell()
            logger.info("SSH shell创建成功")
        except Exception as e:
            error_msg = f"创建SSH shell失败: {str(e)}"
            logger.error(f"创建SSH shell失败: {error_msg}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": error_msg
                })
            except:
                pass
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return
        
        # 发送连接成功消息
        logger.info("发送连接成功消息...")
        try:
            await websocket.send_json({
                "type": "connected",
                "message": "SSH终端已连接"
            })
            logger.info("SSH终端连接完成，开始处理消息...")
        except (RuntimeError, ConnectionResetError, WebSocketDisconnect) as e:
            # 连接相关错误，连接已关闭
            error_msg = str(e) if str(e) else f"{type(e).__name__}: 连接已关闭"
            logger.warning(f"发送连接成功消息失败（连接已关闭）: {error_msg}")
            # 清理资源并返回
            try:
                channel.close()
            except:
                pass
            return
        except Exception as e:
            error_msg = str(e) if str(e) else f"{type(e).__name__}"
            logger.error(f"发送连接成功消息失败: {error_msg}", exc_info=True)
            # 如果发送失败，连接可能已关闭，清理资源并返回
            try:
                channel.close()
            except:
                pass
            return
        
        # 启动接收线程（从SSH接收数据并发送到WebSocket）
        async def receive_from_ssh():
            try:
                while True:
                    if channel.recv_ready():
                        data = channel.recv(4096).decode('utf-8', errors='ignore')
                        try:
                            await websocket.send_json({
                                "type": "output",
                                "data": data
                            })
                        except (RuntimeError, ConnectionError):
                            # WebSocket已关闭，退出循环
                            break
                    elif channel.exit_status_ready():
                        # SSH会话已结束
                        try:
                            await websocket.send_json({
                                "type": "output",
                                "data": "\r\n[SSH会话已结束]\r\n"
                            })
                        except:
                            pass
                        break
                    await asyncio.sleep(0.05)  # 减少延迟，提高响应速度
            except asyncio.CancelledError:
                # 任务被取消，正常退出
                logger.info("SSH数据接收任务被取消")
                raise
            except Exception as e:
                logger.error(f"接收SSH数据错误: {str(e)}", exc_info=True)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"接收SSH数据错误: {str(e)}"
                    })
                except (RuntimeError, ConnectionError):
                    # WebSocket已关闭，忽略错误
                    logger.debug("WebSocket已关闭，忽略发送错误消息")
                    pass
        
        # 启动接收任务
        receive_task = asyncio.create_task(receive_from_ssh())
        
        # 处理WebSocket消息
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "input":
                    # 发送输入到SSH
                    input_data = data.get("data", "")
                    channel.send(input_data.encode('utf-8'))
                
                elif msg_type == "resize":
                    # 调整终端大小
                    rows = data.get("rows", 24)
                    cols = data.get("cols", 80)
                    channel.resize_pty(width=cols, height=rows)
                
                elif msg_type == "close":
                    # 关闭连接
                    break
        
        except WebSocketDisconnect:
            logger.info("WebSocket客户端主动断开连接")
        except Exception as e:
            logger.error(f"处理WebSocket消息时出错: {str(e)}", exc_info=True)
        finally:
            logger.info("清理SSH终端资源...")
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"等待接收任务结束出错: {str(e)}")
            try:
                channel.close()
                logger.info("SSH通道已关闭")
            except Exception as e:
                logger.error(f"关闭SSH通道出错: {str(e)}")
    
    except HTTPException as e:
        # HTTPException需要特殊处理
        logger.error(f"SSH终端HTTPException: {e.detail}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": e.detail
            })
        except Exception as send_err:
            logger.error(f"发送错误消息失败: {str(send_err)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception as close_err:
            logger.error(f"关闭WebSocket失败: {str(close_err)}")
    except Exception as e:
        # 通用异常处理
        error_msg = f"SSH终端错误: {str(e)}"
        logger.error(f"SSH终端异常: {error_msg}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": error_msg
            })
        except Exception as send_err:
            # 如果发送失败，连接可能已关闭
            logger.error(f"发送错误消息失败: {str(send_err)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception as close_err:
            # 如果关闭失败，连接可能已经关闭
            logger.error(f"关闭WebSocket失败: {str(close_err)}")


# ============ 文件管理API ============

@router.get("/{server_id}/files", summary="获取文件列表")
async def list_files(
    server_id: int,
    path: str = "/",
    credential_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器文件列表
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 使用SFTP获取文件列表
        sftp = ssh.open_sftp()
        files = []
        
        try:
            items = sftp.listdir_attr(path)
            for item in items:
                files.append({
                    "name": item.filename,
                    "path": f"{path.rstrip('/')}/{item.filename}",
                    "type": "directory" if item.st_mode & 0o040000 else "file",
                    "size": item.st_size,
                    "modified": item.st_mtime,
                    "permissions": oct(item.st_mode)[-3:]
                })
        finally:
            sftp.close()
        
        return {
            "path": path,
            "files": files
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件列表失败: {str(e)}"
        )


@router.post("/{server_id}/files/upload", summary="上传文件")
async def upload_file(
    server_id: int,
    file: UploadFile = File(...),
    path: str = Form(...),
    credential_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    上传文件到服务器
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 使用SFTP上传文件
        sftp = ssh.open_sftp()
        
        try:
            # 读取文件内容
            file_content = await file.read()
            
            # 上传文件
            remote_path = f"{path.rstrip('/')}/{file.filename}"
            with sftp.file(remote_path, 'wb') as remote_file:
                remote_file.write(file_content)
        
        finally:
            sftp.close()
        
        return {"message": "文件上传成功", "path": remote_path}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}"
        )


@router.get("/{server_id}/files/download", summary="下载文件")
async def download_file(
    server_id: int,
    path: str,
    credential_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    从服务器下载文件
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 使用SFTP下载文件
        sftp = ssh.open_sftp()
        
        try:
            # 读取文件内容
            with sftp.file(path, 'rb') as remote_file:
                file_content = remote_file.read()
            
            # 获取文件名
            filename = os.path.basename(path)
            
            # 返回文件流
            return StreamingResponse(
                BytesIO(file_content),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        
        finally:
            sftp.close()
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件下载失败: {str(e)}"
        )


@router.delete("/{server_id}/files", summary="删除文件或目录")
async def delete_file_or_dir(
    server_id: int,
    path: str,
    credential_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除服务器上的文件或目录
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 使用SFTP删除文件或目录
        sftp = ssh.open_sftp()
        
        try:
            # 检查是文件还是目录
            stat = sftp.stat(path)
            if stat.st_mode & 0o040000:
                # 目录
                sftp.rmdir(path)
            else:
                # 文件
                sftp.remove(path)
        
        finally:
            sftp.close()
        
        return {"message": "删除成功"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除失败: {str(e)}"
        )


@router.post("/{server_id}/files/mkdir", summary="创建目录")
async def create_directory(
    server_id: int,
    path: str,
    credential_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    在服务器上创建目录
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 使用SFTP创建目录
        sftp = ssh.open_sftp()
        
        try:
            sftp.mkdir(path)
        finally:
            sftp.close()
        
        return {"message": "目录创建成功", "path": path}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建目录失败: {str(e)}"
        )


@router.post("/{server_id}/ssh/disconnect", summary="断开SSH连接")
async def disconnect_ssh(
    server_id: int,
    credential_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """
    断开SSH连接
    """
    close_ssh_connection(server_id, credential_id)
    return {"message": "SSH连接已断开"}


# ============ 命令执行API ============

@router.post("/{server_id}/execute", summary="执行命令")
async def execute_command(
    server_id: int,
    command: str = Form(...),
    credential_id: int = Form(...),
    timeout: int = Form(30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    在服务器上执行命令
    
    - **command**: 要执行的命令
    - **credential_id**: 凭据ID
    - **timeout**: 超时时间（秒，默认30秒）
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 执行命令
        stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
        
        # 读取输出
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8', errors='ignore')
        error_output = stderr.read().decode('utf-8', errors='ignore')
        
        return {
            "success": exit_status == 0,
            "exit_status": exit_status,
            "output": output,
            "error": error_output,
            "command": command
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"命令执行失败: {str(e)}"
        )


# ============ 进程管理API ============

@router.get("/{server_id}/processes", summary="获取进程列表")
async def get_processes(
    server_id: int,
    credential_id: int = Query(...),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器进程列表
    
    - **credential_id**: 凭据ID
    - **search**: 搜索关键词（进程名）
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 执行ps命令获取进程列表
        # 使用ps aux格式：USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        command = "ps aux"
        if search:
            command = f"ps aux | grep -i '{search}' | grep -v grep"
        
        stdin, stdout, stderr = ssh.exec_command(command, timeout=10)
        output = stdout.read().decode('utf-8', errors='ignore')
        
        # 解析进程列表
        processes = []
        lines = output.strip().split('\n')
        if len(lines) > 1:  # 跳过标题行
            for line in lines[1:]:
                if not line.strip():
                    continue
                parts = line.split()
                if len(parts) >= 11:
                    processes.append({
                        "user": parts[0],
                        "pid": int(parts[1]),
                        "cpu_percent": float(parts[2]),
                        "memory_percent": float(parts[3]),
                        "vsz": int(parts[4]),  # 虚拟内存大小（KB）
                        "rss": int(parts[5]),  # 物理内存大小（KB）
                        "tty": parts[6],
                        "stat": parts[7],
                        "start": parts[8],
                        "time": parts[9],
                        "command": ' '.join(parts[10:])
                    })
        
        return {
            "processes": processes,
            "total": len(processes)
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取进程列表失败: {str(e)}"
        )


@router.post("/{server_id}/processes/{pid}/kill", summary="终止进程")
async def kill_process(
    server_id: int,
    pid: int,
    credential_id: int = Form(...),
    signal: int = Form(15),  # 默认SIGTERM
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    终止服务器进程
    
    - **pid**: 进程ID
    - **credential_id**: 凭据ID
    - **signal**: 信号（9=SIGKILL, 15=SIGTERM，默认15）
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="服务器不存在")
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭据不存在")
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        ssh = create_ssh_connection(server, credential, db)
    
    try:
        # 执行kill命令
        command = f"kill -{signal} {pid}"
        stdin, stdout, stderr = ssh.exec_command(command, timeout=10)
        exit_status = stdout.channel.recv_exit_status()
        error_output = stderr.read().decode('utf-8', errors='ignore')
        
        if exit_status != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"终止进程失败: {error_output}"
            )
        
        return {"message": f"进程 {pid} 已终止", "success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"终止进程失败: {str(e)}"
        )
