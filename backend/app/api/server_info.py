"""
服务器信息采集API
"""
import json
import re
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import paramiko

from app.core.database import get_db
from app.models.server import Server
from app.models.credential import Credential
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.core.encryption import decrypt_password
from app.api.server_ssh import get_ssh_connection, create_ssh_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["服务器信息采集"])


def parse_cpu_info(output: str) -> Dict[str, Any]:
    """解析CPU信息"""
    cpu_info = {
        "model": "",
        "cores": 0,
        "threads": 0,
        "usage": 0.0
    }
    
    # 解析CPU型号（多种格式）
    model_match = re.search(r'model name\s+:\s+(.+)', output, re.IGNORECASE) or \
                 re.search(r'Processor\s+:\s+(.+)', output, re.IGNORECASE) or \
                 re.search(r'Hardware\s+:\s+(.+)', output, re.IGNORECASE)
    if model_match:
        cpu_info["model"] = model_match.group(1).strip()
    
    # 解析CPU核心数
    cores_match = re.search(r'cpu cores\s+:\s+(\d+)', output, re.IGNORECASE) or \
                 re.search(r'Core\(s\) per socket:\s+(\d+)', output, re.IGNORECASE)
    if cores_match:
        cpu_info["cores"] = int(cores_match.group(1))
    
    # 解析线程数
    threads_match = re.search(r'siblings\s+:\s+(\d+)', output, re.IGNORECASE) or \
                   re.search(r'Thread\(s\) per core:\s+(\d+)', output, re.IGNORECASE)
    if threads_match:
        cpu_info["threads"] = int(threads_match.group(1))
    
    # 如果没有找到cores，尝试从processor数量推断
    if cpu_info["cores"] == 0:
        processor_count = len(re.findall(r'^processor\s*:', output, re.MULTILINE))
        if processor_count > 0:
            cpu_info["cores"] = processor_count
    
    # 如果没有找到model，尝试从其他字段推断
    if not cpu_info["model"]:
        vendor_match = re.search(r'vendor_id\s+:\s+(.+)', output, re.IGNORECASE)
        if vendor_match:
            vendor = vendor_match.group(1).strip()
            cpu_info["model"] = f"{vendor} CPU"
    
    return cpu_info


def parse_memory_info(output: str) -> Dict[str, Any]:
    """解析内存信息"""
    memory_info = {
        "total": 0,
        "used": 0,
        "free": 0,
        "cached": 0,
        "buffers": 0,
        "usage_percent": 0.0
    }
    
    # 解析内存信息（单位：KB）
    total_match = re.search(r'MemTotal:\s+(\d+)\s+kB', output)
    if total_match:
        memory_info["total"] = int(total_match.group(1)) * 1024  # 转换为字节
    
    free_match = re.search(r'MemFree:\s+(\d+)\s+kB', output)
    if free_match:
        memory_info["free"] = int(free_match.group(1)) * 1024
    
    cached_match = re.search(r'Cached:\s+(\d+)\s+kB', output)
    if cached_match:
        memory_info["cached"] = int(cached_match.group(1)) * 1024
    
    buffers_match = re.search(r'Buffers:\s+(\d+)\s+kB', output)
    if buffers_match:
        memory_info["buffers"] = int(buffers_match.group(1)) * 1024
    
    if memory_info["total"] > 0:
        memory_info["used"] = memory_info["total"] - memory_info["free"] - memory_info["cached"] - memory_info["buffers"]
        memory_info["usage_percent"] = (memory_info["used"] / memory_info["total"]) * 100
    
    return memory_info


