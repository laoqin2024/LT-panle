import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server as ServerIcon, Plus, Terminal, Settings, Trash2, Activity, Cpu, HardDrive, Filter, X, RefreshCw, CheckSquare, Square } from 'lucide-react'
import { getServers, deleteServer, createServer, updateServer, checkServerStatus, batchCheckServerStatus, batchDeleteServers, type Server, type ServerCreate, type ServerUpdate } from '../services/servers'
import { getCredentials } from '../services/credentials'
import CredentialSelector from '../components/CredentialSelector'
import Loading from '../components/Loading'

export default function Servers() {
  const navigate = useNavigate()
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [serverTypeFilter, setServerTypeFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [allServers, setAllServers] = useState<Server[]>([]) // 用于跳板机选择
  const [selectedServers, setSelectedServers] = useState<Set<number>>(new Set()) // 选中的服务器
  const [checkingStatus, setCheckingStatus] = useState<Set<number>>(new Set()) // 正在检测状态的服务器
  const [batchOperating, setBatchOperating] = useState(false) // 批量操作中

  // 加载数据
  useEffect(() => {
    loadData()
  }, [statusFilter, serverTypeFilter, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getServers({
        status: statusFilter || undefined,
        server_type: serverTypeFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      })

      setServers(response.items)
      
      // 同时加载所有服务器用于跳板机选择
      const allServersResponse = await getServers({ limit: 1000 })
      setAllServers(allServersResponse.items)
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
      console.error('加载服务器数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (serverId: number) => {
    if (!window.confirm('确定要删除这个服务器吗？')) {
      return
    }

    try {
      await deleteServer(serverId)
      // 重新加载数据
      loadData()
      // 从选中列表中移除
      setSelectedServers(prev => {
        const newSet = new Set(prev)
        newSet.delete(serverId)
        return newSet
      })
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
      console.error('删除服务器失败:', err)
    }
  }

  const handleCheckStatus = async (serverId: number) => {
    setCheckingStatus(prev => new Set(prev).add(serverId))
    try {
      const result = await checkServerStatus(serverId)
      alert(result.message || '状态检测完成')
      loadData()
    } catch (err: any) {
      let errorMessage = '状态检测失败'
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
      console.error('状态检测失败:', err)
    } finally {
      setCheckingStatus(prev => {
        const newSet = new Set(prev)
        newSet.delete(serverId)
        return newSet
      })
    }
  }

  const handleBatchCheckStatus = async () => {
    if (selectedServers.size === 0) {
      alert('请先选择要检测的服务器')
      return
    }
    
    setBatchOperating(true)
    try {
      const result = await batchCheckServerStatus(Array.from(selectedServers))
      alert(result.message)
      loadData()
      setSelectedServers(new Set())
    } catch (err: any) {
      alert(err.response?.data?.detail || '批量检测失败')
    } finally {
      setBatchOperating(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedServers.size === 0) {
      alert('请先选择要删除的服务器')
      return
    }
    
    if (!window.confirm(`确定要删除选中的 ${selectedServers.size} 台服务器吗？此操作不可恢复！`)) {
      return
    }
    
    setBatchOperating(true)
    try {
      await batchDeleteServers(Array.from(selectedServers))
      alert('批量删除成功')
      loadData()
      setSelectedServers(new Set())
    } catch (err: any) {
      alert(err.response?.data?.detail || '批量删除失败')
    } finally {
      setBatchOperating(false)
    }
  }

  const toggleSelectServer = (serverId: number) => {
    setSelectedServers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(serverId)) {
        newSet.delete(serverId)
      } else {
        newSet.add(serverId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedServers.size === servers.length) {
      setSelectedServers(new Set())
    } else {
      setSelectedServers(new Set(servers.map(s => s.id)))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'offline':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线'
      case 'offline':
        return '离线'
      case 'warning':
        return '异常'
      default:
        return '未知'
    }
  }

  const getOSInfo = (osInfo?: Record<string, any>) => {
    if (!osInfo) return '未知'
    // 兼容旧结构（name/distribution）和新结构（os.name）
    const directName = (osInfo as any).name || (osInfo as any).distribution
    const nestedName = (osInfo as any).os?.name || (osInfo as any).os?.distribution
    const pretty = (osInfo as any).os?.pretty_name
    return directName || nestedName || pretty || '未知'
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
          <h1 className="text-3xl font-bold text-gray-900">服务器管理</h1>
          <p className="text-gray-600 mt-1">管理和监控服务器资源</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedServers.size > 0 && (
            <>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={handleBatchCheckStatus}
                disabled={batchOperating}
              >
                <RefreshCw className={`w-4 h-4 ${batchOperating ? 'animate-spin' : ''}`} />
                检测状态 ({selectedServers.size})
              </button>
              <button
                className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50"
                onClick={handleBatchDelete}
                disabled={batchOperating}
              >
                <Trash2 className="w-4 h-4" />
                批量删除 ({selectedServers.size})
              </button>
            </>
          )}
          <button 
            className="btn-primary flex items-center gap-2"
            onClick={() => {
              setEditingServer(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加服务器
          </button>
        </div>
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
              <option value="warning">异常</option>
              <option value="unknown">未知</option>
            </select>
          </div>

          {/* 服务器类型筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">类型:</span>
            <select
              value={serverTypeFilter || ''}
              onChange={(e) => setServerTypeFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="Linux">Linux</option>
              <option value="Windows">Windows</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索服务器名称或主机..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 批量操作栏 */}
      {servers.length > 0 && (
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title={selectedServers.size === servers.length ? '取消全选' : '全选'}
            >
              {selectedServers.size === servers.length ? (
                <CheckSquare className="w-5 h-5 text-primary-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <span className="text-sm text-gray-600">
              {selectedServers.size > 0 ? `已选择 ${selectedServers.size} 台服务器` : '选择服务器进行批量操作'}
            </span>
          </div>
          <button
            onClick={loadData}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新列表
          </button>
        </div>
      )}

      {/* 服务器列表 */}
      {servers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div key={server.id} className={`card hover:shadow-lg transition-shadow ${selectedServers.has(server.id) ? 'ring-2 ring-primary-500' : ''}`}>
              {/* 服务器头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => toggleSelectServer(server.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {selectedServers.has(server.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ServerIcon className="w-5 h-5 text-gray-600" />
                      <h3 className="text-lg font-bold text-gray-900">{server.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{server.host}:{server.port || 22}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {server.server_type && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {server.server_type}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {getOSInfo(server.os_info)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(server.status)} text-white`}>
                        {getStatusText(server.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`}></div>
              </div>

              {/* 服务器信息 */}
              <div className="space-y-2 mb-4">
                {server.network_type !== 'direct' && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">网络类型</span>
                    <span className="text-sm font-medium text-gray-900">
                      {server.network_type === 'jump' ? '跳板机' : 
                       server.network_type === 'vpn' ? 'VPN' : 
                       server.network_type === 'tunnel' ? '内网穿透' : (server.network_type || '未知')}
                    </span>
                  </div>
                )}
                {server.jump_host && (
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">跳板机</span>
                    <span className="text-sm font-medium text-gray-900">{server.jump_host.name}</span>
                  </div>
                )}
                {server.description && (
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">{server.description}</p>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button 
                  className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                  onClick={() => navigate(`/servers/${server.id}`)}
                >
                  <Terminal className="w-4 h-4" />
                  查看详情
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  onClick={() => handleCheckStatus(server.id)}
                  disabled={checkingStatus.has(server.id)}
                  title="检测状态"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 ${checkingStatus.has(server.id) ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  onClick={() => {
                    setEditingServer(server)
                    setShowForm(true)
                  }}
                  title="编辑"
                >
                  <Settings className="w-4 h-4 text-gray-600" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  onClick={() => handleDelete(server.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 空状态 */}
      {servers.length === 0 && (
        <div className="card text-center py-12">
          <ServerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的服务器</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingServer(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个服务器
          </button>
        </div>
      )}

      {/* 服务器添加/编辑表单 */}
      {showForm && (
        <ServerForm
          server={editingServer}
          allServers={allServers}
          onClose={() => {
            setShowForm(false)
            setEditingServer(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingServer(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 服务器表单组件
function ServerForm({
  server,
  allServers,
  onClose,
  onSuccess
}: {
  server: Server | null
  allServers: Server[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 22,
    server_type: server?.server_type || '',
    network_type: server?.network_type || 'direct',
    jump_host_id: server?.jump_host_id || undefined,
    default_credential_id: server?.default_credential_id || undefined,
    description: server?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<any[]>([])
  
  // 加载凭据列表
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await getCredentials()
        // getCredentials 返回 CredentialListResponse，包含 items 属性
        setCredentials(Array.isArray(response?.items) ? response.items : [])
      } catch (err) {
        console.error('加载凭据列表失败:', err)
        setCredentials([]) // 出错时设置为空数组
      }
    }
    loadCredentials()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('服务器名称不能为空')
        return
      }
      if (!formData.host.trim()) {
        setError('主机地址不能为空')
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

      if (server) {
        // 更新服务器
        const updateData: ServerUpdate = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          server_type: formData.server_type || undefined,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          default_credential_id: formData.default_credential_id,
          description: formData.description || undefined,
        }
        await updateServer(server.id, updateData)
      } else {
        // 创建服务器
        const createData: ServerCreate = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          server_type: formData.server_type || undefined,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          default_credential_id: formData.default_credential_id,
          description: formData.description || undefined,
        }
        await createServer(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = server ? '更新失败' : '创建失败'
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
      console.error('保存服务器失败:', err)
    } finally {
      setSaving(false)
    }
  }

  // 过滤出可以作为跳板机的服务器（排除当前编辑的服务器）
  const availableJumpHosts = allServers.filter(s => !server || s.id !== server.id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {server ? '编辑服务器' : '添加服务器'}
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
              服务器名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入服务器名称"
              required
            />
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
                端口号
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="22"
                min={1}
                max={65535}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                服务器类型
              </label>
              <select
                value={formData.server_type}
                onChange={(e) => setFormData({ ...formData, server_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择</option>
                <option value="Linux">Linux</option>
                <option value="Windows">Windows</option>
                <option value="Unix">Unix</option>
                <option value="MacOS">MacOS</option>
              </select>
            </div>

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
                <p className="text-xs text-gray-500 mt-1">没有可用的跳板机，请先添加其他服务器</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              默认凭据
            </label>
            <div className="space-y-2">
              <select
                value={formData.default_credential_id || ''}
                onChange={(e) => setFormData({ ...formData, default_credential_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">不设置默认凭据</option>
                {Array.isArray(credentials) && credentials.map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.username} - {cred.description || '无描述'} ({cred.credential_type === 'password' ? '密码' : 'SSH密钥'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                设置默认凭据后，在文件管理、SSH终端等功能中会自动选择此凭据
              </p>
            </div>
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
              placeholder="请输入服务器描述（可选）"
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
              {saving ? '保存中...' : server ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

