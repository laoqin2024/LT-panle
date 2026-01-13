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
  X,
  Play,
  CheckCircle,
  XCircle,
  Terminal,
  Info
} from 'lucide-react'
import { getCredentials, deleteCredential, decryptCredential, createCredential, updateCredential, testCredentialConnection, type Credential, type CredentialCreate, type CredentialUpdate } from '../services/credentials'
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
  const [revealedSshKeys, setRevealedSshKeys] = useState<Map<number, string>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [resourceMap, setResourceMap] = useState<Map<string, Map<number, any>>>(new Map())
  const [testingCredential, setTestingCredential] = useState<number | null>(null)

  // 加载数据
  useEffect(() => {
    loadData()
    loadResourceMap()
  }, [selectedType, searchTerm])

  // 加载资源映射（用于显示资源名称）
  const loadResourceMap = async () => {
    try {
      const map = new Map<string, Map<number, any>>()
      
      // 加载所有类型的资源
      const [serversRes, devicesRes, databasesRes, sitesRes] = await Promise.all([
        getServers({ limit: 1000 }).catch(() => ({ items: [] })),
        getDevices({ limit: 1000 }).catch(() => ({ items: [] })),
        getDatabases({ limit: 1000 }).catch(() => ({ items: [] })),
        getSites({ limit: 1000 }).catch(() => ({ items: [] }))
      ])
      
      const serverMap = new Map<number, any>()
      serversRes.items.forEach((s: Server) => serverMap.set(s.id, s))
      map.set('server', serverMap)
      
      const deviceMap = new Map<number, any>()
      devicesRes.items.forEach((d: NetworkDevice) => deviceMap.set(d.id, d))
      map.set('device', deviceMap)
      
      const databaseMap = new Map<number, any>()
      databasesRes.items.forEach((db: Database) => databaseMap.set(db.id, db))
      map.set('database', databaseMap)
      
      const siteMap = new Map<number, any>()
      sitesRes.items.forEach((site: BusinessSite) => siteMap.set(site.id, site))
      map.set('site', siteMap)
      
      setResourceMap(map)
    } catch (err) {
      console.error('加载资源映射失败:', err)
    }
  }

  // 获取资源名称
  const getResourceName = (cred: Credential): string => {
    const typeMap = resourceMap.get(cred.resource_type)
    if (typeMap) {
      const resource = typeMap.get(cred.resource_id)
      if (resource) {
        return resource.name || `${resourceTypeLabels[cred.resource_type as keyof typeof resourceTypeLabels]} #${cred.resource_id}`
      }
    }
    return `${resourceTypeLabels[cred.resource_type as keyof typeof resourceTypeLabels]} #${cred.resource_id}`
  }

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

  const handleTestConnection = async (credentialId: number) => {
    try {
      setTestingCredential(credentialId)
      const result = await testCredentialConnection(credentialId)
      if (result.success) {
        alert(`连接测试成功！\n服务器: ${result.server_host}:${result.server_port}\n用户名: ${result.username}\n输出: ${result.output || '无'}`)
      } else {
        alert(`连接测试失败: ${result.message}`)
      }
    } catch (err: any) {
      let errorMessage = '连接测试失败'
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err.message) {
        errorMessage = err.message
      }
      alert(errorMessage)
    } finally {
      setTestingCredential(null)
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

  const toggleSshKeyVisibility = async (credential: Credential) => {
    if (revealedSshKeys.has(credential.id)) {
      // 隐藏SSH密钥
      const newMap = new Map(revealedSshKeys)
      newMap.delete(credential.id)
      setRevealedSshKeys(newMap)
    } else {
      // 显示SSH密钥 - 需要调用解密API
      try {
        const response = await decryptCredential(credential.id)
        const newMap = new Map(revealedSshKeys)
        newMap.set(credential.id, response.password) // SSH密钥内容存储在password字段
        setRevealedSshKeys(newMap)
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
        console.error('解密SSH密钥失败:', err)
      }
    }
  }

  // 格式化SSH密钥预览（显示前3行和后3行）
  const formatSshKeyPreview = (keyContent: string): string => {
    const lines = keyContent.split('\n')
    if (lines.length <= 6) {
      return keyContent
    }
    const firstLines = lines.slice(0, 3).join('\n')
    const lastLines = lines.slice(-3).join('\n')
    return `${firstLines}\n... (省略 ${lines.length - 6} 行) ...\n${lastLines}`
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
          const sshKey = revealedSshKeys.get(cred.id)
          const isSshKeyRevealed = !!sshKey
          
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
                        {getResourceName(cred)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {resourceTypeLabels[cred.resource_type as keyof typeof resourceTypeLabels]} · ID: {cred.resource_id}
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

                    {/* SSH密钥预览 */}
                    {cred.credential_type === 'ssh_key' && (
                      <div className="mt-2">
                        {isSshKeyRevealed && sshKey ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-medium text-gray-700">SSH私钥内容:</span>
                              <button
                                onClick={() => copyToClipboard(sshKey)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="复制完整私钥"
                              >
                                <Copy className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                            <pre className="text-xs font-mono text-gray-800 whitespace-pre bg-white p-2 rounded border border-gray-200 max-h-48 overflow-y-auto overflow-x-auto" style={{ wordBreak: 'keep-all', whiteSpace: 'pre', lineHeight: '1.5' }}>
                              {formatSshKeyPreview(sshKey)}
                            </pre>
                          </div>
                        ) : cred.ssh_key_path ? (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">私钥路径:</span>
                            <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">{cred.ssh_key_path}</code>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">点击眼睛图标查看私钥内容</div>
                        )}
                      </div>
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

                  {/* SSH密钥显示/隐藏 */}
                  {cred.credential_type === 'ssh_key' && (
                    <button
                      onClick={() => toggleSshKeyVisibility(cred)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title={isSshKeyRevealed ? '隐藏SSH密钥' : '显示SSH密钥'}
                    >
                      {isSshKeyRevealed ? (
                        <EyeOff className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    {/* 测试连接按钮（服务器类型且激活） */}
                    {cred.resource_type === 'server' && cred.is_active && (
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => handleTestConnection(cred.id)}
                        disabled={testingCredential === cred.id}
                        title="测试连接"
                      >
                        {testingCredential === cred.id ? (
                          <Loading />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                    )}
                    <button 
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => {
                        setEditingCredential(cred)
                        setShowForm(true)
                      }}
                      title="编辑"
                    >
                      <Settings className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => handleDelete(cred.id)}
                      title="删除"
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
    ssh_key_content: '', // SSH私钥内容
    // 如果编辑凭据且有ssh_key_path，使用path模式，否则使用content模式
    ssh_key_mode: (credential?.credential_type === 'ssh_key' && credential?.ssh_key_path) 
      ? 'path' as const 
      : 'content' as const,
    description: credential?.description || '',
    is_active: credential?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [loadingSshKey, setLoadingSshKey] = useState(false)

  // 编辑时加载SSH密钥内容
  useEffect(() => {
    if (credential && credential.credential_type === 'ssh_key' && formData.ssh_key_mode === 'content' && !formData.ssh_key_content) {
      loadSshKeyContent()
    }
  }, [credential, formData.credential_type, formData.ssh_key_mode])

  const loadSshKeyContent = async () => {
    if (!credential) return
    
    try {
      setLoadingSshKey(true)
      const response = await decryptCredential(credential.id)
      setFormData(prev => ({ ...prev, ssh_key_content: response.password }))
    } catch (err: any) {
      console.error('加载SSH密钥内容失败:', err)
      // 不显示错误，因为可能是路径方式
    } finally {
      setLoadingSshKey(false)
    }
  }

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
      if (formData.credential_type === 'ssh_key') {
        if (formData.ssh_key_mode === 'content' && !formData.ssh_key_content.trim()) {
          setError('SSH私钥内容不能为空')
          return
        }
        if (formData.ssh_key_mode === 'path' && !formData.ssh_key_path.trim()) {
          setError('SSH私钥路径不能为空')
          return
        }
      }

      if (credential) {
        // 更新凭据
        const updateData: CredentialUpdate = {
          credential_type: formData.credential_type, // 必须更新凭据类型
          username: formData.username || undefined,
          ssh_key_path: formData.ssh_key_mode === 'path' ? formData.ssh_key_path || undefined : undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        }
        
        // 处理密码/私钥更新
        if (formData.credential_type === 'password') {
          // 密码类型：只有当密码字段有值时才更新
          if (formData.password && formData.password.trim()) {
            updateData.password = formData.password
          }
        } else if (formData.credential_type === 'ssh_key') {
          // SSH密钥类型
          if (formData.ssh_key_mode === 'content' && formData.ssh_key_content && formData.ssh_key_content.trim()) {
            // 使用私钥内容方式：通过password字段传递私钥内容
            updateData.password = formData.ssh_key_content
          }
          // 如果使用路径方式，ssh_key_path已经在上面设置了
        }
        
        await updateCredential(credential.id, updateData)
      } else {
        // 创建凭据
        const createData: CredentialCreate = {
          resource_type: formData.resource_type,
          resource_id: formData.resource_id,
          credential_type: formData.credential_type,
          username: formData.username || undefined,
          password: formData.credential_type === 'ssh_key' && formData.ssh_key_mode === 'content' 
            ? formData.ssh_key_content 
            : formData.password || undefined,
          ssh_key_path: formData.ssh_key_mode === 'path' ? formData.ssh_key_path || undefined : undefined,
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
            <div className="space-y-4">
              {/* 私钥使用方式选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SSH私钥使用方式 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ssh_key_mode"
                      value="content"
                      checked={formData.ssh_key_mode === 'content'}
                      onChange={(e) => setFormData({ ...formData, ssh_key_mode: 'content' as const })}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      私钥内容 <span className="text-green-600 font-medium">（推荐）</span>
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ssh_key_mode"
                      value="path"
                      checked={formData.ssh_key_mode === 'path'}
                      onChange={(e) => setFormData({ ...formData, ssh_key_mode: 'path' as const })}
                      className="mr-2"
                    />
                    <span className="text-sm">私钥路径</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  💡 推荐使用私钥内容方式，更灵活且不依赖后端服务器文件路径
                </p>
              </div>

              {/* 私钥内容方式 */}
              {formData.ssh_key_mode === 'content' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH私钥内容 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">（粘贴完整的私钥内容）</span>
                    {loadingSshKey && (
                      <span className="text-xs text-blue-600 ml-2">加载中...</span>
                    )}
                  </label>
                  <textarea
                    value={formData.ssh_key_content}
                    onChange={(e) => setFormData({ ...formData, ssh_key_content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-xs"
                    rows={10}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEpAIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
                    required={formData.ssh_key_mode === 'content'}
                    disabled={loadingSshKey}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ✅ 私钥内容将加密存储，更安全且可在任何后端服务器上使用
                  </p>
                </div>
              )}

              {/* 私钥路径方式 */}
              {formData.ssh_key_mode === 'path' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH私钥路径 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">（后端服务器上的路径）</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ssh_key_path}
                    onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="/opt/ssh_keys/id_rsa 或 ~/.ssh/id_rsa"
                    required={formData.ssh_key_mode === 'path'}
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ 注意：私钥文件必须存在于后端服务器上，路径是相对于后端服务器的
                  </p>
                </div>
              )}
              
              {/* SSH密钥获取提示 */}
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-900 mb-1">
                      ⚠️ 重要：请使用<strong className="text-red-600">私钥</strong>路径，不是公钥！
                    </p>
                    <p className="text-xs text-blue-700 mb-2">
                      私钥用于客户端认证，公钥应已部署在服务器上。
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 font-medium">私钥路径：</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                          ~/.ssh/id_rsa
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('~/.ssh/id_rsa')
                            alert('已复制到剪贴板')
                          }}
                          className="p-1 hover:bg-blue-100 rounded"
                          title="复制"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 font-medium">查找私钥：</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                          ls -la ~/.ssh/id_rsa
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('ls -la ~/.ssh/id_rsa')
                            alert('已复制到剪贴板')
                          }}
                          className="p-1 hover:bg-blue-100 rounded"
                          title="复制"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 font-medium">生成密钥对：</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                          ssh-keygen -t rsa -b 4096
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('ssh-keygen -t rsa -b 4096')
                            alert('已复制到剪贴板')
                          }}
                          className="p-1 hover:bg-blue-100 rounded"
                          title="复制"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 font-medium">部署公钥到服务器：</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                          ssh-copy-id user@server
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('ssh-copy-id user@server')
                            alert('已复制到剪贴板')
                          }}
                          className="p-1 hover:bg-blue-100 rounded"
                          title="复制"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-600">
                        💡 <strong>说明</strong>：私钥（id_rsa）用于登录，公钥（id_rsa.pub）应已添加到服务器的 ~/.ssh/authorized_keys
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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

