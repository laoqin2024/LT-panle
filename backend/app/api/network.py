"""
网络配置API路由
包括跳板机、VPN和内网穿透配置管理
"""
from typing import Optional
import json
import socket
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.system import Setting
from app.models.server import Server
from app.api.schemas import (
    VPNConfigCreate,
    VPNConfigResponse,
    VPNConfigListResponse,
    TunnelConfigCreate,
    TunnelConfigResponse,
    TunnelConfigListResponse,
    NetworkTestRequest,
    NetworkTestResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User
from datetime import datetime

router = APIRouter(prefix="/network", tags=["网络配置"])


# ============ 跳板机管理 ============
# 跳板机实际上就是服务器，通过服务器API管理
# 这里提供一个便捷接口来获取所有可用作跳板机的服务器

@router.get("/jump-hosts", summary="获取跳板机列表")
async def get_jump_hosts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取所有可用作跳板机的服务器列表
    """
    result = await db.execute(
        select(Server)
        .where(Server.status.in_(['online', 'unknown']))
        .order_by(Server.name)
    )
    servers = result.scalars().all()
    
    jump_hosts = []
    for server in servers:
        jump_hosts.append({
            "id": server.id,
            "name": server.name,
            "host": server.host,
            "port": server.port,
            "status": server.status,
            "description": server.description,
        })
    
    return {"total": len(jump_hosts), "items": jump_hosts}


# ============ VPN配置管理 ============

@router.get("/vpn-configs", response_model=VPNConfigListResponse, summary="获取VPN配置列表")
async def get_vpn_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取VPN配置列表
    """
    result = await db.execute(
        select(Setting)
        .where(Setting.category == "vpn_config")
        .order_by(Setting.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    settings = result.scalars().all()
    
    # 转换为VPN配置响应
    vpn_configs = []
    for setting in settings:
        try:
            value = json.loads(setting.value) if setting.value else {}
        except:
            value = {}
        
        vpn_configs.append(VPNConfigResponse(
            id=setting.id,
            name=value.get("name", setting.key),
            type=value.get("type", "openvpn"),
            config_file=value.get("config_file"),
            config_content=value.get("config_content"),
            description=value.get("description", setting.description),
            status=value.get("status"),
            connected_at=datetime.fromisoformat(value["connected_at"]) if value.get("connected_at") else None,
            created_at=setting.updated_at or datetime.now(),
            updated_at=setting.updated_at or datetime.now(),
        ))
    
    # 获取总数
    count_result = await db.execute(
        select(func.count()).select_from(Setting).where(Setting.category == "vpn_config")
    )
    total = count_result.scalar()
    
    return VPNConfigListResponse(total=total, items=vpn_configs)


@router.post("/vpn-configs", response_model=VPNConfigResponse, status_code=status.HTTP_201_CREATED, summary="创建VPN配置")
async def create_vpn_config(
    vpn_data: VPNConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建VPN配置
    """
    # 检查名称是否已存在
    existing = await db.execute(
        select(Setting).where(
            Setting.category == "vpn_config",
            Setting.key == f"vpn_{vpn_data.name}"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VPN配置名称已存在"
        )
    
    # 创建设置记录
    config_value = {
        "name": vpn_data.name,
        "type": vpn_data.type,
        "config_file": vpn_data.config_file,
        "config_content": vpn_data.config_content,
        "description": vpn_data.description,
        "status": "disconnected",
    }
    
    setting = Setting(
        key=f"vpn_{vpn_data.name}",
        value=json.dumps(config_value),
        category="vpn_config",
        description=vpn_data.description,
        updated_by=current_user.id
    )
    
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    
    value = json.loads(setting.value)
    return VPNConfigResponse(
        id=setting.id,
        name=value["name"],
        type=value["type"],
        config_file=value.get("config_file"),
        config_content=value.get("config_content"),
        description=value.get("description"),
        status=value.get("status"),
        created_at=setting.updated_at or datetime.now(),
        updated_at=setting.updated_at or datetime.now(),
    )


@router.delete("/vpn-configs/{config_id}", response_model=MessageResponse, summary="删除VPN配置")
async def delete_vpn_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除VPN配置
    """
    result = await db.execute(
        select(Setting).where(
            Setting.id == config_id,
            Setting.category == "vpn_config"
        )
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VPN配置不存在"
        )
    
    await db.delete(setting)
    await db.commit()
    
    return MessageResponse(message="VPN配置删除成功")


# ============ 内网穿透配置管理 ============

@router.get("/tunnel-configs", response_model=TunnelConfigListResponse, summary="获取内网穿透配置列表")
async def get_tunnel_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取内网穿透配置列表
    """
    result = await db.execute(
        select(Setting)
        .where(Setting.category == "tunnel_config")
        .order_by(Setting.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    settings = result.scalars().all()
    
    # 转换为内网穿透配置响应
    tunnel_configs = []
    for setting in settings:
        try:
            value = json.loads(setting.value) if setting.value else {}
        except:
            value = {}
        
        tunnel_configs.append(TunnelConfigResponse(
            id=setting.id,
            name=value.get("name", setting.key),
            server_url=value.get("server_url", ""),
            client_token=value.get("client_token"),
            description=value.get("description", setting.description),
            status=value.get("status"),
            connected_at=datetime.fromisoformat(value["connected_at"]) if value.get("connected_at") else None,
            created_at=setting.updated_at or datetime.now(),
            updated_at=setting.updated_at or datetime.now(),
        ))
    
    # 获取总数
    count_result = await db.execute(
        select(func.count()).select_from(Setting).where(Setting.category == "tunnel_config")
    )
    total = count_result.scalar()
    
    return TunnelConfigListResponse(total=total, items=tunnel_configs)


@router.post("/tunnel-configs", response_model=TunnelConfigResponse, status_code=status.HTTP_201_CREATED, summary="创建内网穿透配置")
async def create_tunnel_config(
    tunnel_data: TunnelConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建内网穿透配置
    """
    # 检查名称是否已存在
    existing = await db.execute(
        select(Setting).where(
            Setting.category == "tunnel_config",
            Setting.key == f"tunnel_{tunnel_data.name}"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="内网穿透配置名称已存在"
        )
    
    # 创建设置记录
    config_value = {
        "name": tunnel_data.name,
        "server_url": tunnel_data.server_url,
        "client_token": tunnel_data.client_token,
        "description": tunnel_data.description,
        "status": "disconnected",
    }
    
    setting = Setting(
        key=f"tunnel_{tunnel_data.name}",
        value=json.dumps(config_value),
        category="tunnel_config",
        description=tunnel_data.description,
        updated_by=current_user.id
    )
    
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    
    value = json.loads(setting.value)
    return TunnelConfigResponse(
        id=setting.id,
        name=value["name"],
        server_url=value["server_url"],
        client_token=value.get("client_token"),
        description=value.get("description"),
        status=value.get("status"),
        created_at=setting.updated_at or datetime.now(),
        updated_at=setting.updated_at or datetime.now(),
    )


@router.delete("/tunnel-configs/{config_id}", response_model=MessageResponse, summary="删除内网穿透配置")
async def delete_tunnel_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除内网穿透配置
    """
    result = await db.execute(
        select(Setting).where(
            Setting.id == config_id,
            Setting.category == "tunnel_config"
        )
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="内网穿透配置不存在"
        )
    
    await db.delete(setting)
    await db.commit()
    
    return MessageResponse(message="内网穿透配置删除成功")


# ============ 网络连接测试 ============

@router.post("/test", response_model=NetworkTestResponse, summary="测试网络连接")
async def test_network_connection(
    test_data: NetworkTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    测试网络连接
    
    测试指定主机和端口的连通性
    """
    try:
        start_time = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(test_data.timeout or 5)
        result = sock.connect_ex((test_data.host, test_data.port))
        sock.close()
        
        latency = (time.time() - start_time) * 1000  # 转换为毫秒
        
        if result == 0:
            return NetworkTestResponse(
                success=True,
                message=f"连接成功",
                latency=round(latency, 2)
            )
        else:
            return NetworkTestResponse(
                success=False,
                message=f"连接失败: 无法连接到 {test_data.host}:{test_data.port}",
                latency=None
            )
    except socket.gaierror as e:
        return NetworkTestResponse(
            success=False,
            message=f"DNS解析失败: {str(e)}",
            latency=None
        )
    except socket.timeout:
        return NetworkTestResponse(
            success=False,
            message=f"连接超时（{test_data.timeout or 5}秒）",
            latency=None
        )
    except Exception as e:
        return NetworkTestResponse(
            success=False,
            message=f"连接测试失败: {str(e)}",
            latency=None
        )
