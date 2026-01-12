@echo off
REM Windows批处理脚本 - 创建Python虚拟环境
REM 使用方法: setup_venv.bat

echo ==========================================
echo Laoqin Panel - Python虚拟环境设置
echo ==========================================

REM 检查Python版本
echo 检查Python版本...
python --version

if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 创建虚拟环境
echo.
echo 创建虚拟环境 venv-panle...
python -m venv venv-panle

if %errorlevel% neq 0 (
    echo ❌ 错误: 虚拟环境创建失败
    pause
    exit /b 1
)

echo ✅ 虚拟环境创建成功

REM 激活虚拟环境
echo.
echo 激活虚拟环境...
call venv-panle\Scripts\activate.bat

REM 升级pip和构建工具
echo.
echo 升级pip和构建工具...
python -m pip install --upgrade pip setuptools wheel

REM 安装依赖
echo.
echo 安装项目依赖...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ❌ 错误: 依赖安装失败
    pause
    exit /b 1
)

echo.
echo ==========================================
echo ✅ 虚拟环境设置完成！
echo ==========================================
echo.
echo 使用方法:
echo   激活虚拟环境: venv-panle\Scripts\activate.bat
echo   退出虚拟环境: deactivate
echo.
pause

