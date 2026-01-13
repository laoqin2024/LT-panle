"""
密钥生成工具
用于在系统初始化时自动生成安全的密钥
"""
import secrets
import os
from pathlib import Path
from typing import Optional


def generate_secret_key(length: int = 64) -> str:
    """
    生成安全的密钥
    
    Args:
        length: 密钥长度（字节），默认64字节（512位）
    
    Returns:
        十六进制字符串格式的密钥
    """
    # 使用secrets模块生成加密安全的随机字节
    # 转换为十六进制字符串，长度为 length * 2
    return secrets.token_hex(length)


def generate_encryption_key(length: int = 32) -> str:
    """
    生成Fernet加密密钥（URL-safe base64编码）
    
    Args:
        length: 密钥长度（字节），默认32字节（256位）
    
    Returns:
        URL-safe Base64编码的密钥字符串（Fernet格式）
    """
    import base64
    # 生成随机字节
    key_bytes = secrets.token_bytes(length)
    # 转换为URL-safe Base64编码（Fernet要求）
    return base64.urlsafe_b64encode(key_bytes).decode('utf-8')


def ensure_env_file(env_path: Optional[Path] = None) -> Path:
    """
    确保.env文件存在，如果不存在则创建
    
    Args:
        env_path: .env文件路径，默认为项目根目录下的.env
    
    Returns:
        .env文件路径
    """
    if env_path is None:
        # 获取项目根目录（backend目录）
        project_root = Path(__file__).parent.parent
        env_path = project_root / ".env"
    
    # 如果文件不存在，创建空文件
    if not env_path.exists():
        env_path.touch()
        print(f"✅ 创建 .env 文件: {env_path}")
    
    return env_path


def read_env_value(env_path: Path, key: str) -> Optional[str]:
    """
    从.env文件读取指定键的值
    
    Args:
        env_path: .env文件路径
        key: 键名
    
    Returns:
        值，如果不存在返回None
    """
    if not env_path.exists():
        return None
    
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            
            # 解析 KEY=VALUE 格式
            if '=' in line:
                env_key, env_value = line.split('=', 1)
                env_key = env_key.strip()
                env_value = env_value.strip()
                
                # 移除引号
                if env_value.startswith('"') and env_value.endswith('"'):
                    env_value = env_value[1:-1]
                elif env_value.startswith("'") and env_value.endswith("'"):
                    env_value = env_value[1:-1]
                
                if env_key == key:
                    return env_value
    
    return None


def write_env_value(env_path: Path, key: str, value: str, comment: Optional[str] = None):
    """
    写入或更新.env文件中的键值对
    
    Args:
        env_path: .env文件路径
        key: 键名
        value: 值
        comment: 可选的注释
    """
    # 读取现有内容
    lines = []
    key_found = False
    
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    
    # 查找并更新现有键
    new_lines = []
    for line in lines:
        stripped = line.strip()
        # 检查是否是目标键
        if stripped and not stripped.startswith('#') and '=' in stripped:
            env_key = stripped.split('=', 1)[0].strip()
            if env_key == key:
                # 更新现有键
                comment_part = f"  # {comment}" if comment else ""
                new_lines.append(f"{key}={value}{comment_part}\n")
                key_found = True
                continue
        
        new_lines.append(line)
    
    # 如果键不存在，添加到文件末尾
    if not key_found:
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        comment_part = f"  # {comment}" if comment else ""
        new_lines.append(f"{key}={value}{comment_part}\n")
    
    # 写入文件
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)


def generate_and_save_keys(
    env_path: Optional[Path] = None,
    force_regenerate: bool = False
) -> dict:
    """
    生成并保存密钥到.env文件
    
    Args:
        env_path: .env文件路径，默认为项目根目录下的.env
        force_regenerate: 是否强制重新生成（即使已存在）
    
    Returns:
        包含生成的密钥的字典
    """
    # 确保.env文件存在
    env_file = ensure_env_file(env_path)
    
    keys = {}
    
    # 生成或读取 SECRET_KEY
    secret_key = read_env_value(env_file, "SECRET_KEY")
    if not secret_key or force_regenerate or secret_key == "your-secret-key-change-in-production":
        secret_key = generate_secret_key(64)  # 512位密钥
        write_env_value(
            env_file,
            "SECRET_KEY",
            secret_key,
            "JWT签名密钥，系统自动生成"
        )
        keys['SECRET_KEY'] = secret_key
        print("✅ 生成并保存 SECRET_KEY")
    else:
        keys['SECRET_KEY'] = secret_key
        print("ℹ️  使用现有的 SECRET_KEY")
    
    # 生成或读取 ENCRYPTION_KEY
    encryption_key = read_env_value(env_file, "ENCRYPTION_KEY")
    if not encryption_key or force_regenerate or encryption_key == "your-encryption-key-change-in-production":
        encryption_key = generate_encryption_key(32)  # 256位密钥
        write_env_value(
            env_file,
            "ENCRYPTION_KEY",
            encryption_key,
            "AES加密密钥，用于加密敏感数据，系统自动生成"
        )
        keys['ENCRYPTION_KEY'] = encryption_key
        print("✅ 生成并保存 ENCRYPTION_KEY")
    else:
        keys['ENCRYPTION_KEY'] = encryption_key
        print("ℹ️  使用现有的 ENCRYPTION_KEY")
    
    return keys


if __name__ == "__main__":
    """
    直接运行此脚本可以生成密钥
    """
    print("=" * 50)
    print("密钥生成工具")
    print("=" * 50)
    
    import sys
    force = "--force" in sys.argv or "-f" in sys.argv
    
    keys = generate_and_save_keys(force_regenerate=force)
    
    print("\n" + "=" * 50)
    print("密钥生成完成！")
    print("=" * 50)
    print(f"\n生成的密钥已保存到 .env 文件")
    print(f"SECRET_KEY 长度: {len(keys['SECRET_KEY'])} 字符")
    print(f"ENCRYPTION_KEY 长度: {len(keys['ENCRYPTION_KEY'])} 字符")
    print("\n⚠️  请妥善保管 .env 文件，不要提交到版本控制系统！")

