import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Plus, Terminal, Settings, Trash2, Activity, Wifi, AlertCircle, Filter, X } from 'lucide-react'
import { getDevices, deleteDevice, createDevice, updateDevice, type NetworkDevice, type NetworkDeviceCreate, type NetworkDeviceUpdate } from '../services/devices'
import { getServers, type Server } from '../services/servers'
import Loading from '../components/Loading'

export default function Devices() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null)
  const [allServers, setAllServers] = useState<Server[]>([]) // 用于跳板机选择

  // 加载数据
  useEffect(() => {
    loadData()
  }, [statusFilter, deviceTypeFilter, vendorFilter, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getDevices({
        status: statusFilter || undefined,
        device_type: deviceTypeFilter || undefined,
        vendor: vendorFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      })

      setDevices(response.items)
      
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
      console.error('加载网络设备数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (deviceId: number) => {
    if (!window.confirm('确定要删除这个网络设备吗？')) {
      return
    }

    try {
      await deleteDevice(deviceId)
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
      console.error('删除网络设备失败:', err)
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

  const getDeviceTypeDisplay = (device: NetworkDevice) => {
    if (device.model) {
      return device.model
    }
    if (device.device_type) {
      return device.device_type
    }
    return '未知设备'
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
          <h1 className="text-3xl font-bold text-gray-900">网络设备管理</h1>
          <p className="text-gray-600 mt-1">管理华为交换机等网络设备</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingDevice(null)
            setShowForm(true)
          }}
        >
          <Plus className="w-5 h-5" />
          添加设备
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

          {/* 设备类型筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">类型:</span>
            <select
              value={deviceTypeFilter || ''}
              onChange={(e) => setDeviceTypeFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="Router">路由器</option>
              <option value="Switch">交换机</option>
              <option value="Firewall">防火墙</option>
            </select>
          </div>

          {/* 厂商筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">厂商:</span>
            <select
              value={vendorFilter || ''}
              onChange={(e) => setVendorFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="huawei">华为</option>
              <option value="cisco">思科</option>
              <option value="h3c">H3C</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索设备名称或IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 设备列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div key={device.id} className="card hover:shadow-lg transition-shadow">
            {/* 设备头部 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Network className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-900">{device.name}</h3>
                </div>
                <p className="text-sm text-gray-500">{device.ip}</p>
                <p className="text-xs text-gray-400 mt-1">{getDeviceTypeDisplay(device)}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {device.protocol}
                  </span>
                  {device.vendor && (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      {device.vendor}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(device.status)} text-white`}>
                    {getStatusText(device.status)}
                  </span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`}></div>
            </div>

            {/* 接口状态 */}
            {device.interface_count && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">接口状态</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {device.interface_count.up}/{device.interface_count.total} 在线
                  </span>
                </div>
                {device.interface_count.down > 0 && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{device.interface_count.down} 个接口离线</span>
                  </div>
                )}
              </div>
            )}

            {/* 设备信息 */}
            <div className="space-y-2 mb-4">
              {device.network_type !== 'direct' && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">网络类型</span>
                  <span className="text-sm font-medium text-gray-900">
                    {device.network_type === 'jump' ? '跳板机' : 
                     device.network_type === 'vpn' ? 'VPN' : 
                     device.network_type === 'tunnel' ? '内网穿透' : device.network_type}
                  </span>
                </div>
              )}
              {device.jump_host && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">跳板机</span>
                  <span className="text-sm font-medium text-gray-900">{device.jump_host.name}</span>
                </div>
              )}
              {device.description && (
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{device.description}</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button 
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                onClick={() => navigate(`/devices/${device.id}`)}
              >
                <Terminal className="w-4 h-4" />
                查看详情
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => {
                  setEditingDevice(device)
                  setShowForm(true)
                }}
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleDelete(device.id)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {devices.length === 0 && (
        <div className="card text-center py-12">
          <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的网络设备</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingDevice(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个设备
          </button>
        </div>
      )}

      {/* 设备添加/编辑表单 */}
      {showForm && (
        <DeviceForm
          device={editingDevice}
          allServers={allServers}
          onClose={() => {
            setShowForm(false)
            setEditingDevice(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingDevice(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 网络设备表单组件
function DeviceForm({
  device,
  allServers,
  onClose,
  onSuccess
}: {
  device: NetworkDevice | null
  allServers: Server[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: device?.name || '',
    ip: device?.ip || '',
    device_type: device?.device_type || '',
    model: device?.model || '',
    vendor: device?.vendor || 'huawei',
    system_version: device?.system_version || '',
    protocol: device?.protocol || 'ssh',
    snmp_version: device?.snmp_version || '',
    snmp_community: device?.snmp_community || '',
    network_type: device?.network_type || 'direct',
    jump_host_id: device?.jump_host_id || undefined,
    description: device?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('设备名称不能为空')
        return
      }
      if (!formData.ip.trim()) {
        setError('IP地址不能为空')
        return
      }
      if (!formData.vendor.trim()) {
        setError('厂商不能为空')
        return
      }
      if (formData.network_type === 'jump' && !formData.jump_host_id) {
        setError('使用跳板机时必须选择跳板机')
        return
      }

      // 验证IP地址格式（简单验证）
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipRegex.test(formData.ip)) {
        setError('IP地址格式不正确')
        return
      }

      if (device) {
        // 更新设备
        const updateData: NetworkDeviceUpdate = {
          name: formData.name,
          ip: formData.ip,
          device_type: formData.device_type || undefined,
          model: formData.model || undefined,
          vendor: formData.vendor,
          system_version: formData.system_version || undefined,
          protocol: formData.protocol,
          snmp_version: formData.snmp_version || undefined,
          snmp_community: formData.snmp_community || undefined,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          description: formData.description || undefined,
        }
        await updateDevice(device.id, updateData)
      } else {
        // 创建设备
        const createData: NetworkDeviceCreate = {
          name: formData.name,
          ip: formData.ip,
          device_type: formData.device_type || undefined,
          model: formData.model || undefined,
          vendor: formData.vendor,
          system_version: formData.system_version || undefined,
          protocol: formData.protocol,
          snmp_version: formData.snmp_version || undefined,
          snmp_community: formData.snmp_community || undefined,
          network_type: formData.network_type,
          jump_host_id: formData.jump_host_id,
          description: formData.description || undefined,
        }
        await createDevice(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = device ? '更新失败' : '创建失败'
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
      console.error('保存网络设备失败:', err)
    } finally {
      setSaving(false)
    }
  }

  // 过滤出可以作为跳板机的服务器
  const availableJumpHosts = allServers.filter(s => !device || s.id !== device.jump_host_id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {device ? '编辑网络设备' : '添加网络设备'}
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
              设备名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入设备名称"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="192.168.1.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                厂商 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="huawei">华为</option>
                <option value="cisco">思科</option>
                <option value="h3c">H3C</option>
                <option value="other">其他</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                设备类型
              </label>
              <select
                value={formData.device_type}
                onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择</option>
                <option value="Router">路由器</option>
                <option value="Switch">交换机</option>
                <option value="Firewall">防火墙</option>
                <option value="AP">无线AP</option>
                <option value="Other">其他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                设备型号
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：S5700、CE6800等"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                系统版本
              </label>
              <input
                type="text"
                value={formData.system_version}
                onChange={(e) => setFormData({ ...formData, system_version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：VRP V200R019C00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                连接协议 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
                <option value="snmp">SNMP</option>
              </select>
            </div>
          </div>

          {formData.protocol === 'snmp' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP版本
                </label>
                <select
                  value={formData.snmp_version}
                  onChange={(e) => setFormData({ ...formData, snmp_version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">请选择</option>
                  <option value="v1">SNMP v1</option>
                  <option value="v2c">SNMP v2c</option>
                  <option value="v3">SNMP v3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP Community
                </label>
                <input
                  type="text"
                  value={formData.snmp_community}
                  onChange={(e) => setFormData({ ...formData, snmp_community: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="public"
                />
              </div>
            </div>
          )}

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
              placeholder="请输入设备描述（可选）"
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
              {saving ? '保存中...' : device ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

