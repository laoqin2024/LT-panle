@echo off
REM 业务站点模块功能扩展 - 数据库迁移执行脚本 (Windows)
REM 使用方法: scripts\run_site_migration.bat

setlocal enabledelayedexpansion

echo ========================================
echo 业务站点模块数据库迁移脚本
echo ========================================
echo.

REM 检查是否在backend目录
if not exist "alembic.ini" (
    echo 错误: 请在backend目录下执行此脚本
    exit /b 1
)

REM 检查SQL文件是否存在
set SQL_FILE=scripts\add_site_features.sql
if not exist "%SQL_FILE%" (
    echo 错误: 找不到SQL文件 %SQL_FILE%
    exit /b 1
)

REM 尝试使用Docker Compose方式
docker-compose ps postgres 2>nul | findstr /C:"Up" >nul
if %errorlevel% equ 0 (
    echo 检测到Docker Compose环境
    echo 使用Docker Compose执行迁移...
    echo.
    
    docker-compose exec -T postgres psql -U laoqin -d laoqin_panel < "%SQL_FILE%"
    
    if %errorlevel% equ 0 (
        echo.
        echo [成功] 迁移执行成功！
    ) else (
        echo.
        echo [错误] 迁移执行失败！
        exit /b 1
    )
) else (
    REM 尝试直接使用psql
    echo 未检测到Docker Compose环境，尝试使用本地PostgreSQL
    echo.
    
    REM 从环境变量获取数据库连接信息
    if "%DB_HOST%"=="" set DB_HOST=localhost
    if "%DB_PORT%"=="" set DB_PORT=5432
    if "%DB_USER%"=="" set DB_USER=laoqin
    if "%DB_NAME%"=="" set DB_NAME=laoqin_panel
    
    echo 数据库连接信息:
    echo   主机: %DB_HOST%
    echo   端口: %DB_PORT%
    echo   用户: %DB_USER%
    echo   数据库: %DB_NAME%
    echo.
    
    REM 检查psql是否可用
    where psql >nul 2>&1
    if %errorlevel% neq 0 (
        echo 错误: 未找到psql命令，请安装PostgreSQL客户端
        echo 或者使用Docker Compose方式执行迁移
        exit /b 1
    )
    
    REM 执行SQL文件
    echo 执行迁移...
    set PGPASSWORD=%DB_PASSWORD%
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SQL_FILE%"
    
    if %errorlevel% equ 0 (
        echo.
        echo [成功] 迁移执行成功！
    ) else (
        echo.
        echo [错误] 迁移执行失败！
        echo.
        echo 提示:
        echo 1. 确保PostgreSQL服务正在运行
        echo 2. 检查数据库连接信息是否正确
        echo 3. 确保用户有足够的权限
        echo 4. 或者使用Docker Compose方式:
        echo    docker-compose exec -T postgres psql -U laoqin -d laoqin_panel ^< scripts\add_site_features.sql
        exit /b 1
    )
)

echo.
echo 迁移完成！
echo.
echo 新增的字段:
echo   - check_interval: 检查间隔（秒）
echo   - check_timeout: 检查超时时间（秒）
echo   - check_config: 其他检查配置（JSON）
echo   - is_maintenance: 是否处于维护模式
echo   - maintenance_start: 维护开始时间
echo   - maintenance_end: 维护结束时间
echo   - maintenance_note: 维护说明
echo   - health_score: 健康度评分（0-100）
echo   - health_score_updated_at: 健康度评分更新时间

pause
