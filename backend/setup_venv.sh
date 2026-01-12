#!/bin/bash

# 创建Python虚拟环境脚本
# 使用方法: bash setup_venv.sh

echo "=========================================="
echo "Laoqin Panel - Python虚拟环境设置"
echo "=========================================="

# 检查Python版本
echo "检查Python版本..."
python3 --version

if [ $? -ne 0 ]; then
    echo "❌ 错误: 未找到Python3，请先安装Python 3.8+"
    exit 1
fi

# 创建虚拟环境
echo ""
echo "创建虚拟环境 venv-panle..."
python3 -m venv venv-panle

if [ $? -ne 0 ]; then
    echo "❌ 错误: 虚拟环境创建失败"
    exit 1
fi

echo "✅ 虚拟环境创建成功"

# 激活虚拟环境
echo ""
echo "激活虚拟环境..."
source venv-panle/bin/activate

# 升级pip和构建工具
echo ""
echo "升级pip和构建工具..."
pip install --upgrade pip setuptools wheel

# 安装依赖
echo ""
echo "安装项目依赖..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ 错误: 依赖安装失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 虚拟环境设置完成！"
echo "=========================================="
echo ""
echo "使用方法:"
echo "  激活虚拟环境: source venv-panle/bin/activate"
echo "  退出虚拟环境: deactivate"
echo ""

