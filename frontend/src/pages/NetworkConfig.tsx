import { useState, useEffect } from 'react'
import { 
  Network, 
  Plus, 
  Settings, 
  Trash2, 
  Server,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react'
import { getJumpHosts, getVPNConfigs, createVPNConfig, deleteVPNConfig, getTunnelConfigs, createTunnelConfig, deleteTunnelConfig, type JumpHost, type VPNConfig, type TunnelConfig } from '../services/network'
import Loading from '../components/Loading'

export default function NetworkConfig() {
  const [jumpHosts, setJumpHosts] = useState<JumpHost[]>([])
  const [vpnConfigs, setVPNConfigs] = useState<VPNConfig[]>([])
  const [tunnelConfigs, setTunnelConfigs] = useState<TunnelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('jump')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showVPNModal, setShowVPNModal] = useState(false)
  const [showTunnelModal, setShowTunnelModal] = useState(false)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [selectedTab])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (selectedTab === 'jump') {
        const response = await getJumpHosts()
        setJumpHosts(response.items)
      } else if (selectedTab === 'vpn') {
        const response = await getVPNConfigs({ limit: 100 })
        setVPNConfigs(response.items)
      } else if (selectedTab === 'tunnel') {
        const response = await getTunnelConfigs({ limit: 100 })
        setTunnelConfigs(response.items)
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
      console.error('加载网络配置数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVPN = async (configId: number) => {
    if (!window.confirm('确定要删除这个VPN配置吗？')) {
      return
    }

    try {
      await deleteVPNConfig(configId)
      await loadData()
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
      console.error('删除VPN配置失败:', err)
    }
  }

  const handleDeleteTunnel = async (configId: number) => {
    if (!window.confirm('确定要删除这个内网穿透配置吗？')) {
      return
    }

    try {
      await deleteTunnelConfig(configId)
      await loadData()
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
      console.error('删除内网穿透配置失败:', err)
    }
  }

  const getStatusColor = (status: string) => {
    return status === 'online' || status === 'connected' 
      ? 'bg-green-500' 
      : status === 'offline' || status === 'disconnected'
      ? 'bg-red-500'
      : 'bg-gray-500'
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return '在线'
      case 'offline':
      case 'disconnected':
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
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">网络配置</h1>
          <p className="text-gray-600 mt-1">配置跳板机和VPN连接，用于访问内网设备</p>
        </div>
        {selectedTab === 'vpn' && (
          <button
            onClick={() => setShowVPNModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            添加VPN配置
          </button>
        )}
        {selectedTab === 'tunnel' && (
          <button
            onClick={() => setShowTunnelModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            添加内网穿透配置
          </button>
        )}
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setSelectedTab('jump')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'jump'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            跳板机配置
          </button>
          <button
            onClick={() => setSelectedTab('vpn')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'vpn'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            VPN配置
          </button>
          <button
            onClick={() => setSelectedTab('tunnel')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'tunnel'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            内网穿透
          </button>
        </nav>
      </div>

      {/* 跳板机配置 */}
      {selectedTab === 'jump' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">跳板机列表</h3>
            <p className="text-sm text-gray-600 mb-4">
              跳板机通过服务器管理模块添加。这里显示所有可用作跳板机的服务器。
            </p>
            <div className="space-y-4">
              {jumpHosts.map((host) => (
                <div key={host.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Server className="w-5 h-5 text-gray-600" />
                        <h4 className="text-lg font-bold text-gray-900">{host.name}</h4>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(host.status)}`}></div>
                        <span className="text-sm text-gray-600">
                          {getStatusText(host.status)}
                        </span>
                      </div>
                      <div className="ml-8 space-y-1">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">地址:</span>
                          <span className="text-gray-900">{host.host}:{host.port}</span>
                        </div>
                        {host.description && (
                          <p className="text-sm text-gray-600 mt-2">{host.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => window.location.href = `/servers/${host.id}`}
                        title="查看服务器详情"
                      >
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {jumpHosts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无可用跳板机</p>
                  <p className="text-sm mt-2">请在服务器管理模块添加服务器作为跳板机</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VPN配置 */}
      {selectedTab === 'vpn' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">VPN连接</h3>
            <div className="space-y-4">
              {vpnConfigs.map((vpn) => (
                <div key={vpn.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Network className="w-5 h-5 text-gray-600" />
                        <h4 className="text-lg font-bold text-gray-900">{vpn.name}</h4>
                        {vpn.status && (
                          <>
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(vpn.status)}`}></div>
                            <span className="text-sm text-gray-600">
                              {vpn.status === 'connected' ? '已连接' : '未连接'}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="ml-8 space-y-1 text-sm">
                        <div>
                          <span className="text-gray-600">类型:</span>
                          <span className="text-gray-900 ml-2">{vpn.type.toUpperCase()}</span>
                        </div>
                        {vpn.config_file && (
                          <div>
                            <span className="text-gray-600">配置文件:</span>
                            <span className="text-gray-900 ml-2">{vpn.config_file}</span>
                          </div>
                        )}
                        {vpn.description && (
                          <div>
                            <span className="text-gray-600">描述:</span>
                            <span className="text-gray-900 ml-2">{vpn.description}</span>
                          </div>
                        )}
                        {vpn.connected_at && (
                          <div>
                            <span className="text-gray-600">连接时间:</span>
                            <span className="text-gray-900 ml-2">
                              {new Date(vpn.connected_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {vpn.status === 'connected' ? (
                        <button className="btn-secondary text-sm">断开</button>
                      ) : (
                        <button className="btn-primary text-sm">连接</button>
                      )}
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => handleDeleteVPN(vpn.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {vpnConfigs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Network className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无VPN配置</p>
                </div>
              )}
            </div>
          </div>

          {/* 添加VPN配置表单 */}
          {showVPNModal && (
            <VPNConfigForm
              onClose={() => setShowVPNModal(false)}
              onSuccess={() => {
                setShowVPNModal(false)
                loadData()
              }}
            />
          )}
        </div>
      )}

      {/* 内网穿透 */}
      {selectedTab === 'tunnel' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">内网穿透配置</h3>
            <div className="space-y-4">
              {tunnelConfigs.map((tunnel) => (
                <div key={tunnel.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-5 h-5 text-gray-600" />
                        <h4 className="text-lg font-bold text-gray-900">{tunnel.name}</h4>
                        {tunnel.status && (
                          <>
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(tunnel.status)}`}></div>
                            <span className="text-sm text-gray-600">
                              {tunnel.status === 'connected' ? '已连接' : '未连接'}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="ml-8 space-y-1 text-sm">
                        <div>
                          <span className="text-gray-600">服务地址:</span>
                          <span className="text-gray-900 ml-2">{tunnel.server_url}</span>
                        </div>
                        {tunnel.description && (
                          <div>
                            <span className="text-gray-600">描述:</span>
                            <span className="text-gray-900 ml-2">{tunnel.description}</span>
                          </div>
                        )}
                        {tunnel.connected_at && (
                          <div>
                            <span className="text-gray-600">连接时间:</span>
                            <span className="text-gray-900 ml-2">
                              {new Date(tunnel.connected_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tunnel.status === 'connected' ? (
                        <button className="btn-secondary text-sm">断开</button>
                      ) : (
                        <button className="btn-primary text-sm">连接</button>
                      )}
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => handleDeleteTunnel(tunnel.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {tunnelConfigs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无内网穿透配置</p>
                </div>
              )}
            </div>
          </div>

          {/* 添加内网穿透配置表单 */}
          {showTunnelModal && (
            <TunnelConfigForm
              onClose={() => setShowTunnelModal(false)}
              onSuccess={() => {
                setShowTunnelModal(false)
                loadData()
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// VPN配置表单组件
function VPNConfigForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'openvpn',
    config_file: '',
    config_content: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      await createVPNConfig(formData)
      onSuccess()
    } catch (err: any) {
      let errorMessage = '创建失败'
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
      console.error('创建VPN配置失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h3 className="font-bold text-gray-900 mb-4">添加VPN配置</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            名称 *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="VPN配置名称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            VPN类型 *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="openvpn">OpenVPN</option>
            <option value="wireguard">WireGuard</option>
            <option value="ipsec">IPSec</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            配置文件路径
          </label>
          <input
            type="text"
            value={formData.config_file}
            onChange={(e) => setFormData({ ...formData, config_file: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="/etc/openvpn/client.conf"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            配置内容
          </label>
          <textarea
            rows={6}
            value={formData.config_content}
            onChange={(e) => setFormData({ ...formData, config_content: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder="粘贴VPN配置文件内容"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            描述
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="配置描述"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '创建中...' : '创建配置'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

// 内网穿透配置表单组件
function TunnelConfigForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    server_url: '',
    client_token: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      await createTunnelConfig(formData)
      onSuccess()
    } catch (err: any) {
      let errorMessage = '创建失败'
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
      console.error('创建内网穿透配置失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h3 className="font-bold text-gray-900 mb-4">添加内网穿透配置</h3>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <p className="text-sm text-blue-800">
          内网穿透功能需要在内网部署穿透客户端，并在云端配置穿透服务地址。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            名称 *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="内网穿透配置名称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            穿透服务地址 *
          </label>
          <input
            type="text"
            required
            value={formData.server_url}
            onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="tunnel.example.com:7000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            客户端Token
          </label>
          <input
            type="text"
            value={formData.client_token}
            onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="输入客户端Token"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            描述
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="配置描述"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '创建中...' : '创建配置'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

