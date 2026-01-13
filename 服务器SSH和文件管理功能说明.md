# 服务器SSH终端和文件管理功能说明

## 一、已完成功能

### 1. SSH终端后端API ✅
- **WebSocket端点**: `WS /api/servers/{server_id}/ssh/terminal`
  - 支持实时SSH终端交互
  - 支持终端大小调整
  - 支持命令输入和输出
- **SSH连接管理**:
  - SSH连接池管理
  - 自动连接复用
  - 连接断开接口

### 2. 文件管理后端API ✅
- **文件列表**: `GET /api/servers/{server_id}/files`
  - 支持目录浏览
  - 返回文件详细信息（名称、类型、大小、修改时间、权限）
- **文件上传**: `POST /api/servers/{server_id}/files/upload`
  - 支持文件上传到指定路径
- **文件下载**: `GET /api/servers/{server_id}/files/download`
  - 支持文件下载
- **文件删除**: `DELETE /api/servers/{server_id}/files`
  - 支持删除文件和目录
- **创建目录**: `POST /api/servers/{server_id}/files/mkdir`
  - 支持创建新目录

### 3. 文件管理前端界面 ✅
- **文件浏览器**:
  - 目录导航（支持返回上级目录）
  - 文件列表展示（表格形式）
  - 文件类型图标区分
  - 文件大小格式化显示
  - 修改时间显示
  - 权限信息显示
- **文件操作**:
  - 文件上传（选择文件上传）
  - 文件下载（点击下载按钮）
  - 文件删除（支持文件和目录）
  - 创建目录（对话框输入目录名）
- **凭据选择**:
  - 集成凭据选择器
  - 需要选择凭据才能访问文件系统

### 4. SSH终端前端界面 🟡
- **基础框架**: 已完成
- **完整功能**: 需要安装 xterm.js 库

## 二、使用说明

### 文件管理

1. **访问文件管理**:
   - 进入服务器详情页
   - 切换到"文件管理"标签页
   - 选择凭据（如果未选择）

2. **浏览文件**:
   - 点击目录名称进入目录
   - 点击".."返回上级目录
   - 点击"Home"图标返回根目录

3. **上传文件**:
   - 点击"上传"按钮
   - 选择要上传的文件
   - 文件将上传到当前目录

4. **下载文件**:
   - 点击文件行的"下载"图标
   - 文件将自动下载到本地

5. **删除文件/目录**:
   - 点击文件行的"删除"图标
   - 确认删除操作

6. **创建目录**:
   - 点击"新建文件夹"按钮
   - 输入目录名称
   - 点击"创建"按钮

### SSH终端

1. **连接SSH终端**:
   - 进入服务器详情页
   - 切换到"SSH终端"标签页
   - 选择凭据
   - 点击"连接"按钮

2. **完整功能**:
   - 当前为基础框架
   - 完整功能需要安装 xterm.js:
     ```bash
     cd frontend
     npm install xterm xterm-addon-fit
     ```
   - 然后实现WebSocket连接和xterm.js集成

## 三、技术实现

### 后端技术栈
- **SSH连接**: paramiko库
- **SFTP文件操作**: paramiko.SFTPClient
- **WebSocket**: FastAPI WebSocket支持
- **连接池**: 内存中存储SSH连接

### 前端技术栈
- **文件管理**: React + TypeScript
- **SSH终端**: WebSocket（待集成xterm.js）
- **API调用**: Axios

## 四、API接口详情

### SSH终端WebSocket

**端点**: `WS /api/servers/{server_id}/ssh/terminal`

**查询参数**:
- `credential_id`: 凭据ID（必填）
- `token`: 认证token（必填）

**消息格式**:
- **输入**: `{"type": "input", "data": "命令或字符"}`
- **调整大小**: `{"type": "resize", "rows": 24, "cols": 80}`
- **关闭**: `{"type": "close"}`

**响应格式**:
- **连接成功**: `{"type": "connected", "message": "SSH终端已连接"}`
- **输出**: `{"type": "output", "data": "终端输出内容"}`
- **错误**: `{"type": "error", "message": "错误信息"}`

### 文件管理API

#### 1. 获取文件列表
```
GET /api/servers/{server_id}/files?path=/&credential_id=1
```

**响应**:
```json
{
  "path": "/",
  "files": [
    {
      "name": "file.txt",
      "path": "/file.txt",
      "type": "file",
      "size": 1024,
      "modified": 1705123456,
      "permissions": "644"
    }
  ]
}
```

#### 2. 上传文件
```
POST /api/servers/{server_id}/files/upload
Content-Type: multipart/form-data

file: File
path: string
credential_id: number
```

#### 3. 下载文件
```
GET /api/servers/{server_id}/files/download?path=/file.txt&credential_id=1
```

#### 4. 删除文件/目录
```
DELETE /api/servers/{server_id}/files?path=/file.txt&credential_id=1
```

#### 5. 创建目录
```
POST /api/servers/{server_id}/files/mkdir?path=/newdir&credential_id=1
```

## 五、注意事项

1. **凭据要求**:
   - 文件管理和SSH终端都需要选择有效的凭据
   - 凭据类型必须是 `password`（SSH密钥暂未完全支持）

2. **SSH连接**:
   - SSH连接会自动复用（连接池）
   - 连接会在一定时间后自动关闭
   - 可以通过断开接口手动关闭连接

3. **文件权限**:
   - 文件操作受服务器文件系统权限限制
   - 删除操作需要确认

4. **跳板机支持**:
   - 跳板机连接功能暂未实现
   - 如果服务器配置了跳板机，连接会失败

5. **SSH终端完整功能**:
   - 需要安装 xterm.js 库
   - 需要实现WebSocket消息处理
   - 需要实现终端大小调整

## 六、后续开发建议

### 优先级高
1. **完善SSH终端**:
   - 安装并集成 xterm.js
   - 实现完整的WebSocket消息处理
   - 支持终端大小调整
   - 支持颜色和样式

2. **跳板机支持**:
   - 实现SSH隧道连接
   - 支持通过跳板机访问服务器

3. **SSH密钥支持**:
   - 完善SSH密钥认证
   - 支持密钥文件上传和管理

### 优先级中
1. **文件编辑**:
   - 支持在线编辑文件
   - 支持文件内容查看

2. **批量操作**:
   - 支持批量上传
   - 支持批量删除
   - 支持文件移动和重命名

3. **文件搜索**:
   - 支持文件名搜索
   - 支持文件内容搜索

### 优先级低
1. **文件压缩/解压**:
   - 支持zip/tar压缩
   - 支持在线解压

2. **文件权限管理**:
   - 支持修改文件权限
   - 支持修改文件所有者

3. **文件历史**:
   - 记录文件操作历史
   - 支持文件版本管理

## 七、安装依赖

### 后端依赖
后端依赖已包含在 `requirements.txt` 中：
- `paramiko>=3.4.0` - SSH连接库

### 前端依赖（SSH终端完整功能）
```bash
cd frontend
npm install xterm xterm-addon-fit
npm install --save-dev @types/xterm
```

## 八、测试建议

1. **文件管理测试**:
   - 测试文件列表加载
   - 测试文件上传和下载
   - 测试目录创建和删除
   - 测试大文件上传

2. **SSH终端测试**:
   - 测试SSH连接建立
   - 测试命令执行
   - 测试终端大小调整
   - 测试连接断开

3. **错误处理测试**:
   - 测试无效凭据
   - 测试网络错误
   - 测试权限错误
   - 测试文件不存在错误
