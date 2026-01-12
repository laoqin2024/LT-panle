"""
修复管理员密码哈希
重新生成正确的密码哈希
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User


async def fix_admin_password():
    """修复管理员密码"""
    async with AsyncSessionLocal() as session:
        # 查询管理员用户
        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print("❌ 未找到管理员用户")
            return
        
        # 重新生成密码哈希
        new_hash = get_password_hash("admin123")
        print(f"旧哈希长度: {len(user.password_hash)}")
        print(f"新哈希长度: {len(new_hash)}")
        print(f"新哈希: {new_hash[:30]}...")
        
        # 更新密码哈希
        user.password_hash = new_hash
        await session.commit()
        await session.refresh(user)
        
        print("✅ 管理员密码哈希已更新")
        print(f"   用户名: {user.username}")
        print(f"   新密码哈希: {user.password_hash[:30]}...")


if __name__ == "__main__":
    print("开始修复管理员密码...")
    asyncio.run(fix_admin_password())
    print("修复完成！")

