#!/bin/bash

# 修复 Docker 镜像代理配置
# 使用方法: bash 修复Docker代理.sh

echo "=========================================="
echo "修复 Docker 镜像代理配置"
echo "=========================================="

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 检查配置文件位置
CONFIG_FILE=""
if [ -f ~/.docker/daemon.json ]; then
    CONFIG_FILE=~/.docker/daemon.json
elif [ -f /etc/docker/daemon.json ]; then
    CONFIG_FILE=/etc/docker/daemon.json
    echo "⚠️  需要 sudo 权限来编辑系统配置文件"
fi

if [ -z "$CONFIG_FILE" ]; then
    echo "配置文件不存在，将创建新配置"
    mkdir -p ~/.docker
    CONFIG_FILE=~/.docker/daemon.json
fi

echo ""
echo "当前配置文件: $CONFIG_FILE"
echo ""

# 显示当前配置
if [ -f "$CONFIG_FILE" ]; then
    echo "当前配置:"
    cat "$CONFIG_FILE" | python3 -m json.tool 2>/dev/null || cat "$CONFIG_FILE"
    echo ""
fi

# 选择操作
echo "请选择操作:"
echo "1. 禁用镜像代理（使用官方源）"
echo "2. 使用国内镜像源（推荐）"
echo "3. 仅查看配置，不修改"
read -p "请输入选项 (1/2/3): " choice

case $choice in
    1)
        echo ""
        echo "禁用镜像代理..."
        cat > "$CONFIG_FILE" << EOF
{
  "registry-mirrors": []
}
EOF
        echo "✅ 配置已更新：已禁用镜像代理"
        ;;
    2)
        echo ""
        echo "配置国内镜像源..."
        cat > "$CONFIG_FILE" << EOF
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
EOF
        echo "✅ 配置已更新：已设置国内镜像源"
        ;;
    3)
        echo ""
        echo "仅查看配置，未修改"
        exit 0
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "新配置:"
cat "$CONFIG_FILE" | python3 -m json.tool 2>/dev/null || cat "$CONFIG_FILE"

echo ""
echo "=========================================="
echo "⚠️  需要重启 Docker Desktop 使配置生效"
echo "=========================================="
echo ""
echo "请执行以下步骤:"
echo "1. 退出 Docker Desktop"
echo "2. 重新启动 Docker Desktop"
echo "3. 运行: docker-compose up -d"
echo ""

