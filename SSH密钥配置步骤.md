# SSH密钥配置步骤

## 测试结果

✅ **私钥格式正确**：RSA 4096位，已成功加载  
❌ **SSH认证失败**：服务器上未配置对应的公钥

## 解决方案

### 步骤1：获取对应的公钥

从您提供的私钥生成的公钥是：

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+LNoxdIWrIKtgO+pw1GrsrNNzl7rkLxPu2+ygo/BUQL7DpYH93H+3DCpOgUKUrYKwa+Pu5aupwczzz2ctk48lXHcMF2f6dGedVhLBJSOXLLF1VZo7Nb7Zc61/L0Bg3z3E58kdlfNNKAq9Y8+A8IuOyVZHaXBJSYb4Crasseeu+anLHlULzmQ8+u/PLW/dNVw2OgmbTsS/Eo/TuSW5Nh4QyA5ix0Wsarc4mTRnPqvWRnspUYS1ycbCWmr3LGBVhUs2+q3E2W03ECJqCL6EED0IUIQ+99c3DlGe4csa0gNuKqJq78V494B0cl6z7RAkYE/5Auuh5ER28bTl0TArva/bajgpGmdoWga/hwpM6t6uwuUdrxAieOKlwzibSvDa71bcN5aLR8Q0CcDEhOStPgvvV0CClc5FIEH1QZQP14AKzksNkM5NxO+6qXZRZf/OzS/MRdVndEx+edBlM7G1gMCjEyRIqO+fNik7ugejbBFrYd6dJWQTv3Hgvo1vbNq+Rvd0viFd+OBZFrZfWEkeygpBzqMC/+Lgw+hKRhPAI9QcZk4qykfVOamp0jxN+M9TMFeuVwitBqlTRv926uS3GwiuDlohJgXiMvle0fnhjuBkZPy8cXHtU98AXC9V0TexQzgShGv3MZaCedad4pN9VBG9ZOdXG4KH5l3LmBZtYjet+Q==
```

### 步骤2：在服务器上配置公钥

**在服务器 `192.168.8.95` 上执行以下命令：**

```bash
# 1. 创建.ssh目录（如果不存在）
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 2. 将公钥添加到authorized_keys文件
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+LNoxdIWrIKtgO+pw1GrsrNNzl7rkLxPu2+ygo/BUQL7DpYH93H+3DCpOgUKUrYKwa+Pu5aupwczzz2ctk48lXHcMF2f6dGedVhLBJSOXLLF1VZo7Nb7Zc61/L0Bg3z3E58kdlfNNKAq9Y8+A8IuOyVZHaXBJSYb4Crasseeu+anLHlULzmQ8+u/PLW/dNVw2OgmbTsS/Eo/TuSW5Nh4QyA5ix0Wsarc4mTRnPqvWRnspUYS1ycbCWmr3LGBVhUs2+q3E2W03ECJqCL6EED0IUIQ+99c3DlGe4csa0gNuKqJq78V494B0cl6z7RAkYE/5Auuh5ER28bTl0TArva/bajgpGmdoWga/hwpM6t6uwuUdrxAieOKlwzibSvDa71bcN5aLR8Q0CcDEhOStPgvvV0CClc5FIEH1QZQP14AKzksNkM5NxO+6qXZRZf/OzS/MRdVndEx+edBlM7G1gMCjEyRIqO+fNik7ugejbBFrYd6dJWQTv3Hgvo1vbNq+Rvd0viFd+OBZFrZfWEkeygpBzqMC/+Lgw+hKRhPAI9QcZk4qykfVOamp0jxN+M9TMFeuVwitBqlTRv926uS3GwiuDlohJgXiMvle0fnhjuBkZPy8cXHtU98AXC9V0TexQzgShGv3MZaCedad4pN9VBG9ZOdXG4KH5l3LmBZtYjet+Q==" >> ~/.ssh/authorized_keys

# 3. 设置正确的文件权限
chmod 600 ~/.ssh/authorized_keys

# 4. 验证配置
cat ~/.ssh/authorized_keys
```

### 步骤3：验证配置

配置完成后，在系统中：

1. 进入"凭据管理"
2. 选择或创建SSH密钥凭据
   - 服务器：192.168.8.95
   - 用户：root
   - 类型：SSH密钥
   - 私钥内容：粘贴您提供的私钥
3. 点击"测试连接"
4. 应该显示"连接测试成功"

## 一键配置脚本（可选）

如果您有服务器root权限，可以使用以下脚本一键配置：

```bash
#!/bin/bash
# 在服务器 192.168.8.95 上执行

PUBLIC_KEY="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+LNoxdIWrIKtgO+pw1GrsrNNzl7rkLxPu2+ygo/BUQL7DpYH93H+3DCpOgUKUrYKwa+Pu5aupwczzz2ctk48lXHcMF2f6dGedVhLBJSOXLLF1VZo7Nb7Zc61/L0Bg3z3E58kdlfNNKAq9Y8+A8IuOyVZHaXBJSYb4Crasseeu+anLHlULzmQ8+u/PLW/dNVw2OgmbTsS/Eo/TuSW5Nh4QyA5ix0Wsarc4mTRnPqvWRnspUYS1ycbCWmr3LGBVhUs2+q3E2W03ECJqCL6EED0IUIQ+99c3DlGe4csa0gNuKqJq78V494B0cl6z7RAkYE/5Auuh5ER28bTl0TArva/bajgpGmdoWga/hwpM6t6uwuUdrxAieOKlwzibSvDa71bcN5aLR8Q0CcDEhOStPgvvV0CClc5FIEH1QZQP14AKzksNkM5NxO+6qXZRZf/OzS/MRdVndEx+edBlM7G1gMCjEyRIqO+fNik7ugejbBFrYd6dJWQTv3Hgvo1vbNq+Rvd0viFd+OBZFrZfWEkeygpBzqMC/+Lgw+hKRhPAI9QcZk4qykfVOamp0jxN+M9TMFeuVwitBqlTRv926uS3GwiuDlohJgXiMvle0fnhjuBkZPy8cXHtU98AXC9V0TexQzgShGv3MZaCedad4pN9VBG9ZOdXG4KH5l3LmBZtYjet+Q=="

mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo "公钥已添加到 ~/.ssh/authorized_keys"
```

## 常见问题

### Q: 如果服务器上已经有authorized_keys文件怎么办？

A: 直接追加即可，不会覆盖现有内容：
```bash
echo "公钥内容" >> ~/.ssh/authorized_keys
```

### Q: 如何检查服务器上已配置的公钥？

A: 在服务器上执行：
```bash
cat ~/.ssh/authorized_keys
```

### Q: 配置后仍然无法连接？

A: 检查以下几点：
1. 文件权限是否正确（.ssh目录700，authorized_keys文件600）
2. 公钥内容是否完整（没有换行或空格）
3. 用户名是否正确（root）
4. SSH服务是否正常运行
5. 防火墙是否允许SSH连接

### Q: 如何测试SSH连接？

A: 在本地使用命令行测试：
```bash
ssh -i /path/to/private_key root@192.168.8.95
```

## 注意事项

1. **安全性**：确保私钥文件权限设置为600
2. **备份**：配置前建议备份现有的authorized_keys文件
3. **权限**：确保.ssh目录权限为700，authorized_keys文件权限为600
4. **SELinux**：如果服务器启用了SELinux，可能需要额外配置

配置完成后，请再次在系统中测试连接！
