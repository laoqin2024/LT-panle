import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Settings, 
  Trash2, 
  Server as ServerIcon, 
  Network, 
  Database as DatabaseIcon, 
  Globe,
  Copy,
  Filter,
  Search,
  X
} from 'lucide-react'
import { getCredentials, deleteCredential, decryptCredential, createCredential, updateCredential, type Credential, type CredentialCreate, type CredentialUpdate } from '../services/credentials'
import { getServers, type Server } from '../services/servers'
import { getDevices, type NetworkDevice } from '../services/devices'
import { getDatabases, type Database } from '../services/databases'
import { getSites, type BusinessSite } from '../services/sites'
import Loading from '../components/Loading'

const resourceTypeIcons = {
  server: ServerIcon,
  device: Network,
  database: DatabaseIcon,
  site: Globe,
}

const resourceTypeLabels = {
  server: '服务器',
  device: '网络设备',
  database: '数据库',
  site: '站点',
}

export default function Credentials() {
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [revealedPasswords, setRevealedPasswords] = useState<Map<number, string>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [selectedType, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getCredentials({
        resource_type: selectedType || undefined,
        search: searchTerm || undefined,
        limit: 100,
      })

      setCredentials(response.items)
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
      console.error('加载凭据数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (credentialId: number) => {
    if (!window.confirm('确定要删除这个凭据吗？')) {
      return
    }

    try {
      await deleteCredential(credentialId)
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
      console.error('删除凭据失败:', err)
    }
  }

  const togglePasswordVisibility = async (credential: Credential) => {
    if (revealedPasswords.has(credential.id)) {
      // 隐藏密码
      const newMap = new Map(revealedPasswords)
      newMap.delete(credential.id)
      setRevealedPasswords(newMap)
    } else {
      // 显示密码 - 需要调用解密API
      try {
        const response = await decryptCredential(credential.id)
        const newMap = new Map(revealedPasswords)
        newMap.set(credential.id, response.password)
        setRevealedPasswords(newMap)
      } catch (err: any) {
        let errorMessage = '解密失败'
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
        console.error('解密凭据失败:', err)
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // 可以添加提示消息
    alert('已复制到剪贴板')
  }

  const filteredCredentials = credentials.filter((cred) => {
    const matchType = !selectedType || cred.resource_type === selectedType
    const matchSearch = 
      cred.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchType && matchSearch
  })

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

  const getResourceIcon = (type: string) => {
    const Icon = resourceTypeIcons[type as keyof typeof resourceTypeIcons] || Key
    return Icon
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">密码管理</h1>
          <p className="text-gray-600 mt-1">统一管理所有资源的访问凭据</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingCredential(null)
            setShowForm(true)
          }}
        >
          <Plus className="w-5 h-5" />
          添加凭据
        </button>
      </div>

      {/* 筛选和搜索 */}
      <div className="card">
        <div className="flex items-center gap-4">
          {/* 类型筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedType(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedType
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {Object.entries(resourceTypeLabels).map(([type, label]) => {
                const Icon = resourceTypeIcons[type as keyof typeof resourceTypeIcons]
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedType === type
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索资源名称、用户名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 凭据列表 */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCredentials.map((cred) => {
          const ResourceIcon = getResourceIcon(cred.resource_type)
          const password = revealedPasswords.get(cred.id)
          const isPasswordRevealed = !!password
          
          return (
            <div key={cred.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <ResourceIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        资源ID: {cred.resource_id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {resourceTypeLabels[cred.resource_type as keyof typeof resourceTypeLabels]}
                      </p>
                    </div>
                  </div>

                  <div className="ml-14 space-y-2">
                    <div className="flex items-center gap-4">
                      {cred.username && (
                        <div>
                          <span className="text-sm text-gray-600">用户名:</span>
                          <span className="text-sm font-medium text-gray-900 ml-2">{cred.username}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-gray-600">类型:</span>
                        <span className="text-sm font-medium text-gray-900 ml-2">
                          {cred.credential_type === 'password' ? '密码' : 
                           cred.credential_type === 'ssh_key' ? 'SSH密钥' : 'API密钥'}
                        </span>
                      </div>
                      {!cred.is_active && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                          已禁用
                        </span>
                      )}
                    </div>

                    {cred.description && (
                      <p className="text-sm text-gray-600">{cred.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>最后更新: {new Date(cred.updated_at).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* 密码显示/隐藏 */}
                  {cred.credential_type === 'password' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePasswordVisibility(cred)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title={isPasswordRevealed ? '隐藏密码' : '显示密码'}
                      >
                        {isPasswordRevealed ? (
                          <EyeOff className="w-4 h-4 text-gray-600" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                      {isPasswordRevealed && password && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded">
                          <span className="font-mono text-sm">{password}</span>
                          <button
                            onClick={() => copyToClipboard(password)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="复制密码"
                          >
                            <Copy className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <button 
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => {
                        setEditingCredential(cred)
                        setShowForm(true)
                      }}
                    >
                      <Settings className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => handleDelete(cred.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 空状态 */}
      {filteredCredentials.length === 0 && (
        <div className="card text-center py-12">
          <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的凭据</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingCredential(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个凭据
          </button>
        </div>
      )}

      {/* 凭据添加/编辑表单 */}
      {showForm && (
        <CredentialForm
          credential={editingCredential}
          onClose={() => {
            setShowForm(false)
            setEditingCredential(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingCredential(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 凭据表单组件
function CredentialForm({
  credential,
  onClose,
  onSuccess
}: {
  credential: Credential | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    resource_type: credential?.resource_type || 'server',
    resource_id: credential?.resource_id || 0,
    credential_type: credential?.credential_type || 'password',
    username: credential?.username || '',
    password: '',
    ssh_key_path: credential?.ssh_key_path || '',
    description: credential?.description || '',
    is_active: credential?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [loadingResources, setLoadingResources] = useState(false)

  // 根据资源类型加载资源列表
  useEffect(() => {
    loadResources()
  }, [formData.resource_type])

  const loadResources = async () => {
    try {
      setLoadingResources(true)
      switch (formData.resource_type) {
        case 'server':
          const serversResponse = await getServers({ limit: 1000 })
          setResources(serversResponse.items)
          break
        case 'device':
          const devicesResponse = await getDevices({ limit: 1000 })
          setResources(devicesResponse.items)
          break
        case 'database':
          const databasesResponse = await getDatabases({ limit: 1000 })
          setResources(databasesResponse.items)
          break
        case 'site':
          const sitesResponse = await getSites({ limit: 1000 })
          setResources(sitesResponse.items)
          break
        default:
          setResources([])
      }
    } catch (err) {
      console.error('加载资源列表失败:', err)
      setResources([])
    } finally {
      setLoadingResources(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.resource_type) {
        setError('资源类型不能为空')
        return
      }
      if (!formData.resource_id) {
        setError('请选择关联的资源')
        return
      }
      if (!formData.credential_type) {
        setError('凭据类型不能为空')
        return
      }
      if (formData.credential_type === 'password' && !formData.password && !credential) {
        setError('密码不能为空')
        return
      }
      if (formData.credential_type === 'ssh_key' && !formData.ssh_key_path) {
        setError('SSH密钥路径不能为空')
        return
      }

      if (credential) {
        // 更新凭据
        const updateData: CredentialUpdate = {
          username: formData.username || undefined,
          password: formData.password || undefined,
          ssh_key_path: formData.ssh_key_path || undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        }
        await updateCredential(credential.id, updateData)
      } else {
        // 创建凭据
        const createData: CredentialCreate = {
          resource_type: formData.resource_type,
          resource_id: formData.resource_id,
          credential_type: formData.credential_type,
          username: formData.username || undefined,
          password: formData.password || undefined,
          ssh_key_path: formData.ssh_key_path || undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        }
        await createCredential(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = credential ? '更新失败' : '创建失败'
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
      console.error('保存凭据失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {credential ? '编辑凭据' : '添加凭据'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                资源类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.resource_type}
                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value, resource_id: 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={!!credential}
              >
                <option value="server">服务器</option>
                <option value="device">网络设备</option>
                <option value="database">数据库</option>
                <option value="site">业务站点</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                关联资源 <span className="text-red-500">*</span>
              </label>
              {loadingResources ? (
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-500">
                  加载中...
                </div>
              ) : (
                <select
                  value={formData.resource_id || ''}
                  onChange={(e) => setFormData({ ...formData, resource_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={!!credential}
                >
                  <option value="">请选择资源</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name || `${resourceTypeLabels[formData.resource_type as keyof typeof resourceTypeLabels]} #${resource.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              凭据类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.credential_type}
              onChange={(e) => setFormData({ ...formData, credential_type: e.target.value, password: '', ssh_key_path: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="password">密码</option>
              <option value="ssh_key">SSH密钥</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入用户名（可选）"
            />
          </div>

          {formData.credential_type === 'password' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码 {!credential && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={credential ? '留空则不修改密码' : '请输入密码'}
                required={!credential}
              />
              {credential && (
                <p className="text-xs text-gray-500 mt-1">留空则不修改密码</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SSH密钥路径 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ssh_key_path}
                onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="/path/to/private/key"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="请输入凭据描述（可选）"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              启用凭据
            </label>
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
              {saving ? '保存中...' : credential ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

