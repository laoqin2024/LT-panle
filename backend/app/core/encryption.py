"""
凭据加密工具模块
使用Fernet（基于AES-128）进行对称加密
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
from app.core.config import settings


def get_encryption_key() -> bytes:
    """
    从配置获取加密密钥并转换为Fernet格式
    
    Fernet需要32字节的URL-safe base64编码密钥
    如果ENCRYPTION_KEY不是Fernet格式，则使用PBKDF2派生
    """
    encryption_key = settings.ENCRYPTION_KEY
    
    try:
        # 尝试直接使用（如果已经是Fernet格式）
        return encryption_key.encode()
    except Exception:
        # 如果不是Fernet格式，使用PBKDF2派生
        # 将字符串转换为字节
        key_material = encryption_key.encode()
        # 使用PBKDF2派生32字节密钥
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'laoqin_panel_salt',  # 固定盐值（生产环境应使用随机盐）
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(key_material))
        return key


def get_cipher() -> Fernet:
    """获取Fernet加密器实例"""
    key = get_encryption_key()
    return Fernet(key)


def encrypt_password(password: str) -> str:
    """
    加密密码
    
    Args:
        password: 明文密码
    
    Returns:
        加密后的密码（base64编码字符串）
    """
    try:
        cipher = get_cipher()
        encrypted = cipher.encrypt(password.encode('utf-8'))
        return encrypted.decode('utf-8')
    except Exception as e:
        raise ValueError(f"密码加密失败: {str(e)}")


def decrypt_password(encrypted_password: str) -> str:
    """
    解密密码
    
    Args:
        encrypted_password: 加密后的密码（base64编码字符串）
    
    Returns:
        明文密码
    """
    try:
        cipher = get_cipher()
        decrypted = cipher.decrypt(encrypted_password.encode('utf-8'))
        return decrypted.decode('utf-8')
    except Exception as e:
        raise ValueError(f"密码解密失败: {str(e)}")
