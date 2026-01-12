# 本地安装 PostgreSQL + TimescaleDB（Docker 替代方案）

如果 Docker 部署有问题，可以使用本地安装。

## macOS 安装步骤

### 1. 安装 Homebrew（如果未安装）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装 PostgreSQL 15

```bash
brew install postgresql@15
```

### 3. 启动 PostgreSQL

```bash
brew services start postgresql@15
```

### 4. 安装 TimescaleDB

```bash
brew install timescaledb
```

### 5. 配置 TimescaleDB

```bash
# 编辑 PostgreSQL 配置
timescaledb-tune --quiet --yes

# 或手动编辑
nano /opt/homebrew/var/postgresql@15/postgresql.conf
# 添加: shared_preload_libraries = 'timescaledb'
```

### 6. 重启 PostgreSQL

```bash
brew services restart postgresql@15
```

### 7. 创建数据库

```bash
# 创建数据库
createdb laoqin_panel

# 连接到数据库
psql laoqin_panel

# 在 psql 中执行
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

### 8. 创建用户（可选）

```bash
psql postgres
```

```sql
CREATE USER laoqin WITH PASSWORD 'password';
ALTER DATABASE laoqin_panel OWNER TO laoqin;
GRANT ALL PRIVILEGES ON DATABASE laoqin_panel TO laoqin;
\q
```

### 9. 更新 .env 配置

编辑 `backend/.env`:

```env
# 使用当前用户（默认）
DATABASE_URL=postgresql+asyncpg://$(whoami)@localhost:5432/laoqin_panel
DATABASE_SYNC_URL=postgresql://$(whoami)@localhost:5432/laoqin_panel

# 或使用创建的用户
# DATABASE_URL=postgresql+asyncpg://laoqin:password@localhost:5432/laoqin_panel
# DATABASE_SYNC_URL=postgresql://laoqin:password@localhost:5432/laoqin_panel
```

### 10. 创建 TimescaleDB 表

```bash
cd backend
psql laoqin_panel -f scripts/create_timescaledb_tables.sql
```

### 11. 初始化数据库

```bash
cd backend
source venv-panle/bin/activate
python scripts/init_db.py
```

## 安装 Redis（可选）

如果需要 Redis：

```bash
# 安装
brew install redis

# 启动
brew services start redis

# 测试
redis-cli ping
```

更新 `.env`:
```env
REDIS_URL=redis://localhost:6379/0
```

## 验证安装

```bash
# 测试 PostgreSQL 连接
psql laoqin_panel -c "SELECT version();"

# 测试 TimescaleDB
psql laoqin_panel -c "SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'timescaledb';"

# 测试 Redis（如果安装）
redis-cli ping
```

## 常用命令

```bash
# 启动 PostgreSQL
brew services start postgresql@15

# 停止 PostgreSQL
brew services stop postgresql@15

# 重启 PostgreSQL
brew services restart postgresql@15

# 查看状态
brew services list

# 查看日志
tail -f /opt/homebrew/var/log/postgresql@15.log
```

## 卸载（如果需要）

```bash
# 停止服务
brew services stop postgresql@15
brew services stop redis

# 卸载
brew uninstall postgresql@15
brew uninstall timescaledb
brew uninstall redis

# 删除数据（谨慎！）
rm -rf /opt/homebrew/var/postgresql@15
```

