import { useState, useEffect } from 'react'
import { 
  FileText, 
  Search, 
  Filter,
  Calendar,
  User,
  Activity,
  Server,
  Database,
  Network,
  Globe
} from 'lucide-react'
import { 
  getOperationLogs, 
  getLogStats,
  type OperationLog,
  type LogStats
} from '../services/logs'
import Loading from '../components/Loading'

const RESOURCE_ICONS: Record<string, any> = {
  server: Server,
  device: Network,
  database: Database,
  site: Globe,
  application: Activity,
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  view: 'bg-gray-100 text-gray-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
}

export default function OperationLogs() {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    resource_type: '',
    start_time: '',
    end_time: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadData()
    loadStats()
  }, [currentPage, filters])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params: any = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      }

      if (filters.search) {
        params.search = filters.search
      }
      if (filters.action) {
        params.action = filters.action
      }
      if (filters.resource_type) {
        params.resource_type = filters.resource_type
      }
      if (filters.start_time) {
        params.start_time = new Date(filters.start_time).toISOString()
      }
      if (filters.end_time) {
        params.end_time = new Date(filters.end_time).toISOString()
      }

      const response = await getOperationLogs(params)
      setLogs(response.items)
      setTotal(response.total)
    } catch (err: any) {
      let errorMessage = '加载数据失败'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
      console.error('加载操作日志失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const params: any = {}
      if (filters.start_time) {
        params.start_time = new Date(filters.start_time).toISOString()
      }
      if (filters.end_time) {
        params.end_time = new Date(filters.end_time).toISOString()
      }
      const statsData = await getLogStats(params)
      setStats(statsData)
    } catch (err) {
      console.error('加载统计信息失败:', err)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
    setCurrentPage(1) // 重置到第一页
  }

  const getActionColor = (action: string): string => {
    const actionLower = action.toLowerCase()
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (actionLower.includes(key)) {
        return color
      }
    }
    return 'bg-gray-100 text-gray-800'
  }

  const getResourceIcon = (resourceType?: string) => {
    if (!resourceType) return Activity
    return RESOURCE_ICONS[resourceType] || Activity
  }

  if (loading && logs.length === 0) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">操作日志</h1>
        <p className="text-gray-600 mt-1">查看系统操作记录和审计日志</p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总日志数</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">操作类型</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {Object.keys(stats.action_stats).length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">资源类型</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {Object.keys(stats.resource_stats).length}
                </p>
              </div>
              <Server className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">活跃用户</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {Object.keys(stats.user_stats).length}
                </p>
              </div>
              <User className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索操作类型、详情..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">所有操作</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
              <option value="view">查看</option>
              <option value="login">登录</option>
              <option value="logout">登出</option>
            </select>
          </div>
          <div>
            <select
              value={filters.resource_type}
              onChange={(e) => handleFilterChange('resource_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">所有资源</option>
              <option value="server">服务器</option>
              <option value="device">网络设备</option>
              <option value="database">数据库</option>
              <option value="site">业务站点</option>
              <option value="application">应用</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.start_time}
              onChange={(e) => handleFilterChange('start_time', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="开始时间"
            />
            <input
              type="date"
              value={filters.end_time}
              onChange={(e) => handleFilterChange('end_time', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="结束时间"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 日志列表 */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">时间</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">用户</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">操作</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">资源</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">IP地址</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const ResourceIcon = getResourceIcon(log.resource_type)
                return (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{log.username || `用户#${log.user_id}`}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {log.resource_type ? (
                        <div className="flex items-center gap-2">
                          <ResourceIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {log.resource_type}
                            {log.resource_id && ` #${log.resource_id}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {log.ip_address || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {log.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-sm text-blue-600 hover:text-blue-800">
                            查看详情
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                            {log.details}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>暂无操作日志</p>
            </div>
          )}
        </div>

        {/* 分页 */}
        {total > pageSize && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              共 {total} 条记录，第 {currentPage} / {Math.ceil(total / pageSize)} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(total / pageSize)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
