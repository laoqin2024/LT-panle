# asyncssh SSH终端测试调试指南

## 已完成的修复

### 1. 密钥处理优化
- ✅ 支持从文件路径加载密钥
- ✅ 支持从加密内容加载密钥（临时文件方式）
- ✅ 自动设置密钥文件权限

### 2. Shell会话创建
- ✅ 使用 `start_shell_client()` 创建交互式shell
- ✅ 支持终端大小调整
- ✅ 改进的输出读取逻辑（非阻塞）

### 3. 路由注册
- ✅ 已在 `main.py` 中注册新路由
- ✅ 添加了错误处理

## 快速测试步骤

### 步骤1: 安装依赖

```bash
cd backend
source venv-panle/bin/activate
pip install asyncssh>=2.14.0
```

### 步骤2: 启动后端服务

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 步骤3: 测试WebSocket连接

#### 方法1: 使用浏览器控制台

```javascript
// 1. 先登录获取token
const loginResponse = await fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=admin&password=your_password'
});
const { access_token } = await loginResponse.json();

// 2. 建立WebSocket连接
const ws = new WebSocket(
  `ws://localhost:8000/api/servers/1/ssh/terminal/asyncssh?credential_id=1&token=${access_token}`
);

ws.onopen = () => console.log('✅ WebSocket连接已建立');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨 收到消息:', data);
  
  if (data.type === 'connected') {
    console.log('✅ SSH终端已连接');
    // 发送测试命令
    ws.send(JSON.stringify({ type: 'input', data: 'ls -la\n' }));
  } else if (data.type === 'output') {
    console.log('📤 SSH输出:', data.data);
  } else if (data.type === 'error') {
    console.error('❌ 错误:', data.message);
  }
};

ws.onerror = (error) => console.error('❌ WebSocket错误:', error);
ws.onclose = () => console.log('🔌 WebSocket连接已关闭');
```

#### 方法2: 使用Python测试脚本

创建 `test_websocket_asyncssh.py`:

```python
import asyncio
import websockets
import json
import sys

async def test_ssh_terminal():
    # 替换为实际的参数
    server_id = 1
    credential_id = 1
    token = "YOUR_TOKEN_HERE"
    
    uri = f"ws://localhost:8000/api/servers/{server_id}/ssh/terminal/asyncssh?credential_id={credential_id}&token={token}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket连接已建立")
            
            # 等待连接成功消息
            connected_msg = await websocket.recv()
            data = json.loads(connected_msg)
            print(f"📨 收到消息: {data}")
            
            if data.get("type") == "connected":
                print("✅ SSH终端已连接")
                
                # 发送测试命令
                await websocket.send(json.dumps({
                    "type": "input",
                    "data": "ls -la\n"
                }))
                
                # 读取输出
                for i in range(5):
                    try:
                        output = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        data = json.loads(output)
                        if data.get("type") == "output":
                            print(f"📤 输出: {data.get('data', '')}")
                        elif data.get("type") == "error":
                            print(f"❌ 错误: {data.get('message', '')}")
                    except asyncio.TimeoutError:
                        break
                
                # 退出
                await websocket.send(json.dumps({
                    "type": "input",
                    "data": "exit\n"
                }))
                
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    asyncio.run(test_ssh_terminal())
```

## 常见问题排查

### 问题1: ImportError - 无法导入 asyncssh

**错误信息**:
```
ImportError: cannot import name 'server_ssh_asyncssh' from 'app.api'
```

**解决方法**:
```bash
pip install asyncssh>=2.14.0
```

### 问题2: SSH连接失败

**错误信息**:
```
SSH连接失败: Connection refused
```

**可能原因**:
1. 服务器信息不正确
2. 网络连接问题
3. SSH服务未启动

**排查步骤**:
1. 检查服务器ID和凭据ID是否正确
2. 使用 `test_asyncssh.py` 测试基本连接
3. 检查后端日志

### 问题3: 密钥认证失败

**错误信息**:
```
SSH密钥文件不存在或无法加载
```

**解决方法**:
1. 检查密钥文件路径是否正确
2. 如果使用密钥内容，确保已正确加密存储
3. 检查密钥格式（支持RSA, ECDSA, Ed25519）

### 问题4: WebSocket连接立即断开

**可能原因**:
1. 认证失败
2. 参数不完整
3. 后端异常

**排查步骤**:
1. 检查token是否有效
2. 查看后端日志中的错误信息
3. 验证所有必需参数（server_id, credential_id, token）

### 问题5: 终端无输出

**可能原因**:
1. Shell会话创建失败
2. 输出读取逻辑问题
3. 编码问题

**排查步骤**:
1. 检查后端日志中的 "SSH终端连接成功" 消息
2. 验证 `start_shell_client` 是否成功
3. 检查输出读取循环是否正常运行

## 调试技巧

### 1. 启用详细日志

在 `app/api/server_ssh_asyncssh.py` 开头添加:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
```

### 2. 添加调试输出

在关键位置添加日志:

```python
logger.debug(f"连接参数: {connect_kwargs}")
logger.debug(f"连接状态: is_connected={conn.is_connected()}")
logger.debug(f"收到消息: {message}")
```

### 3. 测试基本asyncssh功能

使用 `test_asyncssh.py` 验证asyncssh库本身:

```bash
python test_asyncssh.py
```

### 4. 检查连接池

```python
# 在代码中添加
logger.debug(f"连接池状态: {list(ssh_connections.keys())}")
```

## 性能测试

### 测试连接建立时间

```python
import time
start = time.time()
conn = await get_ssh_connection_async(...)
elapsed = time.time() - start
print(f"连接建立时间: {elapsed:.3f}秒")
```

### 测试并发连接

```python
async def test_concurrent_connections():
    tasks = []
    for i in range(10):
        tasks.append(test_ssh_terminal())
    await asyncio.gather(*tasks)
```

## 下一步行动

1. ✅ 完成代码修复
2. ⬜ 测试基本连接
3. ⬜ 测试WebSocket通信
4. ⬜ 测试前端集成
5. ⬜ 性能对比测试
6. ⬜ 完全切换到新实现

## 回滚方案

如果新实现有问题，可以：

1. 保留旧的 `server_ssh.py` 实现
2. 前端通过配置选择使用哪个端点
3. 逐步迁移，确保稳定性

## 联系支持

如果遇到问题，请提供：
1. 完整的错误日志
2. 后端日志输出
3. 测试步骤和结果
4. 服务器和凭据信息（脱敏）
