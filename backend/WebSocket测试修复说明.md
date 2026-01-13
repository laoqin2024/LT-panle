# WebSocket测试修复说明

## ✅ 已修复的问题

### 问题1: 登录接口422错误

**原因**: 登录接口期望JSON格式，但测试代码使用表单数据格式

**修复**: 修改登录接口支持表单数据（`application/x-www-form-urlencoded`）

**修改内容**:
```python
# 之前
@router.post("/login")
async def login(login_data: LoginRequest, ...):
    ...

# 现在
@router.post("/login")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    ...
):
    ...
```

### 问题2: Token响应格式

**响应格式**: 
```json
{
    "token": "...",
    "access_token": "...",
    "refresh_token": "...",
    ...
}
```

**注意**: 响应中同时包含 `token` 和 `access_token`，两者值相同，都可以使用。

## ✅ 正确的测试代码

### 方法1: 完整测试函数

```javascript
async function testSSHTerminal() {
    // 1. 登录获取token
    const loginRes = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'username=admin&password=admin123'  // 使用实际密码
    });
    
    if (!loginRes.ok) {
        console.error('登录失败:', await loginRes.text());
        return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.access_token || loginData.token;  // 支持两种格式
    
    // 2. 建立WebSocket连接
    const ws = new WebSocket(`ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=${token}`);
    
    ws.onopen = () => console.log('✅ WebSocket连接成功');
    
    ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === 'connected') {
            console.log('✅ SSH终端已连接');
            setTimeout(() => {
                ws.send(JSON.stringify({type: 'input', data: 'ls -la\n'}));
            }, 500);
        } else if (d.type === 'output') {
            console.log('📤 输出:', d.data);
        } else if (d.type === 'error') {
            console.error('❌ 错误:', d.message);
        }
    };
    
    ws.onerror = e => console.error('❌ WebSocket错误:', e);
    ws.onclose = e => console.log('🔌 连接关闭:', e.code);
    
    return ws;
}

// 运行测试
testSSHTerminal();
```

### 方法2: 一行代码快速测试

```javascript
(async () => {
    const {access_token} = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'username=admin&password=admin123'
    }).then(r => r.json());
    
    const ws = new WebSocket(`ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=${access_token}`);
    ws.onopen = () => console.log('✅ 连接成功');
    ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        console.log(d.type === 'output' ? d.data : d);
        if (d.type === 'connected') {
            setTimeout(() => ws.send(JSON.stringify({type: 'input', data: 'ls -la\n'})), 500);
        }
    };
    ws.onerror = e => console.error('❌ 错误:', e);
    ws.onclose = e => console.log('🔌 关闭:', e.code);
})();
```

## 🔍 测试步骤

1. **确保后端服务运行**:
   ```bash
   cd backend
   source venv-panle/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **打开浏览器控制台** (F12)

3. **运行测试代码** (使用上面的方法1或方法2)

4. **观察输出**:
   - ✅ 应该看到 "WebSocket连接成功"
   - ✅ 应该看到 "SSH终端已连接"
   - ✅ 应该看到命令输出

## ⚠️ 注意事项

1. **密码**: 确保使用正确的密码（默认是 `admin123`）
2. **服务器ID**: 确保服务器ID `2` 存在
3. **凭据ID**: 确保凭据ID `3` 存在
4. **后端日志**: 如果遇到问题，查看后端控制台的日志

## 🐛 常见问题

### Q: 仍然收到422错误？
A: 确保：
- 使用 `application/x-www-form-urlencoded` 格式
- 用户名和密码正确
- 后端服务已重启（应用了修改）

### Q: Token无效？
A: 检查：
- Token是否正确提取（`access_token` 或 `token`）
- Token是否包含在WebSocket URL中
- 后端日志中的错误信息

### Q: WebSocket连接成功但没有输出？
A: 检查：
- 是否发送了命令（需要 `\n` 换行符）
- SSH连接是否成功（查看后端日志）
- 服务器和凭据是否正确
