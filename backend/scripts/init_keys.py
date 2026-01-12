"""
系统初始化脚本 - 密钥生成
在系统部署时自动生成并保存密钥到.env文件
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core.key_generator import generate_and_save_keys


def main():
    """主函数"""
    print("=" * 60)
    print("系统密钥初始化")
    print("=" * 60)
    print()
    
    # 检查是否强制重新生成
    force = "--force" in sys.argv or "-f" in sys.argv
    
    if force:
        print("⚠️  强制重新生成所有密钥...")
        print()
    
    # 生成并保存密钥
    keys = generate_and_save_keys(force_regenerate=force)
    
    print()
    print("=" * 60)
    print("✅ 密钥初始化完成！")
    print("=" * 60)
    print()
    print("生成的密钥已保存到 .env 文件")
    print()
    print("⚠️  重要提示：")
    print("   1. .env 文件包含敏感信息，请勿提交到版本控制系统")
    print("   2. 生产环境部署时，请确保 .env 文件权限设置正确（建议 600）")
    print("   3. 如果密钥泄露，请立即重新生成并更新所有相关配置")
    print()


if __name__ == "__main__":
    main()

