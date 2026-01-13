# SSH终端和信息采集功能说明

## 功能概述

本次更新完善了SSH终端功能和服务器信息采集功能，解决了WebSocket连接问题，并添加了服务器信息自动采集能力。

## 一、SSH终端功能

### 1.1 功能特点

- ✅ 完整的终端交互（输入/输出）
- ✅ 支持所有标准终端命令
- ✅ 支持颜色和格式输出
- ✅ 支持链接点击（WebLinks插件）
- ✅ 自动调整终端大小
- ✅ 深色主题界面
- ✅ 连接状态指示
- ✅ 错误提示和调试信息

### 1.2 使用方法

1. 进入服务器详情页
2. 切换到 "SSH终端" 标签页
3. 选择SSH凭据（必须选择）
4. 点击 "连接" 按钮
5. 终端会自动连接并显示服务器命令行界面
6. 可以正常使用所有Linux/Unix命令

### 1.3 WebSocket连接说明

**连接URL格式：**
```
ws://localhost:8000/api/servers/{server_id}/ssh/terminal?credential_id={credential_id}&token={token}
```

**消息格式：**

**客户端 → 服务器：**
```json
{
  "type": "input",      // 用户输入
  "data": "命令或字符"
}

{
  "type": "resize",     // 调整终端大小
  "rows": 24,
  "cols": 80
}

{
  "type": "close"       // 关闭连接
}
```

**服务器 → 客户端：**
```json
{
  "type": "connected",  // 连接成功
  "message": "SSH终端已连接"
}

{
  "type": "output",     // SSH输出
  "data": "命令输出内容"
}

{
  "type": "error",      // 错误信息
  "message": "错误描述"
}
```

### 1.4 故障排除

**问题1：点击连接按钮没有任何反应**

**可能原因：**
- WebSocket URL构建错误
- 后端服务未运行
- Token无效或过期
- 凭据未选择

**解决方法：**
1. 打开浏览器开发者工具（F12），查看Console标签页
2. 检查是否有WebSocket连接错误
3. 确认后端服务运行在正确的端口（默认8000）
4. 确认已选择凭据
5. 检查Token是否有效

**问题2：WebSocket连接失败**

**错误信息：**
```
WebSocket连接失败，请检查:
1. 后端服务是否运行在 localhost:8000
2. WebSocket URL: ws://...
```

**解决方法：**
1. 确认后端服务正在运行：`cd backend && python -m uvicorn app.main:app --reload`
2. 检查防火墙设置
3. 如果使用HTTPS，WebSocket会自动使用WSS协议
4. 检查CORS配置是否正确

**问题3：终端显示连接但无法输入**

**解决方法：**
1. 检查SSH连接是否成功建立
2. 查看后端日志，确认SSH连接状态
3. 尝试断开后重新连接

## 二、服务器信息采集功能

### 2.1 功能特点

- ✅ 通过SSH连接自动采集服务器信息
- ✅ 采集CPU信息（型号、核心数、使用率）
- ✅ 采集内存信息（总量、使用量、使用率）
- ✅ 采集磁盘信息（各分区使用情况）
- ✅ 采集网络信息（各网卡流量统计）
- ✅ 采集操作系统信息（发行版、内核版本、架构）
- ✅ 采集系统运行时间和负载平均值
- ✅ 自动更新服务器状态和OS信息到数据库

### 2.2 使用方法

**方法1：在监控标签页采集**

1. 进入服务器详情页
2. 切换到 "监控" 标签页
3. 在页面顶部的 "服务器信息采集" 卡片中：
   - 选择SSH凭据
   - 点击 "采集信息" 按钮
4. 等待采集完成（会显示加载动画）
5. 采集完成后，监控数据会自动更新

**方法2：通过API直接调用**

```bash
POST /api/servers/{server_id}/collect-info?credential_id={credential_id}
```

**响应示例：**
```json
{
  "server_id": 1,
  "collected_at": "now",
  "info": {
    "cpu": {
      "model": "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
      "cores": 8,
      "threads": 16,
      "usage": 25.5
    },
    "memory": {
      "total": 17179869184,
      "used": 8589934592,
      "free": 8589934592,
      "cached": 2147483648,
      "buffers": 1073741824,
      "usage_percent": 50.0
    },
    "disk": {
      "disks": [
        {
          "filesystem": "/dev/sda1",
          "size": 107374182400,
          "used": 53687091200,
          "available": 53687091200,
          "usage_percent": 50,
          "mount_point": "/"
        }
      ]
    },
    "network": {
      "interfaces": [
        {
          "name": "eth0",
          "rx_bytes": 1073741824,
          "tx_bytes": 536870912,
          "rx_packets": 1000000,
          "tx_packets": 500000
        }
      ]
    },
    "os": {
      "name": "Ubuntu/Debian",
      "version": "20.04",
      "kernel": "5.4.0",
      "architecture": "x86_64"
    },
    "uptime": "2024-01-01 00:00:00",
    "load_average": {
      "1min": 0.5,
      "5min": 0.6,
      "15min": 0.7
    }
  }
}
```

