# 测试 asyncssh SSH终端功能

## 准备工作

### 1. 安装依赖

```bash
cd backend
source venv-panle/bin/activate  # 或你的虚拟环境
pip install asyncssh>=2.14.0
```

### 2. 检查路由注册

确保 `app/main.py` 中已注册新的路由（已自动添加）。

### 3. 启动后端服务

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 测试步骤

### 测试1: 基本连接测试

使用 `test_asyncssh.py` 脚本测试基本连接：

```bash
cd backend
python test_asyncssh.py
```

**注意**：需要修改脚本中的服务器信息（host, username, password）。

### 测试2: WebSocket终端测试

#### 2.1 获取认证Token

```bash
# 登录获取token
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=your_password"
```

#### 2.2 测试WebSocket连接

使用WebSocket客户端工具（如 `websocat` 或浏览器控制台）：

```javascript
// 在浏览器控制台中运行
const ws = new WebSocket('ws://localhost:8000/api/servers/1/ssh/terminal/asyncssh?credential_id=1&token=YOUR_TOKEN');

ws.onopen = () => {
  console.log('WebSocket连接已建立');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);
  
  if (data.type === 'connected') {
    // 连接成功，发送测试命令
    ws.send(JSON.stringify({
      type: 'input',
      data: 'ls -la\n'
    }));
  } else if (data.type === 'output') {
    console.log('SSH输出:', data.data);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket错误:', error);
};

ws.onclose = () => {
  console.log('WebSocket连接已关闭');
};
```

### 测试3: 前端集成测试

修改前端 `SshTerminal.tsx` 组件，将WebSocket URL改为：

```typescript
const wsUrl = `ws://localhost:8000/api/servers/${serverId}/ssh/terminal/asyncssh?credential_id=${credentialId}&token=${token}`;
```

## 常见问题排查

### 问题1: 连接失败 - "SSH连接失败"

**可能原因**：
- 服务器信息不正确
- 凭据信息错误
- 网络连接问题

**解决方法**：
1. 检查服务器ID和凭据ID是否正确
2. 验证用户名和密码
3. 检查服务器是否可访问

### 问题2: 密钥认证失败

**可能原因**：
- 密钥格式不正确
- 密钥文件路径不存在
- 密钥权限问题

**解决方法**：
1. 检查密钥文件是否存在
2. 验证密钥格式（支持RSA, ECDSA, Ed25519）
3. 确保密钥文件权限为 600

### 问题3: WebSocket连接立即断开

**可能原因**：
- 认证失败
- 参数不完整
- 后端错误

**解决方法**：
1. 检查token是否有效
2. 查看后端日志
3. 验证所有必需参数

### 问题4: 终端无输出

**可能原因**：
- 会话创建方式不正确
- 输出读取逻辑问题

**解决方法**：
1. 检查 `create_process` 的使用方式
2. 验证输出读取逻辑
3. 查看后端日志

## 调试技巧

### 1. 启用详细日志

在 `app/api/server_ssh_asyncssh.py` 中：

```python
logging.basicConfig(level=logging.DEBUG)
```

### 2. 检查连接状态

```python
# 在代码中添加
logger.debug(f"连接状态: is_connected={conn.is_connected()}, is_closing={conn.is_closing()}")
```

### 3. 测试基本asyncssh功能

使用 `test_asyncssh.py` 脚本验证asyncssh库本身是否正常工作。

## 性能对比

测试完成后，可以对比新旧实现的性能：

| 指标 | paramiko | asyncssh |
|------|----------|----------|
| 连接建立时间 | | |
| 命令响应时间 | | |
| 并发连接数 | | |
| 内存占用 | | |

## 下一步

1. ✅ 完成基本连接测试
2. ✅ 完成WebSocket通信测试
3. ⬜ 完成前端集成测试
4. ⬜ 性能对比测试
5. ⬜ 完全切换到新实现