def parse_size_to_bytes(size_str: str) -> int:
    """将大小字符串（如 '10G', '500M'）转换为字节"""
    size_str = size_str.upper().strip()
    if not size_str:
        return 0
    
    # 移除可能的非数字字符（除了K, M, G, T）
    multipliers = {'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4}
    
    # 提取数字和单位
    import re
    match = re.match(r'^([\d.]+)([KMGT]?)$', size_str)
    if match:
        number = float(match.group(1))
        unit = match.group(2) or 'B'
        if unit == 'B':
            return int(number)
        elif unit in multipliers:
            return int(number * multipliers[unit])
    
    # 如果无法解析，尝试直接转换为整数
    try:
        return int(float(size_str))
    except (ValueError, TypeError):
        return 0


def parse_disk_info(output: str) -> Dict[str, Any]:
    """解析磁盘信息"""
    disks = []
    lines = output.strip().split('\n')
    
    for line in lines[1:]:  # 跳过标题行
        line = line.strip()
        if not line:
            continue
        
        parts = line.split()
        if len(parts) >= 5:
            try:
                filesystem = parts[0]
                # df -h 输出格式: Filesystem Size Used Avail Use% Mounted on
                # 处理可能包含单位的大小值（如 10G, 500M）
                size_str = parts[1]
                used_str = parts[2]
                available_str = parts[3]
                use_percent_str = parts[4].rstrip('%')
                mount_point = ' '.join(parts[5:]) if len(parts) > 5 else ''
                
                # 转换为字节
                size = parse_size_to_bytes(size_str)
                used = parse_size_to_bytes(used_str)
                available = parse_size_to_bytes(available_str)
                
                # 解析使用百分比
                try:
                    use_percent = float(use_percent_str)
                except ValueError:
                    use_percent = 0.0
                
                disks.append({
                    "filesystem": filesystem,
                    "size": size,
                    "used": used,
                    "available": available,
                    "usage_percent": use_percent,
                    "mount_point": mount_point
                })
            except (ValueError, IndexError) as e:
                # 记录解析错误但继续处理其他行
                import logging
                logger = logging.getLogger(__name__)
                logger.debug(f"解析磁盘信息行失败: {line}, 错误: {str(e)}")
                continue
    
    return {"disks": disks}


def parse_network_info(output: str) -> Dict[str, Any]:
    """解析网络信息（支持ip和ifconfig命令）"""
    interfaces = []
    lines = output.strip().split('\n')
    
    # 判断是ip命令还是ifconfig命令的输出
    # ip命令格式: "1: lo: <LOOPBACK,UP,LOWER_UP> ..."
    # ifconfig格式: "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> ..."
    is_ip_command = any(re.match(r'^\d+:\s+\S+:\s+<', line) for line in lines[:10])
    
    current_interface = None
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        if is_ip_command:
            # ip -s link show 格式
            # 示例: "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000"
            if re.match(r'^\d+:', line):
                if current_interface:
                    interfaces.append(current_interface)
                # 解析接口名和状态
                match = re.match(r'^\d+:\s+(\S+):\s+<([^>]+)>\s+.*state\s+(\S+)', line) or \
                       re.match(r'^\d+:\s+(\S+):\s+<([^>]+)>', line)
                if match:
                    name = match.group(1)
                    flags = match.group(2).split(',')
                    # 从state字段获取状态（如果存在）
                    state = match.group(3) if len(match.groups()) >= 3 else None
                    if state:
                        status = 'up' if state.upper() in ['UP', 'UNKNOWN'] else 'down'
                    else:
                        status = 'up' if any('UP' in f for f in flags) else 'down'
                    current_interface = {
                        "name": name,
                        "status": status,
                        "rx_bytes": 0,
                        "tx_bytes": 0,
                        "rx_packets": 0,
                        "tx_packets": 0
                    }
            elif current_interface:
                # 解析统计信息
                # RX行示例: "    RX: bytes  packets  errors  dropped overrun mcast"
                # 数据行示例: "    123456    789      0       0       0       0"
                if 'RX:' in line:
                    # 下一行应该是数据
                    if i + 1 < len(lines):
                        data_line = lines[i + 1].strip()
                        rx_match = re.search(r'(\d+)', data_line)
                        if rx_match:
                            current_interface["rx_bytes"] = int(rx_match.group(1))
                        rx_packets_match = re.findall(r'\d+', data_line)
                        if len(rx_packets_match) > 1:
                            current_interface["rx_packets"] = int(rx_packets_match[1])
                elif 'TX:' in line:
                    # 下一行应该是数据
                    if i + 1 < len(lines):
                        data_line = lines[i + 1].strip()
                        tx_match = re.search(r'(\d+)', data_line)
                        if tx_match:
                            current_interface["tx_bytes"] = int(tx_match.group(1))
                        tx_packets_match = re.findall(r'\d+', data_line)
                        if len(tx_packets_match) > 1:
                            current_interface["tx_packets"] = int(tx_packets_match[1])
        else:
            # ifconfig 格式
            # 示例: "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500"
            if ':' in line and not line.startswith(' ') and not line.startswith('\t') and not line.startswith('inet'):
                if current_interface:
                    interfaces.append(current_interface)
                parts = line.split(':')
                name = parts[0].strip()
                # 检查状态标志
                status = 'down'
                if 'UP' in line.upper() or 'RUNNING' in line.upper():
                    status = 'up'
                current_interface = {
                    "name": name,
                    "status": status,
                    "rx_bytes": 0,
                    "tx_bytes": 0,
                    "rx_packets": 0,
                    "tx_packets": 0
                }
            elif current_interface:
                # 解析RX统计
                # 示例: "        RX packets 123456  bytes 78901234 (75.2 MiB)"
                rx_match = re.search(r'RX.*?packets\s+(\d+).*?bytes\s+(\d+)', line, re.IGNORECASE)
                if rx_match:
                    current_interface["rx_packets"] = int(rx_match.group(1))
                    current_interface["rx_bytes"] = int(rx_match.group(2))
                # 解析TX统计
                # 示例: "        TX packets 654321  bytes 98765432 (94.2 MiB)"
                tx_match = re.search(r'TX.*?packets\s+(\d+).*?bytes\s+(\d+)', line, re.IGNORECASE)
                if tx_match:
                    current_interface["tx_packets"] = int(tx_match.group(1))
                    current_interface["tx_bytes"] = int(tx_match.group(2))
    
    if current_interface:
        interfaces.append(current_interface)
    
    return {"interfaces": interfaces}


def parse_os_info(output: str) -> Dict[str, Any]:
    """解析操作系统信息（支持多种Linux发行版）"""
    os_info = {
        "name": "Unknown",
        "version": "Unknown",
        "kernel": "Unknown",
        "architecture": "Unknown",
        "codename": "",
        "id": ""
    }
    
    # 解析 /etc/os-release 文件内容（优先）
    # ID=ubuntu
    # VERSION_ID="20.04"
    # PRETTY_NAME="Ubuntu 20.04.3 LTS"
    # NAME="Ubuntu"
    # VERSION="20.04.3 LTS (Focal Fossa)"
    
    # 解析发行版ID
    id_match = re.search(r'^ID=["\']?([^"\'\n]+)["\']?', output, re.MULTILINE | re.IGNORECASE)
    if id_match:
        os_info["id"] = id_match.group(1).strip().lower()
    
    # 解析发行版名称
    name_match = re.search(r'^NAME=["\']([^"\']+)["\']', output, re.MULTILINE | re.IGNORECASE)
    if name_match:
        os_info["name"] = name_match.group(1).strip()
    elif 'Ubuntu' in output:
        os_info["name"] = "Ubuntu"
    elif 'Debian' in output:
        os_info["name"] = "Debian"
    elif 'CentOS' in output:
        os_info["name"] = "CentOS"
    elif 'Red Hat' in output or 'RHEL' in output:
        os_info["name"] = "Red Hat Enterprise Linux"
    elif 'Fedora' in output:
        os_info["name"] = "Fedora"
    elif 'openSUSE' in output or 'SUSE' in output:
        os_info["name"] = "openSUSE"
    elif 'Arch' in output:
        os_info["name"] = "Arch Linux"
    elif 'Alpine' in output:
        os_info["name"] = "Alpine Linux"
    elif 'Rocky' in output:
        os_info["name"] = "Rocky Linux"
    elif 'Oracle' in output:
        os_info["name"] = "Oracle Linux"
    
    # 解析版本号
    version_id_match = re.search(r'^VERSION_ID=["\']?([^"\'\n]+)["\']?', output, re.MULTILINE | re.IGNORECASE)
    if version_id_match:
        os_info["version"] = version_id_match.group(1).strip().strip('"').strip("'")
    else:
        # 尝试其他格式
        version_match = re.search(r'VERSION="([^"]+)"', output)
        if version_match:
            os_info["version"] = version_match.group(1)
        elif 'DISTRIB_RELEASE=' in output:
            version_match = re.search(r'DISTRIB_RELEASE=([^\s]+)', output)
            if version_match:
                os_info["version"] = version_match.group(1)
    
    # 解析代号（如 Focal Fossa, Bionic Beaver 等）
    codename_match = re.search(r'VERSION_CODENAME=["\']?([^"\'\n]+)["\']?', output, re.MULTILINE | re.IGNORECASE)
    if codename_match:
        os_info["codename"] = codename_match.group(1).strip()
    elif 'DISTRIB_CODENAME=' in output:
        codename_match = re.search(r'DISTRIB_CODENAME=([^\s]+)', output)
        if codename_match:
            os_info["codename"] = codename_match.group(1)
    
    # 解析内核版本（从 uname -a 输出）
    kernel_match = re.search(r'Linux version\s+([^\s]+)', output)
    if kernel_match:
        os_info["kernel"] = kernel_match.group(1)
    else:
        # 尝试从 uname -r 格式解析
        kernel_match = re.search(r'(\d+\.\d+\.\d+[-\w]*)', output)
        if kernel_match:
            os_info["kernel"] = kernel_match.group(1)
    
    # 解析架构（从 uname -m 或 /proc/cpuinfo）
    arch_match = re.search(r'Machine:\s+(\S+)', output) or \
                 re.search(r'architecture:\s+(\S+)', output, re.IGNORECASE) or \
                 re.search(r'\b(x86_64|amd64|i386|i686|arm64|aarch64|ppc64le|s390x)\b', output, re.IGNORECASE)
    if arch_match:
        arch = arch_match.group(1).lower()
        # 标准化架构名称
        if arch in ['amd64', 'x86_64']:
            os_info["architecture"] = "x86_64"
        elif arch in ['aarch64', 'arm64']:
            os_info["architecture"] = "aarch64"
        elif arch in ['i386', 'i686']:
            os_info["architecture"] = "i386"
        else:
            os_info["architecture"] = arch
    
    return os_info


@router.post("/{server_id}/collect-info", summary="采集服务器信息")
async def collect_server_info(
    server_id: int,
    credential_id: int = Query(..., description="凭据ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    通过SSH连接采集服务器信息
    
    采集的信息包括：
    - CPU信息（型号、核心数、使用率）
    - 内存信息（总量、使用量、使用率）
    - 磁盘信息（各分区使用情况）
    - 网络信息（各网卡流量统计）
    - 操作系统信息（发行版、内核版本、架构）
    """
    # 获取服务器和凭据
    server_result = await db.execute(
        select(Server).where(Server.id == server_id).options(selectinload(Server.jump_host))
    )
    server = server_result.scalar_one_or_none()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    credential_result = await db.execute(
        select(Credential).where(Credential.id == credential_id)
    )
    credential = credential_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="凭据不存在"
        )
    
    # 获取或创建SSH连接
    ssh = get_ssh_connection(server_id, credential_id)
    if not ssh:
        try:
            ssh = create_ssh_connection(server, credential, db)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"SSH连接失败: {str(e)}"
            )
    
    collected_info = {}
    errors = []
    
    try:
        # 1. 采集CPU信息
        try:
            stdin, stdout, stderr = ssh.exec_command("cat /proc/cpuinfo", timeout=10)
            exit_status = stdout.channel.recv_exit_status()
            cpu_output = stdout.read().decode('utf-8', errors='ignore')
            stderr_output = stderr.read().decode('utf-8', errors='ignore')
            if exit_status != 0:
                errors.append(f"CPU信息采集失败: {stderr_output}")
                collected_info["cpu"] = {"error": stderr_output}
            else:
                collected_info["cpu"] = parse_cpu_info(cpu_output)
                
                # 采集CPU使用率（使用多种方法确保兼容性）
                try:
                    # 方法1: 使用top命令
                    stdin, stdout, stderr = ssh.exec_command("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'", timeout=5)
                    exit_status = stdout.channel.recv_exit_status()
                    cpu_usage_output = stdout.read().decode('utf-8', errors='ignore').strip()
                    if exit_status == 0 and cpu_usage_output:
                        try:
                            usage = float(cpu_usage_output)
                            if 0 <= usage <= 100:
                                collected_info["cpu"]["usage"] = usage
                        except ValueError:
                            pass
                    
                    # 如果方法1失败，尝试方法2: 使用vmstat
                    if "usage" not in collected_info["cpu"] or collected_info["cpu"]["usage"] == 0:
                        stdin, stdout, stderr = ssh.exec_command("vmstat 1 2 | tail -1 | awk '{print 100 - $15}'", timeout=5)
                        exit_status = stdout.channel.recv_exit_status()
                        vmstat_output = stdout.read().decode('utf-8', errors='ignore').strip()
                        if exit_status == 0 and vmstat_output:
                            try:
                                usage = float(vmstat_output)
                                if 0 <= usage <= 100:
                                    collected_info["cpu"]["usage"] = usage
                            except ValueError:
                                pass
                except Exception as e:
                    logger.warning(f"采集CPU使用率失败: {str(e)}")
        except Exception as e:
            error_msg = f"CPU信息采集异常: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            collected_info["cpu"] = {"error": error_msg}
        
        # 2. 采集内存信息
        try:
            stdin, stdout, stderr = ssh.exec_command("cat /proc/meminfo", timeout=10)
            exit_status = stdout.channel.recv_exit_status()
            memory_output = stdout.read().decode('utf-8', errors='ignore')
            stderr_output = stderr.read().decode('utf-8', errors='ignore')
            if exit_status != 0:
                errors.append(f"内存信息采集失败: {stderr_output}")
                collected_info["memory"] = {"error": stderr_output}
            else:
                collected_info["memory"] = parse_memory_info(memory_output)
        except Exception as e:
            error_msg = f"内存信息采集异常: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            collected_info["memory"] = {"error": error_msg}
        
        # 3. 采集磁盘信息
        try:
            stdin, stdout, stderr = ssh.exec_command("df -h", timeout=10)
            exit_status = stdout.channel.recv_exit_status()
            disk_output = stdout.read().decode('utf-8', errors='ignore')
            stderr_output = stderr.read().decode('utf-8', errors='ignore')
            if exit_status != 0:
                errors.append(f"磁盘信息采集失败: {stderr_output}")
                collected_info["disk"] = {"error": stderr_output}
            else:
                collected_info["disk"] = parse_disk_info(disk_output)
        except Exception as e:
            error_msg = f"磁盘信息采集异常: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            collected_info["disk"] = {"error": error_msg}
        
        # 4. 采集网络信息
        try:
            # 优先使用ip命令，它能提供更详细的状态信息
            stdin, stdout, stderr = ssh.exec_command("ip -s link show", timeout=10)
            exit_status = stdout.channel.recv_exit_status()
            network_output = stdout.read().decode('utf-8', errors='ignore')
            if exit_status != 0 or not network_output.strip():
                # 如果ip命令不可用，尝试ifconfig
                stdin, stdout, stderr = ssh.exec_command("ifconfig -a 2>/dev/null || /sbin/ifconfig -a", timeout=10)
                exit_status = stdout.channel.recv_exit_status()
                network_output = stdout.read().decode('utf-8', errors='ignore')
                stderr_output = stderr.read().decode('utf-8', errors='ignore')
                if exit_status != 0 or not network_output.strip():
                    errors.append(f"网络信息采集失败: 无法执行ip或ifconfig命令")
                    collected_info["network"] = {"error": "无法获取网络信息"}
                else:
                    collected_info["network"] = parse_network_info(network_output)
            else:
                collected_info["network"] = parse_network_info(network_output)
        except Exception as e:
            error_msg = f"网络信息采集异常: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            collected_info["network"] = {"error": error_msg}
        
        # 5. 采集操作系统信息
        try:
            stdin, stdout, stderr = ssh.exec_command("uname -a && cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null", timeout=10)
            exit_status = stdout.channel.recv_exit_status()
            os_output = stdout.read().decode('utf-8', errors='ignore')
            stderr_output = stderr.read().decode('utf-8', errors='ignore')
            if exit_status != 0:
                errors.append(f"操作系统信息采集失败: {stderr_output}")
                collected_info["os"] = {"error": stderr_output}
            else:
                collected_info["os"] = parse_os_info(os_output)
        except Exception as e:
            error_msg = f"操作系统信息采集异常: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            collected_info["os"] = {"error": error_msg}
        
        # 6. 采集系统运行时间
        try:
            stdin, stdout, stderr = ssh.exec_command("uptime -s 2>/dev/null || uptime", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            uptime_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0:
                collected_info["uptime"] = uptime_output
        except Exception as e:
            logger.warning(f"采集系统运行时间失败: {str(e)}")
        
        # 7. 采集负载平均值
        try:
            stdin, stdout, stderr = ssh.exec_command("uptime", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            load_output = stdout.read().decode('utf-8', errors='ignore')
            if exit_status == 0:
                load_match = re.search(r'load average:\s+([\d.]+),\s+([\d.]+),\s+([\d.]+)', load_output)
                if load_match:
                    collected_info["load_average"] = {
                        "1min": float(load_match.group(1)),
                        "5min": float(load_match.group(2)),
                        "15min": float(load_match.group(3))
                    }
        except Exception as e:
            logger.warning(f"采集负载平均值失败: {str(e)}")
        
        # 8. 采集主机名
        try:
            stdin, stdout, stderr = ssh.exec_command("hostname 2>/dev/null || hostname -f 2>/dev/null || cat /etc/hostname 2>/dev/null", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            hostname_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0 and hostname_output:
                collected_info["hostname"] = hostname_output
        except Exception as e:
            logger.warning(f"采集主机名失败: {str(e)}")
        
        # 9. 采集时区信息
        try:
            stdin, stdout, stderr = ssh.exec_command("timedatectl 2>/dev/null | grep 'Time zone' || date +%Z 2>/dev/null || cat /etc/timezone 2>/dev/null", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            timezone_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0 and timezone_output:
                # 解析时区
                tz_match = re.search(r'Time zone:\s+(\S+)', timezone_output) or \
                          re.search(r'([A-Z]+/[A-Z_]+)', timezone_output)
                if tz_match:
                    collected_info["timezone"] = tz_match.group(1)
                else:
                    collected_info["timezone"] = timezone_output
        except Exception as e:
            logger.warning(f"采集时区信息失败: {str(e)}")
        
        # 10. 采集系统时间
        try:
            stdin, stdout, stderr = ssh.exec_command("date '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || date", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            datetime_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0 and datetime_output:
                collected_info["system_time"] = datetime_output
        except Exception as e:
            logger.warning(f"采集系统时间失败: {str(e)}")
        
        # 11. 采集CPU详细信息（频率、缓存等）
        try:
            stdin, stdout, stderr = ssh.exec_command("lscpu 2>/dev/null || cat /proc/cpuinfo | grep -E 'cpu MHz|cache size|bogomips' | head -3", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            cpu_detail_output = stdout.read().decode('utf-8', errors='ignore')
            if exit_status == 0 and cpu_detail_output:
                cpu_details = {}
                # 解析CPU频率
                freq_match = re.search(r'CPU MHz:\s+([\d.]+)', cpu_detail_output) or \
                            re.search(r'cpu MHz\s+:\s+([\d.]+)', cpu_detail_output, re.IGNORECASE) or \
                            re.search(r'CPU max MHz:\s+([\d.]+)', cpu_detail_output)
                if freq_match:
                    cpu_details["frequency_mhz"] = float(freq_match.group(1))
                
                # 解析缓存大小
                cache_match = re.search(r'L3 cache:\s+(\d+)\s*([KMGT]?B?)', cpu_detail_output, re.IGNORECASE) or \
                             re.search(r'cache size\s+:\s+(\d+)\s*([KMGT]?B?)', cpu_detail_output, re.IGNORECASE)
                if cache_match:
                    cache_size = int(cache_match.group(1))
                    cache_unit = cache_match.group(2).upper() if cache_match.group(2) else 'KB'
                    cpu_details["cache_size"] = f"{cache_size} {cache_unit}"
                
                # 解析BogoMIPS
                bogomips_match = re.search(r'BogoMIPS:\s+([\d.]+)', cpu_detail_output, re.IGNORECASE) or \
                               re.search(r'bogomips\s+:\s+([\d.]+)', cpu_detail_output, re.IGNORECASE)
                if bogomips_match:
                    cpu_details["bogomips"] = float(bogomips_match.group(1))
                
                if cpu_details:
                    if "cpu" not in collected_info:
                        collected_info["cpu"] = {}
                    collected_info["cpu"].update(cpu_details)
        except Exception as e:
            logger.warning(f"采集CPU详细信息失败: {str(e)}")
        
        # 12. 采集系统用户数
        try:
            stdin, stdout, stderr = ssh.exec_command("who | wc -l 2>/dev/null || echo 0", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            users_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0 and users_output:
                try:
                    collected_info["logged_in_users"] = int(users_output)
                except ValueError:
                    pass
        except Exception as e:
            logger.warning(f"采集系统用户数失败: {str(e)}")
        
        # 13. 采集系统语言
        try:
            stdin, stdout, stderr = ssh.exec_command("echo $LANG 2>/dev/null || locale 2>/dev/null | grep LANG | head -1", timeout=5)
            exit_status = stdout.channel.recv_exit_status()
            lang_output = stdout.read().decode('utf-8', errors='ignore').strip()
            if exit_status == 0 and lang_output:
                lang_match = re.search(r'LANG=([^\s]+)', lang_output) or re.search(r'^([^\s]+)$', lang_output)
                if lang_match:
                    collected_info["language"] = lang_match.group(1)
        except Exception as e:
            logger.warning(f"采集系统语言失败: {str(e)}")
        
    except Exception as e:
        error_msg = f"采集服务器信息失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    
    # 如果有部分采集失败，记录警告但继续返回结果
    if errors:
        logger.warning(f"服务器 {server_id} 信息采集部分失败: {errors}")
        collected_info["_errors"] = errors
    
    # 更新服务器状态和OS信息
    try:
        server.status = "online"
        # 确保 collected_info 可以被JSON序列化
        server.os_info = json.loads(json.dumps(collected_info, default=str))
        await db.commit()
        await db.refresh(server)
    except Exception as e:
        error_msg = f"更新服务器信息失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        # 不抛出异常，因为信息采集已经成功，只是数据库更新失败
    
    return {
        "server_id": server_id,
        "collected_at": "now",
        "info": collected_info
    }


@router.get("/{server_id}/info", summary="获取服务器信息")
async def get_server_info(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    获取服务器信息（从数据库）
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
    
    return {
        "server_id": server_id,
        "os_info": server.os_info or {},
        "status": server.status,
        "last_check": server.last_check
    }
