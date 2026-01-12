#!/bin/bash

# 后端服务启动脚本
# 自动处理端口占用问题

set -e

PORT=${1:-8000}  # 默认8000端口，可以通过参数指定

echo "=========================================="
echo "启动 Laoqin Panel 后端服务"
echo "=========================================="

# 检查虚拟环境
if [ ! -d "venv-panle" ]; then
    echo "❌ 虚拟环境不存在，请先运行: bash setup_venv.sh"
    exit 1
fi

# 激活虚拟环境
source venv-panle/bin/activate

# 检查端口占用
echo ""
echo "检查端口 $PORT 占用情况..."
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "⚠️  端口 $PORT 已被占用"
    echo ""
    echo "占用端口的进程:"
    lsof -i :$PORT
    echo ""
    read -p "是否停止占用端口的进程？(y/n): " answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        echo "停止进程..."
        PIDS=$(lsof -ti :$PORT)
        if [ -n "$PIDS" ]; then
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
            sleep 2
            echo "✅ 进程已停止"
        else
            echo "⚠️  未找到进程"
        fi
    else
        echo "请手动停止进程或使用其他端口"
        echo "示例: bash scripts/start_server.sh 8001"
        exit 1
    fi
else
    echo "✅ 端口 $PORT 可用"
fi

# 检查环境变量
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  未找到 .env 文件，使用默认配置"
    echo "建议: cp .env.example .env 并配置"
fi

# 启动服务
echo ""
echo "=========================================="
echo "启动服务在端口 $PORT..."
echo "=========================================="
echo ""
echo "API文档:"
echo "  Swagger UI: http://localhost:$PORT/api/docs"
echo "  ReDoc: http://localhost:$PORT/api/redoc"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port $PORT

