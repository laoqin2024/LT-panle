# Laoqin Panel 前端项目

## 快速开始

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看页面

### 构建生产版本

```bash
npm run build
```

## 页面说明

### 1. 登录页面 (`/login`)
- 渐变背景设计
- 毛玻璃效果卡片
- 用户名和密码输入
- 记住我功能

### 2. 主面板 (`/dashboard`)
- 系统统计卡片（服务器、设备、数据库数量）
- 系统状态监控（CPU、内存、磁盘）
- 最近活动列表
- 快速操作入口

### 3. 服务器管理 (`/servers`)
- 服务器卡片列表
- 实时资源监控（CPU、内存、磁盘）
- 状态指示器
- SSH连接按钮

### 4. 网络设备管理 (`/devices`)
- 华为交换机设备卡片
- 接口状态显示
- 设备性能指标
- 连接协议标识（SSH/Telnet）

### 5. 数据库管理 (`/databases`)
- 数据库连接卡片
- 数据库大小和连接数
- 查询统计
- SQL编辑器入口

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide Icons

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 公共组件
│   │   └── Layout.tsx  # 主布局组件
│   ├── pages/          # 页面组件
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Servers.tsx
│   │   ├── Devices.tsx
│   │   └── Databases.tsx
│   ├── App.tsx         # 路由配置
│   ├── main.tsx        # 入口文件
│   └── index.css       # 全局样式
├── package.json
└── vite.config.ts
```

## 注意事项

- 当前页面使用模拟数据，后续需要接入真实API
- 登录功能暂时直接跳转，需要实现真实的认证逻辑
- 所有按钮功能需要后续实现

