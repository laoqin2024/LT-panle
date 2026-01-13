"""
凭据加密工具模块
使用Fernet（基于AES-128）进行对称加密
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import binascii
from app.core.config import settings


def get_encryption_key() -> bytes:
    """
    从配置获取加密密钥并转换为Fernet格式
    
    Fernet需要32字节的URL-safe base64编码密钥
    如果ENCRYPTION_KEY不是Fernet格式，则使用PBKDF2派生
    """
    encryption_key = settings.ENCRYPTION_KEY
    
    # 如果密钥为空或默认值，使用PBKDF2派生
    if not encryption_key or encryption_key == "your-encryption-key-change-in-production":
        # 使用默认密钥材料派生
        key_material = b"laoqin_panel_default_key_material"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'laoqin_panel_salt',
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(kdf.derive(key_material))
        return key
    
    try:
        # 尝试直接使用（如果已经是Fernet格式的URL-safe base64）
        # 先尝试解码验证格式
        decoded = base64.urlsafe_b64decode(encryption_key)
        if len(decoded) == 32:
            # 格式正确，直接返回
            return encryption_key.encode('utf-8')
        else:
            # 长度不对，使用PBKDF2派生
            raise ValueError("密钥长度不正确")
    except (ValueError, binascii.Error):
        # 如果不是URL-safe base64格式，使用PBKDF2派生
        try:
            # 将字符串转换为字节
            key_material = encryption_key.encode('utf-8')
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
        except Exception as e:
            # 如果派生也失败，使用默认密钥
            print(f"警告: 无法处理ENCRYPTION_KEY，使用默认派生密钥: {e}")
            key_material = b"laoqin_panel_default_key_material"
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'laoqin_panel_salt',
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
