"""
SSH工具函数 - 用于加载SSH密钥等公共功能
"""
import os
import logging
import subprocess
from io import StringIO
from typing import Optional
import paramiko
from fastapi import HTTPException, status

from app.models.credential import Credential
from app.core.encryption import decrypt_password

logger = logging.getLogger(__name__)


def generate_public_key_from_private(private_key_content: str) -> Optional[str]:
    """
    从私钥内容生成公钥
    
    Args:
        private_key_content: 私钥内容（字符串）
        
    Returns:
        公钥内容（字符串），如果失败返回None
    """
    try:
        # 使用ssh-keygen命令生成公钥
        process = subprocess.Popen(
            ['ssh-keygen', '-y', '-f', '-'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(input=private_key_content)
        
        if process.returncode == 0:
            return stdout.strip()
        else:
            logger.error(f"生成公钥失败: {stderr}")
            return None
    except Exception as e:
        logger.error(f"生成公钥时出错: {str(e)}")
        return None


def load_ssh_private_key(credential: Credential) -> Optional[paramiko.PKey]:
    """
    从凭据加载SSH私钥
    
    支持两种方式：
    1. 私钥内容方式（存储在password_encrypted中，加密）
    2. 私钥路径方式（存储在ssh_key_path中）
    
    支持多种私钥格式：RSA, ECDSA, Ed25519, DSA
    
    Returns:
        paramiko.PKey: 私钥对象，如果失败则返回None或抛出异常
    """
    pkey = None
    last_error = None
    
    # 优先使用私钥内容方式
    if credential.password_encrypted:
        try:
            # 解密私钥内容
            private_key_content = decrypt_password(credential.password_encrypted)
            
            # 清理私钥内容：移除首尾空白，确保格式正确
            private_key_content = private_key_content.strip()
            
            # 记录私钥前几行用于调试（不记录完整内容）
            key_preview = '\n'.join(private_key_content.split('\n')[:3])
            logger.debug(f"尝试加载SSH私钥，前3行: {key_preview}")
            
            # 尝试加载不同格式的私钥
            key_file = StringIO(private_key_content)
            
            # 尝试RSA格式
            try:
                key_file.seek(0)
                pkey = paramiko.RSAKey.from_private_key(key_file)
                logger.info("成功加载RSA私钥")
                return pkey
            except Exception as e:
                last_error = f"RSA格式失败: {str(e)}"
                logger.debug(last_error)
            
            # 尝试ECDSA格式
            try:
                key_file.seek(0)
                pkey = paramiko.ECDSAKey.from_private_key(key_file)
                logger.info("成功加载ECDSA私钥")
                return pkey
            except Exception as e:
                last_error = f"ECDSA格式失败: {str(e)}"
                logger.debug(last_error)
            
            # 尝试Ed25519格式
            try:
                key_file.seek(0)
                pkey = paramiko.Ed25519Key.from_private_key(key_file)
                logger.info("成功加载Ed25519私钥")
                return pkey
            except Exception as e:
                last_error = f"Ed25519格式失败: {str(e)}"
                logger.debug(last_error)
            
            # 最后尝试DSA格式
            try:
                key_file.seek(0)
                pkey = paramiko.DSSKey.from_private_key(key_file)
                logger.info("成功加载DSA私钥")
                return pkey
            except Exception as e:
                last_error = f"DSA格式失败: {str(e)}"
                logger.debug(last_error)
                
                # 如果所有格式都失败，继续尝试路径方式
                if not credential.ssh_key_path:
                    error_detail = f"无法解析私钥内容。最后错误: {last_error}"
                    logger.error(error_detail)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_detail
                    )
        except HTTPException:
            raise
        except Exception as e:
            # 如果私钥内容方式失败，尝试私钥路径方式
            if credential.ssh_key_path:
                logger.warning(f"私钥内容方式失败: {str(e)}，尝试使用路径方式")
                pass  # 继续到路径方式处理
            else:
                error_detail = f"私钥内容解密失败: {str(e)}"
                logger.error(error_detail)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_detail
                )
    
    # 如果私钥内容方式未成功，尝试私钥路径方式
    if pkey is None and credential.ssh_key_path:
        # 展开用户目录路径（~）
        key_path = os.path.expanduser(credential.ssh_key_path)
        
        logger.info(f"尝试从路径加载私钥: {key_path}")
        
        # 检查文件是否存在
        if not os.path.exists(key_path):
            error_detail = f"私钥文件不存在: {key_path}。请确保私钥文件在后端服务器上。"
            logger.error(error_detail)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )
        
        # 检查文件权限（警告但不阻止）
        if os.stat(key_path).st_mode & 0o077:
            logger.warning(f"私钥文件权限过于宽松: {key_path}")
        
        # 尝试加载不同格式的私钥
        try:
            pkey = paramiko.RSAKey.from_private_key_file(key_path)
            logger.info("成功从路径加载RSA私钥")
            return pkey
        except Exception as e:
            last_error = f"RSA格式失败: {str(e)}"
            logger.debug(last_error)
        
        try:
            pkey = paramiko.ECDSAKey.from_private_key_file(key_path)
            logger.info("成功从路径加载ECDSA私钥")
            return pkey
        except Exception as e:
            last_error = f"ECDSA格式失败: {str(e)}"
            logger.debug(last_error)
        
        try:
            pkey = paramiko.Ed25519Key.from_private_key_file(key_path)
            logger.info("成功从路径加载Ed25519私钥")
            return pkey
        except Exception as e:
            last_error = f"Ed25519格式失败: {str(e)}"
            logger.debug(last_error)
        
        try:
            pkey = paramiko.DSSKey.from_private_key_file(key_path)
            logger.info("成功从路径加载DSA私钥")
            return pkey
        except Exception as e:
            last_error = f"DSA格式失败: {str(e)}"
            logger.error(f"无法加载私钥文件 {key_path}: {last_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无法加载私钥文件 {key_path}: {last_error}"
            )
    
    # 如果两种方式都未成功
    if pkey is None:
        error_detail = "SSH密钥认证失败：请提供私钥内容或私钥路径"
        if last_error:
            error_detail += f"。最后错误: {last_error}"
        logger.error(error_detail)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail
        )
    
    return pkey
