# SSH密钥配置指南

## 问题诊断

如果测试连接时出现"SSH认证失败"，可能的原因包括：

1. **私钥与服务器上的公钥不匹配**
2. **服务器未配置对应的公钥**
3. **用户名不正确**
4. **私钥格式错误或已损坏**

## 解决方案

### 方法1：确保服务器上已配置对应的公钥

1. **从私钥生成公钥**（如果还没有公钥）：
   ```bash
   ssh-keygen -y -f /path/to/private_key > public_key.pub
   ```

2. **将公钥添加到服务器的 authorized_keys**：
   ```bash
   # 在服务器上执行
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh
   echo "公钥内容" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

3. **验证配置**：
   ```bash
   # 在服务器上检查
   cat ~/.ssh/authorized_keys
   ```

### 方法2：使用密码认证（临时方案）

如果SSH密钥配置有问题，可以暂时使用密码认证：

1. 在凭据管理中选择"密码"类型
2. 输入服务器的用户名和密码
3. 测试连接

### 方法3：检查私钥格式

确保私钥格式正确：

- RSA私钥应该以 `-----BEGIN RSA PRIVATE KEY-----` 开头
- ECDSA私钥应该以 `-----BEGIN EC PRIVATE KEY-----` 开头
- Ed25519私钥应该以 `-----BEGIN OPENSSH PRIVATE KEY-----` 开头

### 方法4：验证私钥和公钥匹配

1. **从私钥生成公钥**：
   ```bash
   ssh-keygen -y -f private_key > public_key.pub
   ```

2. **在服务器上检查 authorized_keys**：
   ```bash
   cat ~/.ssh/authorized_keys
   ```

3. **对比公钥内容**，确保匹配

## 常见问题

### Q: 如何从私钥生成公钥？

A: 使用以下命令：
```bash
ssh-keygen -y -f /path/to/private_key
```

### Q: 如何将公钥添加到服务器？

A: 有几种方法：

**方法1：使用 ssh-copy-id（推荐）**
```bash
ssh-copy-id -i public_key.pub user@server
```

**方法2：手动添加**
```bash
# 在服务器上执行
cat public_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Q: 如何检查服务器上的 authorized_keys？

A: 在服务器上执行：
```bash
cat ~/.ssh/authorized_keys
```

### Q: 权限设置要求？

A: 确保以下权限设置：
- `~/.ssh` 目录：`700` (drwx------)
- `~/.ssh/authorized_keys` 文件：`600` (-rw-------)

### Q: 私钥需要密码短语（passphrase）吗？

A: 当前系统不支持带密码短语的私钥。如果私钥有密码短语，需要先移除：
```bash
ssh-keygen -p -f private_key
# 输入旧密码，新密码留空
```

## 测试连接

配置完成后，在系统中：

1. 进入"凭据管理"
2. 选择或创建SSH密钥凭据
3. 点击"测试连接"
4. 查看详细的错误信息（如果失败）

## 调试信息

如果连接失败，系统会提供详细的错误信息，包括：

- 认证失败的具体原因
- 可能的解决方案
- 需要检查的配置项

## 安全建议

1. **私钥安全**：
   - 不要将私钥内容分享给他人
   - 使用加密存储（系统已自动加密）
   - 定期轮换密钥

2. **服务器安全**：
   - 限制 authorized_keys 文件的访问权限
   - 使用强密码或密钥认证
   - 定期审查 authorized_keys 中的条目

3. **网络安全**：
   - 使用SSH密钥认证替代密码认证
   - 禁用root用户密码登录（如果可能）
   - 配置防火墙规则
