import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Database, 
  ArrowLeft, 
  Terminal, 
  Table, 
  Users, 
  HardDrive,
  Info,
  RefreshCw,
  Save,
  Key
} from 'lucide-react'
import CredentialSelector from '../components/CredentialSelector'

export default function DatabaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('monitor')

  // 模拟数据库数据
  const database = {
    id: id,
    name: '生产数据库',
    type: 'PostgreSQL',
    host: '192.168.1.200',
    port: 5432,
    database: 'production',
    status: 'online',
    size: '45.2 GB',
    tables: 128,
    connections: { current: 12, max: 100 },
    queries: 156,
    slowQueries: 3,
  }

  const tabs = [
    { id: 'monitor', label: '监控', icon: HardDrive },
    { id: 'sql', label: 'SQL编辑器', icon: Terminal },
    { id: 'tables', label: '表管理', icon: Table },
    { id: 'users', label: '用户权限', icon: Users },
    { id: 'credentials', label: '凭据管理', icon: Key },
    { id: 'info', label: '数据库信息', icon: Info },
  ]

  // 模拟凭据数据
  const credentials = [
    { id: 1, username: 'postgres', description: 'PostgreSQL密码', credentialType: 'password' as const },
    { id: 2, username: 'admin', description: '管理员密码', credentialType: 'password' as const },
  ]
  const [selectedCredential, setSelectedCredential] = useState<number | undefined>(credentials[0]?.id)

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/databases')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{database.name}</h1>
            <p className="text-gray-600 mt-1">{database.host}:{database.port} · {database.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <div className={`w-3 h-3 rounded-full ${database.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{database.status === 'online' ? '在线' : '离线'}</span>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div className="mt-6">
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* 监控指标 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">数据库大小</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{database.size}</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">表数量</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{database.tables}</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">连接数</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {database.connections.current} / {database.connections.max}
                </p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">查询数/分钟</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{database.queries}</p>
              </div>
            </div>

            {/* 连接数监控 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">连接数使用率</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">当前连接</span>
                  <span className="text-sm font-medium text-gray-900">
                    {database.connections.current} / {database.connections.max}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      (database.connections.current / database.connections.max) > 0.8
                        ? 'bg-red-500'
                        : (database.connections.current / database.connections.max) > 0.6
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${(database.connections.current / database.connections.max) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  使用率: {((database.connections.current / database.connections.max) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* 慢查询 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">慢查询</h3>
                <span className="text-sm text-yellow-600">{database.slowQueries} 个慢查询</span>
              </div>
              <div className="text-sm text-gray-500">
                慢查询列表（待实现）
              </div>
            </div>

            {/* 监控图表 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">性能趋势</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">监控图表（待集成 ECharts）</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">SQL编辑器</h3>
              <div className="flex items-center gap-2">
                <div className="w-64">
                  <CredentialSelector
                    credentials={credentials}
                    selectedId={selectedCredential}
                    onSelect={setSelectedCredential}
                    onUse={(credId) => {
                      console.log('使用凭据连接数据库:', credId)
                    }}
                  />
                </div>
                <button className="btn-secondary text-sm flex items-center gap-1">
                  <Save className="w-4 h-4" />
                  保存
                </button>
                <button className="btn-primary text-sm">执行</button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg">
                <textarea
                  className="w-full p-4 font-mono text-sm focus:outline-none resize-none"
                  rows={10}
                  placeholder="输入SQL查询..."
                  defaultValue="SELECT * FROM users LIMIT 10;"
                ></textarea>
              </div>
              <div className="border border-gray-200 rounded-lg">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm text-gray-600">查询结果</span>
                </div>
                <div className="p-4">
                  <div className="text-sm text-gray-500 text-center py-8">
                    SQL执行结果（待实现）
                    <br />
                    <span className="text-xs">需要集成SQL执行和结果展示功能</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">表列表</h3>
              <input
                type="text"
                placeholder="搜索表名..."
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">表名</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">行数</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">大小</th>
                    <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'users', rows: 1250, size: '2.5 MB' },
                    { name: 'orders', rows: 5432, size: '12.3 MB' },
                    { name: 'products', rows: 890, size: '1.8 MB' },
                  ].map((table, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-4 text-sm text-gray-900">{table.name}</td>
                      <td className="py-2 px-4 text-sm text-gray-600 text-right">{table.rows.toLocaleString()}</td>
                      <td className="py-2 px-4 text-sm text-gray-600 text-right">{table.size}</td>
                      <td className="py-2 px-4 text-center">
                        <button className="text-sm text-primary-600 hover:text-primary-700">查看</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">用户权限</h3>
              <button className="btn-primary text-sm">添加用户</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">用户名</th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">角色</th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">权限</th>
                    <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'admin', role: 'superuser', permissions: 'ALL' },
                    { name: 'app_user', role: 'user', permissions: 'SELECT, INSERT, UPDATE' },
                    { name: 'readonly', role: 'user', permissions: 'SELECT' },
                  ].map((user, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-4 text-sm text-gray-900">{user.name}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">{user.role}</td>
                      <td className="py-2 px-4 text-sm text-gray-600">{user.permissions}</td>
                      <td className="py-2 px-4 text-center">
                        <button className="text-sm text-primary-600 hover:text-primary-700">编辑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">凭据管理</h3>
                <button className="btn-primary text-sm">添加凭据</button>
              </div>
              <div className="space-y-4">
                {credentials.map((cred) => (
                  <div key={cred.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{cred.username}</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            密码
                          </span>
                        </div>
                        {cred.description && (
                          <p className="text-sm text-gray-600 mt-1">{cred.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-secondary text-sm">查看</button>
                        <button className="btn-secondary text-sm">编辑</button>
                        <button className="text-sm text-red-600 hover:text-red-700">删除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">数据库信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">数据库名称</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">数据库类型</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.type}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">主机地址</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.host}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">端口</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.port}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">数据库大小</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.size}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">表数量</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{database.tables}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">连接数</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {database.connections.current} / {database.connections.max}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      database.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {database.status === 'online' ? '在线' : '离线'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

