#!/bin/bash

# 数据库一键初始化脚本
# 使用方法: bash scripts/init_database.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "数据库初始化脚本"
echo "=========================================="

# 检查 Docker 容器是否运行
echo ""
echo "检查 Docker 容器状态..."
if ! docker-compose ps | grep -q "laoqin_postgres.*Up"; then
    echo "❌ PostgreSQL 容器未运行，请先运行: docker-compose up -d"
    exit 1
fi

if ! docker-compose ps | grep -q "laoqin_redis.*Up"; then
    echo "⚠️  Redis 容器未运行，但可以继续"
fi

echo "✅ 容器状态正常"

# 步骤1: 测试数据库连接
echo ""
echo "=========================================="
echo "步骤1: 测试数据库连接"
echo "=========================================="

if docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ 数据库连接成功"
else
    echo "❌ 数据库连接失败"
    echo "正在等待数据库就绪..."
    sleep 5
    
    # 重试
    if docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ 数据库连接成功"
    else
        echo "❌ 数据库连接仍然失败，请检查容器日志: docker-compose logs postgres"
        exit 1
    fi
fi

# 步骤2: 启用 TimescaleDB 扩展
echo ""
echo "=========================================="
echo "步骤2: 启用 TimescaleDB 扩展"
echo "=========================================="

if docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>&1 | grep -q "ERROR"; then
    echo "⚠️  TimescaleDB 扩展可能已存在或创建失败"
    docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>&1
else
    echo "✅ TimescaleDB 扩展已启用"
fi

# 步骤3: 创建 TimescaleDB 时序表
echo ""
echo "=========================================="
echo "步骤3: 创建 TimescaleDB 时序表"
echo "=========================================="

if [ -f "scripts/create_timescaledb_tables.sql" ]; then
    echo "执行 TimescaleDB 表创建脚本..."
    if docker-compose exec -T postgres psql -U laoqin -d laoqin_panel < scripts/create_timescaledb_tables.sql 2>&1 | grep -q "ERROR"; then
        echo "⚠️  部分 TimescaleDB 表可能已存在"
    else
        echo "✅ TimescaleDB 表创建完成"
    fi
else
    echo "⚠️  未找到 create_timescaledb_tables.sql 文件，跳过"
fi

# 步骤4: 初始化业务数据表
echo ""
echo "=========================================="
echo "步骤4: 初始化业务数据表"
echo "=========================================="

# 检查虚拟环境
if [ ! -d "venv-panle" ]; then
    echo "❌ 虚拟环境不存在，请先运行: bash setup_venv.sh"
    exit 1
fi

# 激活虚拟环境
source venv-panle/bin/activate

# 检查 Python 脚本
if [ ! -f "scripts/init_db.py" ]; then
    echo "❌ 未找到 init_db.py 文件"
    exit 1
fi

echo "运行 Python 初始化脚本..."
if python scripts/init_db.py; then
    echo "✅ 业务数据表初始化完成"
else
    echo "❌ 业务数据表初始化失败"
    exit 1
fi

# 步骤5: 验证初始化结果
echo ""
echo "=========================================="
echo "步骤5: 验证初始化结果"
echo "=========================================="

echo "检查表数量..."
table_count=$(docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
echo "✅ 已创建 $table_count 个表"

echo ""
echo "检查用户..."
user_count=$(docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
echo "✅ 已创建 $user_count 个用户"

echo ""
echo "检查角色..."
role_count=$(docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -t -c "SELECT COUNT(*) FROM roles;" | tr -d ' ')
echo "✅ 已创建 $role_count 个角色"

echo ""
echo "检查 TimescaleDB 超表..."
hypertable_count=$(docker-compose exec -T postgres psql -U laoqin -d laoqin_panel -t -c "SELECT COUNT(*) FROM timescaledb_information.hypertables;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$hypertable_count" != "0" ]; then
    echo "✅ 已创建 $hypertable_count 个 TimescaleDB 超表"
else
    echo "⚠️  未找到 TimescaleDB 超表（可能已存在或创建失败）"
fi

# 显示默认账号信息
echo ""
echo "=========================================="
echo "初始化完成！"
echo "=========================================="
echo ""
echo "默认管理员账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo "  ⚠️  首次登录后请立即修改密码！"
echo ""
echo "下一步:"
echo "  1. 启动后端服务: uvicorn app.main:app --reload"
echo "  2. 访问 API 文档: http://localhost:8000/api/docs"
echo ""

