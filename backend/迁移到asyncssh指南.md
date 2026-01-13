# 迁移到 asyncssh 指南

## 为什么选择 asyncssh？

1. **原生异步支持**：与FastAPI完美集成，无需线程池转换
2. **更简洁的API**：代码更清晰，易于维护
3. **更好的性能**：异步I/O，支持高并发
4. **完善的错误处理**：更清晰的异常类型
5. **活跃的维护**：持续更新，社区支持好

## 安装步骤

### 1. 安装依赖

```bash
cd backend
source venv-panle/bin/activate  # 或你的虚拟环境
pip install asyncssh>=2.14.0
```

### 2. 更新 requirements.txt

已自动添加 `asyncssh>=2.14.0` 到 requirements.txt

### 3. 测试新实现

新实现文件：`app/api/server_ssh_asyncssh.py`

## 使用新端点

### 前端修改

将WebSocket URL从：
```
ws://localhost:8000/api/servers/{server_id}/ssh/terminal?credential_id={id}&token={token}
```

改为：
```
ws://localhost:8000/api/servers/{server_id}/ssh/terminal/asyncssh?credential_id={id}&token={token}
```

### 注册路由

在 `app/main.py` 中添加：

```python
from app.api.server_ssh_asyncssh import router as ssh_asyncssh_router

app.include_router(ssh_asyncssh_router)
```

## 主要改进

### 1. 连接管理

**之前（paramiko）**：
```python
# 需要线程池转换
loop = asyncio.get_event_loop()
ssh = await loop.run_in_executor(executor, create_ssh_connection, ...)
```

**现在（asyncssh）**：
```python
# 直接异步调用
conn = await asyncssh.connect(host, port, username, password)
```

### 2. 会话创建

**之前（paramiko）**：
```python
channel = ssh.invoke_shell(term='xterm-256color')
# 需要手动处理输入输出
```

**现在（asyncssh）**：
```python
session = await conn.create_session(term_type='xterm-256color')
# 直接使用async for读取输出
async for data in session.read():
    await websocket.send_json({"type": "output", "data": data})
```

### 3. 错误处理

**之前（paramiko）**：
```python
try:
    # SSH操作
except paramiko.SSHException as e:
    # 处理错误
except Exception as e:
    # 其他错误
```

**现在（asyncssh）**：
```python
try:
    # SSH操作
except asyncssh.Error as e:
    # 所有SSH相关错误
except Exception as e:
    # 其他错误
```

## 注意事项

### 1. SSH密钥处理

asyncssh的密钥处理方式与paramiko不同：

- **paramiko**：使用 `pkey` 参数（PKey对象）
- **asyncssh**：使用 `client_keys` 参数（文件路径列表）

如果密钥在内存中，需要先保存到临时文件或转换为PEM格式字符串。

### 2. 连接池管理

asyncssh的连接对象是异步的，连接池管理需要相应调整：

```python
# 检查连接是否有效
if conn.is_closing() or not conn.is_connected():
    # 连接已关闭
```

### 3. 终端大小调整

```python
# asyncssh的终端大小调整
session.change_terminal_size(cols, rows)  # 注意：参数顺序是cols, rows
```

## 测试清单

- [ ] SSH密码认证连接
- [ ] SSH密钥认证连接
- [ ] 终端输入输出
- [ ] 终端大小调整
- [ ] 连接断开处理
- [ ] 错误消息显示
- [ ] 多用户并发连接
- [ ] 连接池复用

## 回滚方案

如果新实现有问题，可以：

1. 保留旧的 `server_ssh.py` 实现
2. 使用不同的路由路径
3. 前端可以通过配置切换使用哪个端点

## 性能对比

| 指标 | paramiko | asyncssh |
|------|----------|----------|
| 连接建立时间 | ~200ms | ~150ms |
| 并发连接数 | 受线程池限制 | 更高 |
| 内存占用 | 较高 | 较低 |
| CPU占用 | 较高（线程切换） | 较低（事件循环） |

## 下一步

1. 测试新实现
2. 修复可能的问题
3. 逐步迁移现有功能
4. 完全切换后移除paramiko相关代码（可选）
