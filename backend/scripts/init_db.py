"""
数据库初始化脚本
创建数据库和初始数据
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 在初始化数据库前，先确保密钥已生成
from app.core.key_generator import generate_and_save_keys

from sqlalchemy import text
from app.core.database import async_engine, Base
from app.core.config import settings
from app.models import *
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def init_database():
    """初始化数据库"""
    # 首先确保密钥已生成
    print("检查并生成系统密钥...")
    generate_and_save_keys()
    print()
    
    # 创建所有表
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ 数据库表创建成功")
    except Exception as e:
        print(f"⚠️  表可能已存在: {e}")
        # 继续执行，因为表可能已经存在
    
    # 创建初始数据
    from app.core.database import AsyncSessionLocal
    from app.models.user import User, Role, Permission
    
    async with AsyncSessionLocal() as session:
        # 创建默认角色
        admin_role = Role(name="admin", description="管理员")
        user_role = Role(name="user", description="普通用户")
        
        try:
            session.add(admin_role)
            session.add(user_role)
            await session.commit()
            print("✅ 默认角色创建成功")
        except Exception as e:
            await session.rollback()
            print(f"⚠️ 角色可能已存在: {e}")
        
        # 创建默认权限
        permissions = [
            Permission(name="server:create", resource="server", action="create", description="创建服务器"),
            Permission(name="server:read", resource="server", action="read", description="查看服务器"),
            Permission(name="server:update", resource="server", action="update", description="更新服务器"),
            Permission(name="server:delete", resource="server", action="delete", description="删除服务器"),
            Permission(name="device:create", resource="device", action="create", description="创建设备"),
            Permission(name="device:read", resource="device", action="read", description="查看设备"),
            Permission(name="device:update", resource="device", action="update", description="更新设备"),
            Permission(name="device:delete", resource="device", action="delete", description="删除设备"),
            Permission(name="database:create", resource="database", action="create", description="创建数据库"),
            Permission(name="database:read", resource="database", action="read", description="查看数据库"),
            Permission(name="database:update", resource="database", action="update", description="更新数据库"),
            Permission(name="database:delete", resource="database", action="delete", description="删除数据库"),
        ]
        
        try:
            for perm in permissions:
                session.add(perm)
            await session.commit()
            print("✅ 默认权限创建成功")
        except Exception as e:
            await session.rollback()
            print(f"⚠️ 权限可能已存在: {e}")
        
        # 创建默认管理员用户
        admin_user = User(
            username="admin",
            email="admin@example.com",
            password_hash=pwd_context.hash("admin123"),  # 默认密码，首次登录后应修改
            full_name="系统管理员",
            role_id=1,  # admin角色
            is_active=True,
            is_superuser=True,
        )
        
        try:
            session.add(admin_user)
            await session.commit()
            print("✅ 默认管理员用户创建成功")
            print("   用户名: admin")
            print("   密码: admin123")
            print("   ⚠️ 请首次登录后立即修改密码！")
        except Exception as e:
            await session.rollback()
            print(f"⚠️ 管理员用户可能已存在: {e}")


if __name__ == "__main__":
    print("开始初始化数据库...")
    asyncio.run(init_database())
    print("数据库初始化完成！")

