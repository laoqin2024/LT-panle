# Docker 容器部署问题解决方案

## 问题分析

### 错误信息
```
Error response from daemon: failed to resolve reference "docker.io/library/redis:7-alpine"
connecting to 127.0.0.1:10808: dial tcp 127.0.0.1:10808: connect: connection refused
```

### 原因
1. **Docker 镜像代理配置问题**
   - Docker 配置了 daocloud.io 镜像代理
   - 代理服务器（127.0.0.1:10808）连接失败
   - 可能是代理服务未启动或配置错误

2. **docker-compose.yml 版本警告**
   - `version: '3.8'` 在新版 Docker Compose 中已过时

---

## 解决方案

### 方案1: 修复 Docker 镜像代理（推荐）

#### 检查 Docker 代理配置

```bash
# 查看 Docker 配置
cat ~/.docker/daemon.json
# 或
cat /etc/docker/daemon.json
```

#### 修复代理配置

**选项A: 禁用代理（如果不需要）**

编辑 Docker 配置文件：
```bash
# macOS
sudo nano ~/.docker/daemon.json

# 删除或注释掉 registry-mirrors 配置
# 或者设置为空数组
{
  "registry-mirrors": []
}
```

然后重启 Docker Desktop。

**选项B: 修复代理地址**

如果确实需要代理，检查代理服务是否运行：
```bash
# 检查代理服务
lsof -i :10808
# 或
netstat -an | grep 10808
```

如果代理未运行，启动代理服务或更新代理地址。

**选项C: 使用其他镜像源**

编辑 `~/.docker/daemon.json`：
```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

重启 Docker Desktop。

### 方案2: 直接使用官方镜像源（临时解决）

临时禁用代理，直接拉取镜像：

```bash
# 方法1: 临时设置环境变量
export DOCKER_BUILDKIT=0
docker-compose pull

# 方法2: 直接拉取镜像
docker pull timescale/timescaledb:latest-pg15
docker pull redis:7-alpine

# 然后启动
docker-compose up -d
```

### 方案3: 使用国内镜像源拉取

如果网络问题，可以手动指定镜像源：

```bash
# 使用阿里云镜像（如果有账号）
docker pull registry.cn-hangzhou.aliyuncs.com/timescale/timescaledb:latest-pg15
docker pull registry.cn-hangzhou.aliyuncs.com/library/redis:7-alpine

# 重命名标签
docker tag registry.cn-hangzhou.aliyuncs.com/timescale/timescaledb:latest-pg15 timescale/timescaledb:latest-pg15
docker tag registry.cn-hangzhou.aliyuncs.com/library/redis:7-alpine redis:7-alpine
```

---

## 已修复的问题

### ✅ docker-compose.yml

已移除过时的 `version: '3.8'` 属性。

---

## 快速解决步骤

### 步骤1: 检查 Docker 配置

```bash
# 查看当前配置
cat ~/.docker/daemon.json 2>/dev/null || echo "配置文件不存在"
```

### 步骤2: 修复配置

**如果不需要代理**，创建或编辑配置文件：

```bash
# macOS
mkdir -p ~/.docker
cat > ~/.docker/daemon.json << EOF
{
  "registry-mirrors": []
}
EOF
```

**如果需要使用国内镜像源**：

```bash
cat > ~/.docker/daemon.json << EOF
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
```

### 步骤3: 重启 Docker Desktop

在 macOS 上：
1. 点击 Docker Desktop 图标
2. 选择 "Quit Docker Desktop"
3. 重新启动 Docker Desktop

### 步骤4: 测试连接

```bash
# 测试拉取镜像
docker pull hello-world

# 如果成功，继续拉取项目镜像
docker pull timescale/timescaledb:latest-pg15
docker pull redis:7-alpine
```

### 步骤5: 启动服务

```bash
cd backend
docker-compose up -d
```

---

## 验证部署

### 检查容器状态

```bash
docker-compose ps
```

应该看到：
```
NAME              STATUS
laoqin_postgres   Up
laoqin_redis      Up
```

### 检查日志

```bash
# 查看所有日志
docker-compose logs

# 查看特定服务日志
docker-compose logs postgres
docker-compose logs redis
```

### 测试连接

```bash
# 测试 PostgreSQL
docker-compose exec postgres psql -U laoqin -d laoqin_panel -c "SELECT version();"

# 测试 Redis
docker-compose exec redis redis-cli ping
```

---

## 如果仍然无法连接

### 检查网络连接

```bash
# 测试 Docker Hub 连接
curl -I https://hub.docker.com

# 测试镜像拉取
docker pull hello-world
```

### 使用 VPN 或代理

如果在中国大陆，可能需要：
1. 使用 VPN
2. 配置系统代理
3. 使用国内镜像源

### 手动下载镜像

如果网络问题持续，可以：
1. 在其他网络环境下载镜像
2. 导出镜像：`docker save -o image.tar image:tag`
3. 导入镜像：`docker load -i image.tar`

---

## 替代方案：本地安装 PostgreSQL

如果 Docker 问题无法解决，可以本地安装：

### macOS (使用 Homebrew)

```bash
# 安装 PostgreSQL
brew install postgresql@15

# 安装 TimescaleDB
brew install timescaledb

# 启动服务
brew services start postgresql@15

# 创建数据库
createdb laoqin_panel

# 启用 TimescaleDB
psql -d laoqin_panel -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### 配置连接

更新 `.env` 文件：
```env
DATABASE_URL=postgresql+asyncpg://$(whoami)@localhost:5432/laoqin_panel
DATABASE_SYNC_URL=postgresql://$(whoami)@localhost:5432/laoqin_panel
```

---

## 总结

主要问题：
1. ✅ Docker 镜像代理配置错误（已提供解决方案）
2. ✅ docker-compose.yml version 警告（已修复）

推荐操作：
1. 检查并修复 Docker 代理配置
2. 重启 Docker Desktop
3. 重新运行 `docker-compose up -d`

如果 Docker 问题持续，可以考虑本地安装 PostgreSQL。

