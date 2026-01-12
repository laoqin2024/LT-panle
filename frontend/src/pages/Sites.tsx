import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Plus, Settings, Trash2, Activity, ExternalLink, Folder, Filter, X } from 'lucide-react'
import { getSites, getGroups, deleteSite, createSite, updateSite, type BusinessSite, type BusinessGroup, type BusinessSiteCreate, type BusinessSiteUpdate } from '../services/sites'
import Loading from '../components/Loading'

export default function Sites() {
  const navigate = useNavigate()
  const [sites, setSites] = useState<BusinessSite[]>([])
  const [groups, setGroups] = useState<BusinessGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<BusinessSite | null>(null)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [selectedGroupId, searchTerm, statusFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 并行加载站点和分组
      const [sitesResponse, groupsResponse] = await Promise.all([
        getSites({
          group_id: selectedGroupId || undefined,
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          limit: 100,
        }),
        getGroups(),
      ])

      setSites(sitesResponse.items)
      setGroups(groupsResponse)
    } catch (err: any) {
      // 处理错误信息
      let errorMessage = '加载数据失败'
      if (err.response?.data?.detail) {
        // 如果是字符串，直接使用
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          // 如果是数组（验证错误），提取消息
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
      console.error('加载站点数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (siteId: number) => {
    if (!window.confirm('确定要删除这个站点吗？')) {
      return
    }

    try {
      await deleteSite(siteId)
      // 重新加载数据
      loadData()
    } catch (err: any) {
      // 处理错误信息
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
      console.error('删除站点失败:', err)
    }
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return '--'
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60) // 分钟

    if (diff < 1) return '刚刚'
    if (diff < 60) return `${diff}分钟前`
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`
    return `${Math.floor(diff / 1440)}天前`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('zh-CN')
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
        return '异常'
      case 'offline':
        return '离线'
      default:
        return '未知'
    }
  }

  const getResponseTimeColor = (time: number) => {
    if (time === 0) return 'text-gray-400'
    if (time > 2000) return 'text-red-600'
    if (time > 1000) return 'text-yellow-600'
    return 'text-green-600'
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
          <h1 className="text-3xl font-bold text-gray-900">业务站点管理</h1>
          <p className="text-gray-600 mt-1">管理和监控业务站点状态</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingSite(null)
            setShowForm(true)
          }}
        >
          <Plus className="w-5 h-5" />
          添加站点
        </button>
      </div>

      {/* 筛选和搜索 */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 分组筛选 */}
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-gray-500" />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedGroupId(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedGroupId === null
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedGroupId === group.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>

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

          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索站点名称或URL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 站点列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map((site) => (
          <div key={site.id} className="card hover:shadow-lg transition-shadow">
            {/* 站点头部 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-900">{site.name}</h3>
                </div>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  {site.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {site.type && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {site.type}
                    </span>
                  )}
                  {site.group && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {site.group.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(site.status)} text-white`}>
                    {getStatusText(site.status)}
                  </span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(site.status)}`}></div>
            </div>

            {/* 站点状态信息 */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">响应时间</span>
                </div>
                <span className={`text-sm font-medium ${getResponseTimeColor(site.last_response_time || 0)}`}>
                  {site.last_response_time ? `${site.last_response_time}ms` : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">最后检查</span>
                <span className="text-sm font-medium text-gray-900">{formatTime(site.last_check)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">SSL证书</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(site.ssl_expiry)}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button 
                className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                onClick={() => navigate(`/sites/${site.id}`)}
              >
                <Activity className="w-4 h-4" />
                查看详情
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => {
                  setEditingSite(site)
                  setShowForm(true)
                }}
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleDelete(site.id)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {sites.length === 0 && (
        <div className="card text-center py-12">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的站点</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingSite(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个站点
          </button>
        </div>
      )}

      {/* 站点添加/编辑表单 */}
      {showForm && (
        <SiteForm
          site={editingSite}
          groups={groups}
          onClose={() => {
            setShowForm(false)
            setEditingSite(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingSite(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 站点表单组件
function SiteForm({
  site,
  groups,
  onClose,
  onSuccess
}: {
  site: BusinessSite | null
  groups: BusinessGroup[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: site?.name || '',
    url: site?.url || '',
    type: site?.type || '',
    group_id: site?.group_id || undefined,
    description: site?.description || '',
    is_monitored: site?.is_monitored ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('站点名称不能为空')
        return
      }
      if (!formData.url.trim()) {
        setError('站点URL不能为空')
        return
      }

      // 验证URL格式
      try {
        new URL(formData.url)
      } catch {
        setError('URL格式不正确，请输入完整的URL（如：https://example.com）')
        return
      }

      if (site) {
        // 更新站点
        const updateData: BusinessSiteUpdate = {
          name: formData.name,
          url: formData.url,
          type: formData.type || undefined,
          group_id: formData.group_id,
          description: formData.description || undefined,
          is_monitored: formData.is_monitored,
        }
        await updateSite(site.id, updateData)
      } else {
        // 创建站点
        const createData: BusinessSiteCreate = {
          name: formData.name,
          url: formData.url,
          type: formData.type || undefined,
          group_id: formData.group_id,
          description: formData.description || undefined,
          is_monitored: formData.is_monitored,
        }
        await createSite(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = site ? '更新失败' : '创建失败'
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
      console.error('保存站点失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {site ? '编辑站点' : '添加站点'}
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
              站点名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入站点名称"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              站点URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">请输入完整的URL，包含协议（http://或https://）</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                站点类型
              </label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：Web应用、API服务等"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                所属分组
              </label>
              <select
                value={formData.group_id || ''}
                onChange={(e) => setFormData({ ...formData, group_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">无分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
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
              placeholder="请输入站点描述（可选）"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_monitored"
              checked={formData.is_monitored}
              onChange={(e) => setFormData({ ...formData, is_monitored: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_monitored" className="ml-2 text-sm text-gray-700">
              启用监控
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
              {saving ? '保存中...' : site ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

