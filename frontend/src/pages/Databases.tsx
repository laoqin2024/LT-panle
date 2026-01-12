import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database as DatabaseIcon, Plus, Terminal, Settings, Trash2, Activity, HardDrive, Filter, X } from 'lucide-react'
import { getDatabases, deleteDatabase, createDatabase, updateDatabase, type Database, type DatabaseCreate, type DatabaseUpdate } from '../services/databases'
import { getServers, type Server } from '../services/servers'
import Loading from '../components/Loading'

export default function Databases() {
  const navigate = useNavigate()
  const [databases, setDatabases] = useState<Database[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [dbTypeFilter, setDbTypeFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDatabase, setEditingDatabase] = useState<Database | null>(null)
  const [allServers, setAllServers] = useState<Server[]>([]) // 用于跳板机选择

  // 加载数据
  useEffect(() => {
    loadData()
  }, [statusFilter, dbTypeFilter, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getDatabases({
        status: statusFilter || undefined,
        db_type: dbTypeFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      })

      setDatabases(response.items)
      
      // 同时加载所有服务器用于跳板机选择
      try {
        const serversResponse = await getServers({ limit: 1000 })
        setAllServers(serversResponse.items)
      } catch (e) {
        console.error('加载服务器列表失败:', e)
      }
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
      console.error('加载数据库数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (databaseId: number) => {
    if (!window.confirm('确定要删除这个数据库连接吗？')) {
      return
    }

    try {
      await deleteDatabase(databaseId)
      // 重新加载数据
      loadData()
    } catch (err: any) {
      let errorMessage = '删除失败'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      alert(errorMessage)
      console.error('删除数据库失败:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'offline':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PostgreSQL':
        return 'bg-blue-100 text-blue-700'
      case 'MySQL':
        return 'bg-orange-100 text-orange-700'
      case 'SQL Server':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线'
      case 'warning':
        return '告警'
      case 'offline':
        return '离线'
      default:
        return '未知'
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadData} className="btn-primary">
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">数据库管理</h1>
          <p className="text-gray-600 mt-1">管理和监控数据库连接</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingDatabase(null)
            setShowForm(true)
          }}
        >
          <Plus className="w-5 h-5" />
          添加数据库
        </button>
      </div>

      {/* 筛选和搜索 */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 状态筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">状态:</span>
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="online">在线</option>
              <option value="offline">离线</option>
              <option value="warning">告警</option>
              <option value="unknown">未知</option>
            </select>
          </div>

          {/* 数据库类型筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">类型:</span>
            <select
              value={dbTypeFilter || ''}
              onChange={(e) => setDbTypeFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="PostgreSQL">PostgreSQL</option>
              <option value="MySQL">MySQL</option>
              <option value="SQL Server">SQL Server</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索数据库名称或主机..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 数据库列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {databases.map((db) => (
          <div key={db.id} className="card hover:shadow-lg transition-shadow">
            {/* 数据库头部 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <DatabaseIcon className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-900">{db.name}</h3>
                </div>
                <p className="text-sm text-gray-500">{db.host}:{db.port}</p>
                <p className="text-xs text-gray-400 mt-1">数据库: {db.database}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(db.type)}`}>
                    {db.type}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(db.status)} text-white`}>
                    {getStatusText(db.status)}
                  </span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(db.status)}`}></div>
            </div>

            {/* 数据库信息 */}
            <div className="space-y-2 mb-4">
              {db.network_type !== 'direct' && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">网络类型</span>
                  <span className="text-sm font-medium text-gray-900">
                    {db.network_type === 'jump' ? '跳板机' : 
                     db.network_type === 'vpn' ? 'VPN' : 
                     db.network_type === 'tunnel' ? '内网穿透' : db.network_type}
                  </span>
                </div>
              )}
              {db.jump_host && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">跳板机</span>
                  <span className="text-sm font-medium text-gray-900">{db.jump_host.name}</span>
                </div>
              )}
              {db.description && (
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{db.description}</p>
                </div>
              )}
              {db.last_check && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">最后检查</span>
                  <span className="text-xs font-medium text-gray-500">
                    {new Date(db.last_check).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button 
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                onClick={() => navigate(`/databases/${db.id}`)}
              >
                <Terminal className="w-4 h-4" />
                查看详情
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => {
                  setEditingDatabase(db)
                  setShowForm(true)
                }}
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleDelete(db.id)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {databases.length === 0 && (
        <div className="card text-center py-12">
          <DatabaseIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的数据库</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingDatabase(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个数据库
          </button>
        </div>
      )}

      {/* 数据库添加/编辑表单 */}
      {showForm && (
        <DatabaseForm
          database={editingDatabase}
          allServers={allServers}
          onClose={() => {
            setShowForm(false)
            setEditingDatabase(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingDatabase(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 数据库表单组件
function DatabaseForm({
  database,
  allServers,
  onClose,
  onSuccess
}: {
  database: Database | null
  allServers: Server[]
  onClose: () => void
  onSuccess: () => void
}) {
  // 根据数据库类型获取默认端口
  const getDefaultPort = (type: string) => {
    switch (type) {
      case 'PostgreSQL':
        return 5432
      case 'MySQL':
        return 3306
      case 'SQL Server':
        return 1433
      case 'Oracle':
        return 1521
      case 'MongoDB':
        return 27017
      case 'Redis':
        return 6379
      default:
        return 5432
    }
  }

  const [formData, setFormData] = useState({
    name: database?.name || '',
    type: database?.type || 'PostgreSQL',
    host: database?.host || '',
    port: database?.port || getDefaultPort(database?.type || 'PostgreSQL'),
    database: database?.database || '',
    network_type: database?.network_type || 'direct',
    jump_host_id: database?.jump_host_id || undefined,
    description: database?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 当数据库类型改变时，更新默认端口
  const handleTypeChange = (type: string) => {
    setFormData({
      ...formData,
      type,
      port: getDefaultPort(type),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('数据库名称不能为空')
        return
      }
      if (!formData.type.trim()) {
        setError('数据库类型不能为空')
        return
      }
      if (!formData.host.trim()) {
        setError('主机地址不能为空')
        return
      }
      if (!formData.database.trim()) {
        setError('数据库名不能为空')
        return
      }
      if (formData.port < 1 || formData.port > 65535) {
        setError('端口号必须在1-65535之间')
        return
      }
      if (formData.network_type === 'jump' && !formData.jump_host_id) {
        setError('使用跳板机时必须选择跳板机')
        return
      }

      if (database) {
        // 更新数据库
        const updateData: DatabaseUpdate = {
          name: formData.name,
          type: formData.type,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          description: formData.description || undefined,
        }
        await updateDatabase(database.id, updateData)
      } else {
        // 创建数据库
        const createData: DatabaseCreate = {
          name: formData.name,
          type: formData.type,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          description: formData.description || undefined,
        }
        await createDatabase(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = database ? '更新失败' : '创建失败'
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
      console.error('保存数据库失败:', err)
    } finally {
      setSaving(false)
    }
  }

  // 过滤出可以作为跳板机的服务器
  const availableJumpHosts = allServers.filter(s => !database || s.id !== database.jump_host_id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {database ? '编辑数据库连接' : '添加数据库连接'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              连接名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入连接名称"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                数据库类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MySQL">MySQL</option>
                <option value="SQL Server">SQL Server</option>
                <option value="Oracle">Oracle</option>
                <option value="MongoDB">MongoDB</option>
                <option value="Redis">Redis</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                端口号 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || getDefaultPort(formData.type) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min={1}
                max={65535}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                主机地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="192.168.1.100 或 example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                数据库名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="数据库名称"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                网络类型
              </label>
              <select
                value={formData.network_type}
                onChange={(e) => setFormData({ ...formData, network_type: e.target.value, jump_host_id: e.target.value !== 'jump' ? undefined : formData.jump_host_id })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="direct">直连</option>
                <option value="jump">跳板机</option>
                <option value="vpn">VPN</option>
                <option value="tunnel">内网穿透</option>
              </select>
            </div>

            {formData.network_type === 'jump' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  跳板机 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.jump_host_id || ''}
                  onChange={(e) => setFormData({ ...formData, jump_host_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required={formData.network_type === 'jump'}
                >
                  <option value="">请选择跳板机</option>
                  {availableJumpHosts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.host}:{s.port})
                    </option>
                  ))}
                </select>
                {availableJumpHosts.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">没有可用的跳板机，请先添加服务器</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="请输入数据库描述（可选）"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2"
              disabled={saving}
            >
              {saving ? '保存中...' : database ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

