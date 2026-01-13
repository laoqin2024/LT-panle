import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Server, 
  Network, 
  Database,
  Globe,
  Activity,
  Key,
  HardDrive,
  Settings,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/sites', icon: Globe, label: '业务站点' },
  { path: '/servers', icon: Server, label: '服务器' },
  { path: '/devices', icon: Network, label: '网络设备' },
  { path: '/databases', icon: Database, label: '数据库' },
  { path: '/applications', icon: Activity, label: '应用管理' },
  { path: '/credentials', icon: Key, label: '密码管理' },
  { path: '/backup', icon: HardDrive, label: '备份恢复' },
  { path: '/network', icon: Network, label: '网络配置' },
  { path: '/users', icon: Users, label: '用户管理' },
  { path: '/logs', icon: FileText, label: '操作日志' },
  { path: '/settings', icon: Settings, label: '系统设置' },
]

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold text-primary-600">Laoqin Panel</h1>
          ) : (
            <div className="w-8 h-8 bg-primary-600 rounded-lg"></div>
          )}
        </div>

        {/* 菜单 */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* 用户信息 */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.username || 'Admin'}</p>
                <p className="text-xs text-gray-500">{user?.role === 'admin' ? '管理员' : '用户'}</p>
              </div>
            )}
            <button
              onClick={() => {
                logout()
                window.location.href = '/login'
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="退出登录"
            >
              <LogOut className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {new Date().toLocaleString('zh-CN')}
            </span>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

