# Laoqin Panel 后端项目

## 快速开始

### 1. 创建虚拟环境（推荐）

#### Linux/macOS
```bash
cd backend
bash setup_venv.sh
```

#### Windows
```cmd
cd backend
setup_venv.bat
```

#### 手动创建
```bash
cd backend
python3 -m venv venv-panle
source venv-panle/bin/activate  # Linux/macOS
# 或
venv-panle\Scripts\activate.bat  # Windows
pip install -r requirements.txt
```

### 2. 激活虚拟环境

```bash
# Linux/macOS
source venv-panle/bin/activate

# Windows
venv-panle\Scripts\activate.bat
```

### 3. 安装依赖（如果未使用脚本）

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

### 3. 创建数据库

```bash
# 使用PostgreSQL客户端创建数据库
createdb laoqin_panel

# 或者使用psql
psql -U postgres
CREATE DATABASE laoqin_panel;
```

### 4. 启用TimescaleDB扩展

```bash
# 连接到数据库
psql -U laoqin -d laoqin_panel

# 执行TimescaleDB表创建脚本
\i scripts/create_timescaledb_tables.sql
```

### 5. 初始化数据库

```bash
# 运行初始化脚本
python scripts/init_db.py
```

### 6. 运行数据库迁移（可选）

```bash
# 初始化Alembic
alembic init alembic

# 创建初始迁移
alembic revision --autogenerate -m "Initial migration"

# 执行迁移
alembic upgrade head
```

### 7. 启动服务

```bash
# 开发模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── core/                # 核心模块
│   │   ├── config.py        # 配置管理
│   │   ├── database.py      # 数据库连接
│   │   └── security.py      # 安全相关（JWT、加密）
│   ├── models/              # 数据模型
│   │   ├── user.py          # 用户模型
│   │   ├── server.py        # 服务器模型
│   │   ├── device.py        # 设备模型
│   │   ├── database.py      # 数据库模型
│   │   ├── site.py          # 站点模型
│   │   ├── credential.py    # 凭据模型
│   │   ├── backup.py        # 备份模型
│   │   └── system.py        # 系统模型
│   ├── api/                 # API路由
│   │   ├── auth.py          # 认证API
│   │   ├── servers.py       # 服务器API
│   │   ├── devices.py       # 设备API
│   │   └── ...
│   ├── services/            # 业务逻辑
│   │   ├── ssh_service.py   # SSH服务
│   │   ├── snmp_service.py  # SNMP服务
│   │   └── ...
│   └── utils/               # 工具函数
├── alembic/                 # 数据库迁移
├── scripts/                 # 脚本
│   ├── init_db.py          # 数据库初始化
│   └── create_timescaledb_tables.sql
├── requirements.txt
└── .env.example
```

## 数据库表结构

### 核心表
- `users` - 用户表
- `roles` - 角色表
- `permissions` - 权限表
- `user_sessions` - 用户会话表

### 业务表
- `business_groups` - 业务分组表
- `business_sites` - 业务站点表
- `servers` - 服务器表
- `network_devices` - 网络设备表
- `device_interfaces` - 设备接口表
- `device_vlans` - 设备VLAN表
- `device_configs` - 设备配置备份表
- `databases` - 数据库表
- `database_backups` - 数据库备份表
- `applications` - 应用表

### 凭据表
- `credentials` - 凭据表
- `credential_permissions` - 凭据权限表
- `credential_access_logs` - 凭据访问日志表
- `credential_history` - 凭据历史表

### 系统表
- `backups` - 备份记录表
- `restores` - 恢复记录表
- `operation_logs` - 操作日志表
- `notifications` - 通知表
- `settings` - 系统设置表

### 时序数据表（TimescaleDB）
- `server_metrics` - 服务器监控指标
- `device_metrics` - 设备监控指标
- `site_availability` - 站点可用性记录
- `database_metrics` - 数据库监控指标

## 默认账号

初始化后会创建默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`
- ⚠️ 请首次登录后立即修改密码！

## API文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

