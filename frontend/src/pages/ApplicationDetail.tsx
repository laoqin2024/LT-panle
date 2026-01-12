import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Activity, 
  ArrowLeft, 
  FileText, 
  Settings,
  RefreshCw,
  Play,
  Square
} from 'lucide-react'

export default function ApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('status')

  // 模拟应用数据
  const application = {
    id: id,
    name: 'Web应用服务',
    site: '官网首页',
    type: 'Web服务',
    status: 'running',
    port: 8080,
    process: 'nginx',
    pid: 12345,
    uptime: '15天 3小时',
    memory: 256,
    cpu: 12,
    config: '/etc/nginx/nginx.conf',
  }

  const tabs = [
    { id: 'status', label: '状态', icon: Activity },
    { id: 'logs', label: '日志', icon: FileText },
    { id: 'config', label: '配置', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/applications')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{application.name}</h1>
            <p className="text-gray-600 mt-1">{application.site} · {application.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          {application.status === 'running' ? (
            <button className="btn-secondary flex items-center gap-2 text-red-600">
              <Square className="w-4 h-4" />
              停止
            </button>
          ) : (
            <button className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" />
              启动
            </button>
          )}
          <div className={`w-3 h-3 rounded-full ${application.status === 'running' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {application.status === 'running' ? '运行中' : '已停止'}
          </span>
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
        {activeTab === 'status' && (
          <div className="space-y-6">
            {/* 状态指标 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">进程ID</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{application.pid}</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">端口</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{application.port}</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">内存使用</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{application.memory} MB</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">CPU使用</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{application.cpu}%</p>
              </div>
            </div>

            {/* 运行信息 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">运行信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">运行时间</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{application.uptime}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">进程名称</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{application.process}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">配置文件</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{application.config}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">状态</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${
                        application.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {application.status === 'running' ? '运行中' : '已停止'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">应用日志</h3>
              <button className="btn-secondary text-sm">刷新</button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-96 overflow-auto">
              <div className="text-gray-300 space-y-1">
                <div>2024-01-15 10:30:25 [INFO] Application started</div>
                <div>2024-01-15 10:30:26 [INFO] Listening on port 8080</div>
                <div>2024-01-15 10:30:30 [INFO] Request: GET /api/health</div>
                <div>2024-01-15 10:30:31 [INFO] Response: 200 OK</div>
                <div>2024-01-15 10:30:35 [INFO] Request: GET /api/users</div>
                <div>2024-01-15 10:30:36 [INFO] Response: 200 OK</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">配置文件</h3>
              <button className="btn-primary text-sm">保存</button>
            </div>
            <div className="border border-gray-200 rounded-lg">
              <textarea
                className="w-full p-4 font-mono text-sm focus:outline-none resize-none"
                rows={15}
                defaultValue={`server {
    listen 8080;
    server_name example.com;
    
    location / {
        root /var/www/html;
        index index.html;
    }
}`}
              ></textarea>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

