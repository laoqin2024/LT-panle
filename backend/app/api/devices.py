"""
网络设备管理API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.device import NetworkDevice, DeviceInterface
from app.models.server import Server
from app.api.schemas import (
    NetworkDeviceCreate,
    NetworkDeviceUpdate,
    NetworkDeviceResponse,
    NetworkDeviceListResponse,
    DeviceInterfaceResponse,
    MessageResponse,
)
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/devices", tags=["网络设备管理"])


# ============ 网络设备CRUD ============

@router.get("", response_model=NetworkDeviceListResponse, summary="获取网络设备列表")
async def get_devices(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    status: Optional[str] = Query(None, description="状态筛选"),
    device_type: Optional[str] = Query(None, description="设备类型筛选"),
    vendor: Optional[str] = Query(None, description="厂商筛选"),
    search: Optional[str] = Query(None, description="搜索关键词（名称或IP）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取网络设备列表
    
    - 支持分页
    - 支持按状态筛选
    - 支持按设备类型筛选
    - 支持按厂商筛选
    - 支持关键词搜索（名称或IP）
    """
    # 构建查询
    query = select(NetworkDevice).options(
        selectinload(NetworkDevice.jump_host),
        selectinload(NetworkDevice.interfaces)
    )
    
    # 应用筛选条件
    conditions = []
    
    if status:
        conditions.append(NetworkDevice.status == status)
    
    if device_type:
        conditions.append(NetworkDevice.device_type == device_type)
    
    if vendor:
        conditions.append(NetworkDevice.vendor == vendor)
    
    if search:
        conditions.append(
            or_(
                NetworkDevice.name.ilike(f"%{search}%"),
                NetworkDevice.ip.ilike(f"%{search}%")
            )
        )
    
    if conditions:
        query = query.where(*conditions)
    
    # 获取总数
    count_query = select(func.count()).select_from(NetworkDevice)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 获取数据
    query = query.order_by(NetworkDevice.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    devices = result.scalars().all()
    
    # 处理响应数据，添加接口统计
    items = []
    for device in devices:
        device_dict = NetworkDeviceResponse.model_validate(device).model_dump()
        
        # 计算接口统计
        interfaces = device.interfaces
        if interfaces:
            up_count = sum(1 for iface in interfaces if iface.status == 'up')
            down_count = sum(1 for iface in interfaces if iface.status in ('down', 'admin_down'))
            total_count = len(interfaces)
            device_dict['interface_count'] = {
                'up': up_count,
                'down': down_count,
                'total': total_count
            }
        
        items.append(NetworkDeviceResponse(**device_dict))
    
    return NetworkDeviceListResponse(
        total=total,
        items=items
    )


@router.get("/{device_id}", response_model=NetworkDeviceResponse, summary="获取网络设备详情")
async def get_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取网络设备详情
    """
    result = await db.execute(
        select(NetworkDevice)
        .options(
            selectinload(NetworkDevice.jump_host),
            selectinload(NetworkDevice.interfaces)
        )
        .where(NetworkDevice.id == device_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="网络设备不存在"
        )
    
    device_dict = NetworkDeviceResponse.model_validate(device).model_dump()
    
    # 计算接口统计
    interfaces = device.interfaces
    if interfaces:
        up_count = sum(1 for iface in interfaces if iface.status == 'up')
        down_count = sum(1 for iface in interfaces if iface.status in ('down', 'admin_down'))
        total_count = len(interfaces)
        device_dict['interface_count'] = {
            'up': up_count,
            'down': down_count,
            'total': total_count
        }
    
    return NetworkDeviceResponse(**device_dict)


@router.post("", response_model=NetworkDeviceResponse, status_code=status.HTTP_201_CREATED, summary="创建网络设备")
async def create_device(
    device_data: NetworkDeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建网络设备
    
    - **name**: 设备名称（必填）
    - **ip**: IP地址（必填）
    - **device_type**: 设备类型（Router/Switch/Firewall等，可选）
    - **model**: 设备型号（可选）
    - **vendor**: 厂商（默认huawei）
    - **protocol**: 连接协议（SSH/Telnet/SNMP，默认SSH）
    - **network_type**: 网络类型（direct/vpn/jump/tunnel，默认direct）
    - **jump_host_id**: 跳板机ID（可选）
    - **description**: 描述（可选）
    """
    # 如果指定了跳板机，验证跳板机是否存在
    if device_data.jump_host_id:
        jump_host_result = await db.execute(
            select(Server).where(Server.id == device_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 检查IP是否已存在
    existing_result = await db.execute(
        select(NetworkDevice).where(NetworkDevice.ip == device_data.ip)
    )
    existing_device = existing_result.scalar_one_or_none()
    if existing_device:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该IP地址已被其他设备使用"
        )
    
    # 创建设备
    device = NetworkDevice(
        name=device_data.name,
        ip=device_data.ip,
        device_type=device_data.device_type,
        model=device_data.model,
        vendor=device_data.vendor,
        system_version=device_data.system_version,
        protocol=device_data.protocol,
        snmp_version=device_data.snmp_version,
        snmp_community=device_data.snmp_community,
        network_type=device_data.network_type,
        jump_host_id=device_data.jump_host_id,
        vpn_config=device_data.vpn_config,
        tunnel_config=device_data.tunnel_config,
        description=device_data.description,
        status="unknown",  # 初始状态为unknown
        created_by=current_user.id
    )
    
    db.add(device)
    await db.commit()
    await db.refresh(device)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(NetworkDevice)
        .options(
            selectinload(NetworkDevice.jump_host),
            selectinload(NetworkDevice.interfaces)
        )
        .where(NetworkDevice.id == device.id)
    )
    device = result.scalar_one()
    
    device_dict = NetworkDeviceResponse.model_validate(device).model_dump()
    return NetworkDeviceResponse(**device_dict)


@router.put("/{device_id}", response_model=NetworkDeviceResponse, summary="更新网络设备")
async def update_device(
    device_id: int,
    device_data: NetworkDeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    更新网络设备信息
    """
    # 获取设备
    result = await db.execute(
        select(NetworkDevice)
        .options(
            selectinload(NetworkDevice.jump_host),
            selectinload(NetworkDevice.interfaces)
        )
        .where(NetworkDevice.id == device_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="网络设备不存在"
        )
    
    # 如果更新了跳板机，验证跳板机是否存在
    if device_data.jump_host_id is not None:
        jump_host_result = await db.execute(
            select(Server).where(Server.id == device_data.jump_host_id)
        )
        jump_host = jump_host_result.scalar_one_or_none()
        if not jump_host:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的跳板机不存在"
            )
    
    # 如果更新了IP，检查是否与其他设备冲突
    ip = device_data.ip or device.ip
    if device_data.ip and ip != device.ip:
        existing_result = await db.execute(
            select(NetworkDevice).where(
                NetworkDevice.ip == ip,
                NetworkDevice.id != device_id
            )
        )
        existing_device = existing_result.scalar_one_or_none()
        if existing_device:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该IP地址已被其他设备使用"
            )
    
    # 更新字段
    update_data = device_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    
    await db.commit()
    await db.refresh(device)
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(NetworkDevice)
        .options(
            selectinload(NetworkDevice.jump_host),
            selectinload(NetworkDevice.interfaces)
        )
        .where(NetworkDevice.id == device.id)
    )
    device = result.scalar_one()
    
    device_dict = NetworkDeviceResponse.model_validate(device).model_dump()
    
    # 计算接口统计
    interfaces = device.interfaces
    if interfaces:
        up_count = sum(1 for iface in interfaces if iface.status == 'up')
        down_count = sum(1 for iface in interfaces if iface.status in ('down', 'admin_down'))
        total_count = len(interfaces)
        device_dict['interface_count'] = {
            'up': up_count,
            'down': down_count,
            'total': total_count
        }
    
    return NetworkDeviceResponse(**device_dict)


@router.delete("/{device_id}", response_model=MessageResponse, summary="删除网络设备")
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    删除网络设备
    """
    result = await db.execute(
        select(NetworkDevice).where(NetworkDevice.id == device_id)
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="网络设备不存在"
        )
    
    await db.delete(device)
    await db.commit()
    
    return MessageResponse(message="网络设备删除成功")


@router.get("/{device_id}/interfaces", summary="获取设备接口列表")
async def get_device_interfaces(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取网络设备的接口列表
    """
    # 验证设备存在
    device_result = await db.execute(
        select(NetworkDevice).where(NetworkDevice.id == device_id)
    )
    device = device_result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="网络设备不存在"
        )
    
    # 获取接口列表
    result = await db.execute(
        select(DeviceInterface)
        .where(DeviceInterface.device_id == device_id)
        .order_by(DeviceInterface.name)
    )
    interfaces = result.scalars().all()
    
    return [DeviceInterfaceResponse.model_validate(iface) for iface in interfaces]

