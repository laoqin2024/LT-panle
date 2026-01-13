# WebSocket SSH终端测试说明

## ❌ 常见错误

### 错误1: `Uncaught SyntaxError: Unexpected end of input`

**原因**: 在浏览器控制台中直接输入URL，没有用引号包裹

**错误示例**:
```javascript
ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=xxx
```

**正确方式**:
```javascript
const ws = new WebSocket('ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=xxx');
```

## ✅ 正确的测试方法

### 方法1: 使用提供的测试函数

1. 打开浏览器控制台（F12）
2. 复制 `浏览器控制台测试代码.js` 中的代码
3. 修改参数（serverId, credentialId, 密码）
4. 运行 `testSSHTerminal()`

### 方法2: 一行代码快速测试

```javascript
(async () => {
    // 1. 登录获取token
    const token = (await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'username=admin&password=your_password'  // 替换密码
    }).then(r => r.json())).access_token;
    
    // 2. 建立WebSocket连接
    const ws = new WebSocket(`ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=${token}`);
    
    // 3. 设置事件处理
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

### 方法3: 分步测试

```javascript
// 步骤1: 登录
const loginRes = await fetch('http://localhost:8000/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'username=admin&password=your_password'
});
const {access_token} = await loginRes.json();

// 步骤2: 创建WebSocket（注意：URL必须用引号包裹）
const ws = new WebSocket(`ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=${access_token}`);

// 步骤3: 监听消息
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('收到:', data);
};

// 步骤4: 发送命令（在收到connected消息后）
ws.send(JSON.stringify({type: 'input', data: 'ls -la\n'}));
```

## 🔍 调试技巧

### 1. 检查URL格式

确保URL格式正确：
- ✅ `ws://localhost:8000/api/servers/2/ssh/terminal/asyncssh?credential_id=3&token=xxx`
- ❌ 不要直接输入URL（会报语法错误）

### 2. 检查参数

- `server_id`: 必须是数据库中存在的服务器ID
- `credential_id`: 必须是数据库中存在的凭据ID
- `token`: 必须是有效的JWT token

### 3. 查看后端日志

在后端控制台查看：
- WebSocket连接是否建立
- SSH连接是否成功
- 是否有错误信息

### 4. 检查网络请求

在浏览器开发者工具的Network标签中：
- 查看WebSocket连接状态
- 查看消息传输情况

## 📝 消息格式

### 客户端 → 服务器

```javascript
// 发送输入
ws.send(JSON.stringify({
    type: 'input',
    data: 'ls -la\n'
}));

// 调整终端大小
ws.send(JSON.stringify({
    type: 'resize',
    rows: 24,
    cols: 80
}));
```

### 服务器 → 客户端

```javascript
// 连接成功
{type: 'connected', message: 'SSH终端已连接'}

// SSH输出
{type: 'output', data: '命令输出内容'}

// 错误
{type: 'error', message: '错误信息'}
```

## ⚠️ 注意事项

1. **URL必须用引号包裹**: 在JavaScript中，字符串必须用引号
2. **参数替换**: 记得替换实际的serverId、credentialId和密码
3. **Token有效期**: Token有时效性，过期后需要重新登录
4. **后端服务**: 确保后端服务正在运行

## 🐛 常见问题

### Q: 为什么直接输入URL会报错？
A: 因为JavaScript解析器认为这是一个未完成的语句。必须用引号包裹或使用`new WebSocket()`。

### Q: 连接后立即断开？
A: 检查：
- Token是否有效
- 服务器ID和凭据ID是否正确
- 后端日志中的错误信息

### Q: 没有收到输出？
A: 检查：
- 是否发送了命令（需要发送`\n`换行符）
- 后端SSH连接是否成功
- 查看后端日志
