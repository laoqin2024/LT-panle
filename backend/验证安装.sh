#!/bin/bash

# 验证虚拟环境和依赖安装
# 使用方法: bash 验证安装.sh

echo "=========================================="
echo "验证虚拟环境和依赖安装"
echo "=========================================="

# 检查虚拟环境是否存在
if [ ! -d "venv-panle" ]; then
    echo "❌ 虚拟环境不存在，请先运行 setup_venv.sh"
    exit 1
fi

# 激活虚拟环境
echo ""
echo "激活虚拟环境..."
source venv-panle/bin/activate

# 检查 Python 版本
echo ""
echo "Python 版本:"
python3 --version 2>/dev/null || python --version

# 检查 pip
echo ""
echo "pip 版本:"
pip --version

# 验证关键包
echo ""
echo "=========================================="
echo "验证关键依赖包..."
echo "=========================================="

check_package() {
    package=$1
    if python3 -c "import $package" 2>/dev/null || python -c "import $package" 2>/dev/null; then
        version=$(python3 -c "import $package; print($package.__version__)" 2>/dev/null || python -c "import $package; print($package.__version__)" 2>/dev/null)
        echo "✅ $package: $version"
        return 0
    else
        echo "❌ $package: 未安装"
        return 1
    fi
}

failed=0

check_package fastapi || failed=1
check_package uvicorn || failed=1
check_package sqlalchemy || failed=1
check_package alembic || failed=1
check_package asyncpg || failed=1
check_package psycopg2 || failed=1
check_package pydantic || failed=1
check_package redis || failed=1
check_package celery || failed=1
check_package paramiko || failed=1

echo ""
if [ $failed -eq 0 ]; then
    echo "=========================================="
    echo "✅ 所有关键依赖已正确安装！"
    echo "=========================================="
else
    echo "=========================================="
    echo "⚠️ 部分依赖未安装，请检查错误信息"
    echo "=========================================="
fi

echo ""
echo "退出虚拟环境: deactivate"

