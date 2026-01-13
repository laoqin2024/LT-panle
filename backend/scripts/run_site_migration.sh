#!/bin/bash

# 业务站点模块功能扩展 - 数据库迁移执行脚本
# 使用方法: ./scripts/run_site_migration.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}业务站点模块数据库迁移脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否在backend目录
if [ ! -f "alembic.ini" ]; then
    echo -e "${RED}错误: 请在backend目录下执行此脚本${NC}"
    exit 1
fi

# 检查SQL文件是否存在
SQL_FILE="scripts/add_site_features.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}错误: 找不到SQL文件 $SQL_FILE${NC}"
    exit 1
fi

# 尝试从环境变量或配置文件获取数据库连接信息
# 优先使用Docker Compose方式
if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
    echo -e "${YELLOW}检测到Docker Compose环境${NC}"
    echo "使用Docker Compose执行迁移..."
    
    docker-compose exec -T postgres psql -U laoqin -d laoqin_panel < "$SQL_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 迁移执行成功！${NC}"
    else
        echo -e "${RED}✗ 迁移执行失败！${NC}"
        exit 1
    fi
else
    # 尝试直接使用psql（需要配置环境变量）
    echo -e "${YELLOW}未检测到Docker Compose环境，尝试使用本地PostgreSQL${NC}"
    
    # 从环境变量获取数据库连接信息
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_USER="${DB_USER:-laoqin}"
    DB_NAME="${DB_NAME:-laoqin_panel}"
    
    echo "数据库连接信息:"
    echo "  主机: $DB_HOST"
    echo "  端口: $DB_PORT"
    echo "  用户: $DB_USER"
    echo "  数据库: $DB_NAME"
    echo ""
    
    # 检查psql是否可用
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}错误: 未找到psql命令，请安装PostgreSQL客户端${NC}"
        echo "或者使用Docker Compose方式执行迁移"
        exit 1
    fi
    
    # 执行SQL文件
    echo "执行迁移..."
    PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 迁移执行成功！${NC}"
    else
        echo -e "${RED}✗ 迁移执行失败！${NC}"
        echo ""
        echo "提示："
        echo "1. 确保PostgreSQL服务正在运行"
        echo "2. 检查数据库连接信息是否正确"
        echo "3. 确保用户有足够的权限"
        echo "4. 或者使用Docker Compose方式："
        echo "   docker-compose exec -T postgres psql -U laoqin -d laoqin_panel < scripts/add_site_features.sql"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}迁移完成！${NC}"
echo ""
echo "新增的字段："
echo "  - check_interval: 检查间隔（秒）"
echo "  - check_timeout: 检查超时时间（秒）"
echo "  - check_config: 其他检查配置（JSON）"
echo "  - is_maintenance: 是否处于维护模式"
echo "  - maintenance_start: 维护开始时间"
echo "  - maintenance_end: 维护结束时间"
echo "  - maintenance_note: 维护说明"
echo "  - health_score: 健康度评分（0-100）"
echo "  - health_score_updated_at: 健康度评分更新时间"
