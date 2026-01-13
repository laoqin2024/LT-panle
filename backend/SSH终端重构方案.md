# SSH终端功能重构方案

## 问题分析

当前实现使用 `paramiko` + `FastAPI WebSocket`，存在以下问题：
1. WebSocket连接在建立前被关闭
2. React严格模式导致重复初始化
3. 异步/同步混用导致连接管理复杂
4. 错误处理和状态管理不够完善

## 推荐方案

### 方案1：使用 `asyncssh` + FastAPI WebSocket（推荐）

**优点**：
- 原生异步支持，与FastAPI完美集成
- 更简洁的API
- 更好的错误处理
- 支持PTY和shell交互

**安装**：
```bash
pip install asyncssh
```

**实现示例**：
```python
import asyncssh
from fastapi import WebSocket, WebSocketDisconnect
import asyncio

@router.websocket("/servers/{server_id}/ssh/terminal")
async def ssh_terminal_asyncssh(
    websocket: WebSocket,
    server_id: int,
    credential_id: int = Query(...),
    token: str = Query(...)
):
    await websocket.accept()
    
    try:
        # 获取服务器和凭据信息
        server = await get_server(server_id)
        credential = await get_credential(credential_id)
        
        # 使用asyncssh建立连接
        conn = await asyncssh.connect(
            server.host,
            port=server.port or 22,
            username=credential.username,
            password=decrypt_password(credential.password_encrypted),
            known_hosts=None,
            client_keys=None
        )
        
        # 创建交互式shell
        async with conn:
            chan, session = await conn.create_session(
                asyncssh.SSHClientSession,
                term_type='xterm-256color'
            )
            
            # 启动输出读取任务
            async def read_output():
                try:
                    async for data in chan.read():
                        await websocket.send_json({
                            "type": "output",
                            "data": data
                        })
                except Exception as e:
                    logger.error(f"读取SSH输出失败: {e}")
            
            # 启动输入处理任务
            async def handle_input():
                try:
                    while True:
                        message = await websocket.receive_json()
                        if message.get("type") == "input":
                            chan.write(message.get("data", ""))
                        elif message.get("type") == "resize":
                            chan.change_terminal_size(
                                message.get("rows", 24),
                                message.get("cols", 80)
                            )
                except WebSocketDisconnect:
                    logger.info("WebSocket连接断开")
            
            # 发送连接成功消息
            await websocket.send_json({
                "type": "connected",
                "message": "SSH终端已连接"
            })
            
            # 并发运行输入和输出处理
            await asyncio.gather(
                read_output(),
                handle_input(),
                return_exceptions=True
            )
            
    except asyncssh.Error as e:
        logger.error(f"SSH连接错误: {e}")
        await websocket.send_json({
            "type": "error",
            "message": f"SSH连接失败: {str(e)}"
        })
    except Exception as e:
        logger.error(f"SSH终端错误: {e}")
        await websocket.send_json({
            "type": "error",
            "message": f"终端错误: {str(e)}"
        })
    finally:
        await websocket.close()
```

### 方案2：使用 `websockify` 作为代理

**优点**：
- 成熟的解决方案，广泛使用
- 将TCP连接转换为WebSocket
- 可以独立部署

**缺点**：
- 需要额外的进程/服务
- 配置相对复杂

**安装**：
```bash
pip install websockify
```

**使用方式**：
```bash
# 启动websockify代理
websockify --target-config=/path/to/targets.json 6080

# 或者直接代理到SSH服务器
websockify 6080 localhost:22
```

### 方案3：使用 `webssh` 库

**优点**：
- 完整的Web SSH解决方案
- 包含前端和后端
- 开箱即用

**缺点**：
- 需要集成到现有系统
- 可能功能过于复杂

**GitHub**: https://github.com/huashengdun/webssh

### 方案4：使用 `tornado` WebSocket

**优点**：
- 成熟的WebSocket支持
- 可以配合paramiko使用

**缺点**：
- 需要引入tornado框架
- 与FastAPI集成需要额外工作

## 推荐实现：asyncssh方案

### 1. 更新 requirements.txt

```txt
asyncssh>=2.14.0
```

### 2. 重构 server_ssh.py

主要改动：
- 使用 `asyncssh` 替代 `paramiko`
- 简化连接管理
- 改进错误处理
- 优化WebSocket消息处理

### 3. 优势对比

| 特性 | paramiko | asyncssh |
|------|----------|----------|
| 异步支持 | 需要线程池 | 原生异步 |
| FastAPI集成 | 需要转换 | 完美集成 |
| 代码复杂度 | 较高 | 较低 |
| 性能 | 一般 | 更好 |
| 错误处理 | 需要手动处理 | 更好的异常 |

## 实施步骤

1. **安装asyncssh**
   ```bash
   cd backend
   pip install asyncssh>=2.14.0
   ```

2. **备份现有代码**
   ```bash
   cp app/api/server_ssh.py app/api/server_ssh.py.bak
   ```

3. **重构实现**
   - 替换paramiko为asyncssh
   - 简化连接管理逻辑
   - 改进错误处理

4. **测试验证**
   - 测试SSH连接
   - 测试WebSocket通信
   - 测试终端交互

5. **更新文档**
   - 更新API文档
   - 更新使用说明

## 注意事项

1. **密钥认证**：asyncssh的密钥处理方式与paramiko略有不同
2. **连接池**：asyncssh的连接管理更简单，但仍需要适当的连接池
3. **错误处理**：asyncssh的异常类型不同，需要相应调整
4. **兼容性**：确保与现有功能（文件管理、命令执行等）兼容

## 迁移建议

建议采用渐进式迁移：
1. 先实现新的asyncssh版本
2. 保留旧的paramiko版本作为备用
3. 逐步测试和验证
4. 确认稳定后完全切换