### 2.3 采集的信息说明

**CPU信息：**
- `model`: CPU型号
- `cores`: CPU核心数
- `threads`: CPU线程数
- `usage`: CPU使用率（百分比）

**内存信息：**
- `total`: 总内存（字节）
- `used`: 已使用内存（字节）
- `free`: 空闲内存（字节）
- `cached`: 缓存内存（字节）
- `buffers`: 缓冲区内存（字节）
- `usage_percent`: 内存使用率（百分比）

**磁盘信息：**
- `disks`: 磁盘分区数组
  - `filesystem`: 文件系统
  - `size`: 总大小（字节）
  - `used`: 已使用（字节）
  - `available`: 可用空间（字节）
  - `usage_percent`: 使用率（百分比）
  - `mount_point`: 挂载点

**网络信息：**
- `interfaces`: 网络接口数组
  - `name`: 接口名称
  - `rx_bytes`: 接收字节数
  - `tx_bytes`: 发送字节数
  - `rx_packets`: 接收包数
  - `tx_packets`: 发送包数

**操作系统信息：**
- `name`: 操作系统名称
- `version`: 版本号
- `kernel`: 内核版本
- `architecture`: 架构

**系统信息：**
- `uptime`: 系统运行时间
- `load_average`: 负载平均值（1分钟、5分钟、15分钟）

### 2.4 故障排除

**问题1：采集失败，提示SSH连接失败**

**解决方法：**
1. 确认凭据正确（用户名、密码）
2. 确认服务器可以SSH连接
3. 检查服务器防火墙设置
4. 确认SSH端口正确（默认22）

**问题2：采集的信息不完整**

**可能原因：**
- 服务器不支持某些命令（如`ip`、`df`等）
- 权限不足，无法执行某些命令

**解决方法：**
1. 使用root用户或具有足够权限的用户
2. 检查服务器是否安装了必要的工具

**问题3：采集后监控数据未更新**

**解决方法：**
1. 刷新页面
2. 切换到其他标签页再切回监控标签页
3. 检查数据库中的`os_info`字段是否已更新

## 三、技术实现

### 3.1 前端技术栈

- **xterm.js**: 终端模拟器库（@xterm/xterm）
- **React**: UI框架
- **TypeScript**: 类型安全
- **WebSocket API**: 实时通信

### 3.2 后端技术栈

- **FastAPI**: Web框架
- **Paramiko**: SSH客户端库
- **WebSocket**: 实时通信
- **SQLAlchemy**: ORM框架
- **PostgreSQL**: 数据库

### 3.3 关键文件

**前端：**
- `frontend/src/components/SshTerminal.tsx`: SSH终端组件
- `frontend/src/pages/ServerDetail.tsx`: 服务器详情页
- `frontend/src/services/servers.ts`: 服务器API服务

**后端：**
- `backend/app/api/server_ssh.py`: SSH终端和文件管理API
- `backend/app/api/server_info.py`: 服务器信息采集API
- `backend/app/main.py`: 主应用文件（路由注册）

## 四、使用建议

### 4.1 首次使用

1. **配置服务器**：
   - 添加服务器信息（名称、主机、端口）
   - 创建SSH凭据（用户名、密码）

2. **测试连接**：
   - 在凭据管理页面使用"测试连接"功能
   - 确认SSH连接正常

3. **采集信息**：
   - 在服务器详情页的监控标签页采集信息
   - 确认信息采集成功

4. **使用终端**：
   - 在SSH终端标签页连接服务器
   - 执行命令测试功能

### 4.2 日常使用

1. **定期采集信息**：
   - 建议每天至少采集一次服务器信息
   - 可以设置定时任务自动采集

2. **监控服务器状态**：
   - 在监控标签页查看实时资源使用情况
   - 关注CPU、内存、磁盘使用率

3. **使用SSH终端**：
   - 进行服务器维护操作
   - 执行系统命令
   - 查看日志文件

## 五、注意事项

1. **安全性**：
   - SSH凭据已加密存储
   - WebSocket连接使用Token认证
   - 建议使用HTTPS/WSS协议

2. **性能**：
   - SSH连接会占用服务器资源
   - 建议及时断开不使用的连接
   - 信息采集会执行多个命令，可能需要几秒钟

3. **兼容性**：
   - 主要支持Linux系统
   - 某些命令可能在不同发行版中有所不同
   - 建议使用root用户或具有足够权限的用户

4. **错误处理**：
   - 所有错误都会在界面上显示
   - 建议查看浏览器控制台和后端日志
   - 遇到问题可以尝试重新连接

## 六、后续改进计划

- [ ] 支持SSH密钥认证
- [ ] 支持跳板机连接
- [ ] 支持终端会话记录
- [ ] 支持多标签页终端
- [ ] 支持文件上传/下载进度显示
- [ ] 支持定时自动采集信息
- [ ] 支持采集历史记录
- [ ] 支持告警规则配置
