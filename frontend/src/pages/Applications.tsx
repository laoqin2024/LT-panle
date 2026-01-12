import { useState, useEffect } from 'react'
import { Plus, Settings, Trash2, Activity, Globe, Filter, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getApplications, deleteApplication, createApplication, updateApplication, type Application, type ApplicationCreate, type ApplicationUpdate } from '../services/applications'
import { getSites, type BusinessSite } from '../services/sites'
import Loading from '../components/Loading'

export default function Applications() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [appTypeFilter, setAppTypeFilter] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [allSites, setAllSites] = useState<BusinessSite[]>([]) // 用于站点选择

  // 加载数据
  useEffect(() => {
    loadData()
  }, [statusFilter, appTypeFilter, searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getApplications({
        status: statusFilter || undefined,
        app_type: appTypeFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      })

      setApplications(response.items)
      
      // 同时加载所有站点用于关联选择
      try {
        const sitesResponse = await getSites({ limit: 1000 })
        setAllSites(sitesResponse.items)
      } catch (e) {
        console.error('加载站点列表失败:', e)
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
      console.error('加载应用数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (applicationId: number) => {
    if (!window.confirm('确定要删除这个应用吗？')) {
      return
    }

    try {
      await deleteApplication(applicationId)
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
      console.error('删除应用失败:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'stopped':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return '运行中'
      case 'stopped':
        return '已停止'
      case 'warning':
        return '异常'
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
          <h1 className="text-3xl font-bold text-gray-900">应用管理</h1>
          <p className="text-gray-600 mt-1">管理和监控应用服务</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingApplication(null)
            setShowForm(true)
          }}
        >
          <Plus className="w-5 h-5" />
          添加应用
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
              <option value="running">运行中</option>
              <option value="stopped">已停止</option>
              <option value="warning">异常</option>
              <option value="unknown">未知</option>
            </select>
          </div>

          {/* 应用类型筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">类型:</span>
            <select
              value={appTypeFilter || ''}
              onChange={(e) => setAppTypeFilter(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部</option>
              <option value="Web服务">Web服务</option>
              <option value="API服务">API服务</option>
              <option value="数据库">数据库</option>
              <option value="缓存">缓存</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索应用名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 应用列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {applications.map((app) => (
          <div key={app.id} className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
            {/* 应用头部 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-900">{app.name}</h3>
                </div>
                {app.site && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Globe className="w-4 h-4" />
                    <span>{app.site.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {app.app_type && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {app.app_type}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(app.status)} text-white`}>
                    {getStatusText(app.status)}
                  </span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(app.status)}`}></div>
            </div>

            {/* 应用信息 */}
            <div className="space-y-2 mb-4">
              {app.port && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">端口</span>
                  <span className="text-sm font-medium text-gray-900">{app.port}</span>
                </div>
              )}
              {app.process_name && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">进程</span>
                  <span className="text-sm font-medium text-gray-900">{app.process_name}</span>
                </div>
              )}
              {app.description && (
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{app.description}</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button 
                className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/applications/${app.id}`)
                }}
              >
                <Activity className="w-4 h-4" />
                查看详情
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingApplication(app)
                  setShowForm(true)
                }}
              >
                <Settings className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(app.id)
                }}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {applications.length === 0 && (
        <div className="card text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">没有找到匹配的应用</p>
          <button 
            className="btn-primary flex items-center gap-2 mx-auto"
            onClick={() => {
              setEditingApplication(null)
              setShowForm(true)
            }}
          >
            <Plus className="w-5 h-5" />
            添加第一个应用
          </button>
        </div>
      )}

      {/* 应用添加/编辑表单 */}
      {showForm && (
        <ApplicationForm
          application={editingApplication}
          allSites={allSites}
          onClose={() => {
            setShowForm(false)
            setEditingApplication(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingApplication(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 应用表单组件
function ApplicationForm({
  application,
  allSites,
  onClose,
  onSuccess
}: {
  application: Application | null
  allSites: BusinessSite[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: application?.name || '',
    site_id: application?.site_id || undefined,
    app_type: application?.app_type || '',
    port: application?.port || undefined,
    process_name: application?.process_name || '',
    description: application?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('应用名称不能为空')
        return
      }

      if (application) {
        // 更新应用
        const updateData: ApplicationUpdate = {
          name: formData.name,
          site_id: formData.site_id,
          app_type: formData.app_type || undefined,
          port: formData.port,
          process_name: formData.process_name || undefined,
          description: formData.description || undefined,
        }
        await updateApplication(application.id, updateData)
      } else {
        // 创建应用
        const createData: ApplicationCreate = {
          name: formData.name,
          site_id: formData.site_id,
          app_type: formData.app_type || undefined,
          port: formData.port,
          process_name: formData.process_name || undefined,
          description: formData.description || undefined,
        }
        await createApplication(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = application ? '更新失败' : '创建失败'
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
      console.error('保存应用失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {application ? '编辑应用' : '添加应用'}
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
              应用名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入应用名称"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                关联站点
              </label>
              <select
                value={formData.site_id || ''}
                onChange={(e) => setFormData({ ...formData, site_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">无关联站点</option>
                {allSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                应用类型
              </label>
              <select
                value={formData.app_type}
                onChange={(e) => setFormData({ ...formData, app_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">请选择</option>
                <option value="Web服务">Web服务</option>
                <option value="API服务">API服务</option>
                <option value="数据库">数据库</option>
                <option value="缓存">缓存</option>
                <option value="消息队列">消息队列</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                端口号
              </label>
              <input
                type="number"
                value={formData.port || ''}
                onChange={(e) => setFormData({ ...formData, port: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：8080"
                min={1}
                max={65535}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                进程名称
              </label>
              <input
                type="text"
                value={formData.process_name}
                onChange={(e) => setFormData({ ...formData, process_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="如：nginx、mysql等"
              />
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
              placeholder="请输入应用描述（可选）"
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
              {saving ? '保存中...' : application ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

