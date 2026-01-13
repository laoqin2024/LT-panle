# SSH终端WebSocket调试说明

## 架构说明

SSH终端功能使用了两层连接：

### 1. WebSocket连接（前端 ↔ 后端）
- **位置**: 浏览器 ↔ 本地后端服务器
- **协议**: WebSocket (ws:// 或 wss://)
- **用途**: 实时传输终端输入输出
- **不需要**: 远程服务器上的任何配置

### 2. SSH连接（后端 ↔ 远程服务器）
- **位置**: 本地后端服务器 ↔ 远程服务器
- **协议**: SSH (TCP端口22或自定义)
- **用途**: 实际执行命令
- **需要**: 远程服务器支持SSH（标准配置）

## 连接流程

```
浏览器 → [WebSocket] → 本地后端 → [SSH] → 远程服务器
        (ws://localhost)          (ssh://192.168.x.x:22)
```

## 问题诊断

从日志看到连接立即关闭，可能的原因：

### 1. 参数验证失败
- credential_id 或 token 缺失
- 日志会显示: "WebSocket参数不完整"

### 2. 用户认证失败
- Token过期或无效
- 日志会显示: "用户认证失败"

### 3. 服务器/凭据不存在
- 数据库查询失败
- 日志会显示: "服务器不存在" 或 "凭据不存在"

### 4. SSH连接创建失败
- 远程服务器无法访问
- 认证失败（密码错误、密钥不匹配）
- 日志会显示: "创建SSH连接失败"

### 5. SSH Shell创建失败
- SSH传输层问题
- PTY分配失败
- 日志会显示: "创建SSH shell失败"

## 调试步骤

### 步骤1: 查看详细日志

重启后端服务后，尝试连接SSH终端，查看控制台输出：

```bash
cd backend
source venv-panle/bin/activate
python -m uvicorn app.main:app --reload
```

日志会显示每一步的执行情况：

```
INFO: WebSocket连接已接受: server_id=2
INFO: WebSocket参数: credential_id=3, token=已提供
INFO: 用户认证成功: admin
INFO: 查询服务器和凭据: server_id=2, credential_id=3
INFO: 服务器信息: 服务器名称 (192.168.x.x:22)
INFO: 凭据信息: 凭据名称 (类型: password/ssh_key)
INFO: 检查SSH连接池...
INFO: 连接池中无可用连接，创建新SSH连接...
INFO: SSH连接创建成功
INFO: 创建SSH交互式shell...
INFO: 打开SSH会话通道...
INFO: 请求PTY...
INFO: 启动shell...
INFO: SSH shell创建成功
INFO: 发送连接成功消息...
INFO: SSH终端连接完成，开始处理消息...
```

### 步骤2: 检查错误日志

如果连接失败，日志会显示具体的错误：

```
ERROR: 创建SSH连接失败: SSH认证失败，请检查用户名和密码是否正确
ERROR: 创建SSH连接失败: Connection timeout
ERROR: 创建SSH shell失败: ...
```

### 步骤3: 测试SSH连接

在终端中手动测试SSH连接：

```bash
# 使用密码
ssh username@192.168.x.x

# 使用密钥
ssh -i /path/to/private_key username@192.168.x.x
```

如果手动连接失败，WebSocket连接也会失败。

### 步骤4: 检查网络连接

```bash
# 测试服务器可达性
ping 192.168.x.x

# 测试SSH端口
telnet 192.168.x.x 22
# 或
nc -zv 192.168.x.x 22
```

### 步骤5: 检查凭据配置

1. **密码凭据**:
   - 确认用户名和密码正确
   - 确认服务器允许密码登录

2. **SSH密钥凭据**:
   - 确认私钥格式正确
   - 确认公钥已添加到服务器的 `~/.ssh/authorized_keys`
   - 确认用户名正确
   - 确认密钥权限正确（通常是600）

## 常见错误及解决方案

### 错误1: "WebSocket参数不完整"
**原因**: credential_id 或 token 未提供  
**解决**: 检查前端是否正确传递参数

### 错误2: "用户认证失败"
**原因**: Token过期或无效  
**解决**: 重新登录获取新token

### 错误3: "服务器不存在"
**原因**: server_id 在数据库中不存在  
**解决**: 检查服务器ID是否正确

### 错误4: "凭据不存在"
**原因**: credential_id 在数据库中不存在  
**解决**: 检查凭据ID是否正确

### 错误5: "SSH认证失败"
**原因**: 
- 密码错误
- 密钥不匹配
- 公钥未配置到服务器

**解决**:
1. 验证密码正确性
2. 检查密钥是否匹配
3. 将公钥添加到服务器的 `~/.ssh/authorized_keys`:

```bash
# 在服务器上执行
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 错误6: "Connection timeout"
**原因**: 
- 服务器不可达
- 防火墙阻止连接
- 端口错误

**解决**:
1. 检查网络连接
2. 检查防火墙规则
3. 确认SSH端口正确（默认22）

### 错误7: "SSH传输层未激活"
**原因**: SSH连接已断开  
**解决**: 重新连接

## 日志级别配置

如果需要更详细的日志，可以修改日志级别：

```python
# 在 app/main.py 或配置文件中
import logging

logging.basicConfig(
    level=logging.DEBUG,  # 改为DEBUG级别
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## 性能优化建议

1. **连接池**: SSH连接会被缓存，避免频繁创建
2. **超时设置**: SSH连接超时设置为10秒
3. **错误重试**: 前端可以实现自动重连机制

## 总结

- ✅ **WebSocket不需要在远程服务器上配置**
- ✅ **只需要远程服务器支持SSH（标准配置）**
- ✅ **查看日志可以快速定位问题**
- ✅ **手动测试SSH连接可以验证配置**

如果连接仍然失败，请：
1. 查看后端日志的详细错误信息
2. 手动测试SSH连接
3. 检查凭据配置
4. 检查网络连接
