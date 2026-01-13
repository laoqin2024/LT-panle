import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Globe, 
  ArrowLeft, 
  Activity, 
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { getSite, getSiteStatus, checkSiteNow, calculateHealthScore, type BusinessSite } from '../services/sites'
import { getMetrics, getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, getAlertHistory, type MetricResponse, type AlertRule, type AlertRuleCreate, type AlertHistory } from '../services/monitoring'
import Loading from '../components/Loading'
import MetricChart from '../components/MetricChart'

export default function SiteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('status')
  const [site, setSite] = useState<BusinessSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<MetricResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [calculatingHealth, setCalculatingHealth] = useState(false)
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null)

  useEffect(() => {
    if (id) {
      loadData()
      loadMetrics()
      if (activeTab === 'alerts') {
        loadAlertRules()
        loadAlertHistory()
      }
    }
  }, [id, activeTab])

  useEffect(() => {
    if (site?.health_score !== undefined) {
      setHealthScore(site.health_score)
    }
  }, [site])

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const siteData = await getSite(parseInt(id))
      setSite(siteData)
    } catch (err: any) {
      let errorMessage = '加载站点数据失败'
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
      console.error('加载站点数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    if (!id) return
    try {
      const metricsData = await getMetrics('site', parseInt(id), {
        start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        interval: '1h'
      })
      // 将metrics转换为site_availability格式
      if (metricsData.metrics && metricsData.metrics.length > 0) {
        const siteAvailability = metricsData.metrics.map(metric => ({
          timestamp: metric.time,
          response_time: metric.response_time,
          is_available: metric.is_available,
          status_code: metric.status_code,
          error_message: metric.error_message,
        }))
        setMetrics({
          ...metricsData,
          site_availability: siteAvailability
        })
      } else {
        setMetrics(metricsData)
      }
    } catch (err) {
      console.error('加载监控数据失败:', err)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadData(), loadMetrics()])
    setRefreshing(false)
  }

  const handleCheckNow = async () => {
    if (!id) return
    try {
      setChecking(true)
      const result = await checkSiteNow(parseInt(id))
      if (result.success) {
        // 重新加载数据
        await Promise.all([loadData(), loadMetrics()])
      } else {
        alert(`检查失败：${result.message}`)
      }
    } catch (err: any) {
      let errorMessage = '检查失败'
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
      console.error('检查站点失败:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleCalculateHealth = async () => {
    if (!id) return
    try {
      setCalculatingHealth(true)
      const result = await calculateHealthScore(parseInt(id))
      setHealthScore(result.health_score)
      // 重新加载数据以获取更新后的健康度评分
      await loadData()
    } catch (err: any) {
      let errorMessage = '计算健康度评分失败'
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
      console.error('计算健康度评分失败:', err)
    } finally {
      setCalculatingHealth(false)
    }
  }

  const getHealthScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthScoreBgColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100'
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const loadAlertRules = async () => {
    if (!id) return
    try {
      setLoadingAlerts(true)
      const response = await getAlertRules({
        resource_type: 'site',
        limit: 100
      })
      // 过滤出当前站点的告警规则
      const siteRules = response.items.filter(rule => 
        rule.resource_id === parseInt(id) || rule.resource_id === null
      )
      setAlertRules(siteRules)
    } catch (err) {
      console.error('加载告警规则失败:', err)
    } finally {
      setLoadingAlerts(false)
    }
  }

  const loadAlertHistory = async () => {
    if (!id) return
    try {
      const response = await getAlertHistory({
        resource_type: 'site',
        limit: 50
      })
      // 过滤出当前站点的告警历史
      const siteHistory = response.items.filter(alert => 
        alert.resource_id === parseInt(id)
      )
      setAlertHistory(siteHistory)
    } catch (err) {
      console.error('加载告警历史失败:', err)
    }
  }

  const handleDeleteAlert = async (ruleId: number) => {
    if (!window.confirm('确定要删除这个告警规则吗？')) {
      return
    }
    try {
      await deleteAlertRule(ruleId)
      loadAlertRules()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleToggleAlert = async (rule: AlertRule) => {
    try {
      await updateAlertRule(rule.id, {
        enabled: !rule.enabled
      })
      loadAlertRules()
    } catch (err: any) {
      alert(err.response?.data?.detail || '更新失败')
    }
  }

  const getConditionText = (condition: string) => {
    const map: Record<string, string> = {
      'gt': '大于',
      'gte': '大于等于',
      'lt': '小于',
      'lte': '小于等于',
      'eq': '等于',
      'ne': '不等于'
    }
    return map[condition] || condition
  }

  const getMetricNameText = (metricName: string) => {
    const map: Record<string, string> = {
      'response_time': '响应时间',
      'is_available': '可用性',
      'status_code': '状态码',
      'ssl_expiry': 'SSL证书过期'
    }
    return map[metricName] || metricName
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

  const getResponseTimeColor = (time?: number) => {
    if (!time) return 'text-gray-400'
    if (time > 2000) return 'text-red-600'
    if (time > 1000) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getSSLExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return { status: 'unknown', text: '未知', color: 'text-gray-400' }
    
    const expiry = new Date(expiryDate)
    const now = new Date()
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', text: '已过期', color: 'text-red-600' }
    } else if (daysUntilExpiry <= 7) {
      return { status: 'warning', text: `${daysUntilExpiry}天后过期`, color: 'text-red-600' }
    } else if (daysUntilExpiry <= 30) {
      return { status: 'warning', text: `${daysUntilExpiry}天后过期`, color: 'text-yellow-600' }
    } else {
      return { status: 'ok', text: `${daysUntilExpiry}天后过期`, color: 'text-green-600' }
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('zh-CN')
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

  // 计算可用性统计
  const calculateAvailability = () => {
    if (!metrics?.site_availability || metrics.site_availability.length === 0) {
      return { percentage: 0, total: 0, online: 0, offline: 0 }
    }
    
    const total = metrics.site_availability.length
    const online = metrics.site_availability.filter(item => item.is_available).length
    let percentage = 0
    if (total > 0) {
      percentage = Math.round((online / total) * 100 * 100) / 100
    }
    
    return {
      percentage: percentage,
      total: total,
      online: online,
      offline: total - online
    }
  }

  const availability = calculateAvailability()

  if (loading) {
    return <Loading />
  }

  if (error || !site) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error || '站点不存在'}</p>
        <button onClick={() => navigate('/sites')} className="btn-primary">
          返回列表
        </button>
      </div>
    )
  }

  const sslStatus = getSSLExpiryStatus(site.ssl_expiry)

  const tabs = [
    { id: 'status', label: '状态监控', icon: Activity },
    { id: 'history', label: '历史数据', icon: Clock },
    { id: 'alerts', label: '告警', icon: AlertCircle },
  ]

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sites')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{site.name}</h1>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
            >
              {site.url}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={handleCheckNow}
            disabled={checking}
            title="立即检查站点状态"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '检查中...' : '立即检查'}
          </button>
          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={handleRefresh}
            disabled={refreshing}
            title="刷新数据"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <div className={`w-3 h-3 rounded-full ${getStatusColor(site.status)}`}></div>
          <span className="text-sm text-gray-600">{getStatusText(site.status)}</span>
        </div>
      </div>

      {/* SSL证书过期提醒 */}
      {sslStatus.status === 'expired' || sslStatus.status === 'warning' ? (
        <div className={`card border-l-4 ${
          sslStatus.status === 'expired' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${
              sslStatus.status === 'expired' ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <div>
              <p className={`font-medium ${
                sslStatus.status === 'expired' ? 'text-red-800' : 'text-yellow-800'
              }`}>
                SSL证书{sslStatus.status === 'expired' ? '已过期' : '即将过期'}
              </p>
              <p className={`text-sm ${
                sslStatus.status === 'expired' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                过期时间: {formatDate(site.ssl_expiry)} ({sslStatus.text})
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">健康度评分</span>
                  <button
                    onClick={handleCalculateHealth}
                    disabled={calculatingHealth}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="重新计算健康度评分"
                  >
                    <RefreshCw className={`w-3 h-3 ${calculatingHealth ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getHealthScoreBgColor(healthScore)}`}>
                  <p className={`text-2xl font-bold ${getHealthScoreColor(healthScore)}`}>
                    {healthScore !== null ? healthScore : '--'}
                  </p>
                  {healthScore !== null && <span className="text-sm text-gray-600">/100</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {site.health_score_updated_at ? `更新于: ${formatTime(site.health_score_updated_at)}` : '点击刷新计算'}
                </p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">响应时间</span>
                </div>
                <p className={`text-2xl font-bold ${getResponseTimeColor(site.last_response_time)}`}>
                  {site.last_response_time ? `${site.last_response_time}ms` : '--'}
                </p>
                <p className="text-xs text-gray-500 mt-1">最后检查: {formatTime(site.last_check)}</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">站点状态</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(site.status)}`}></div>
                  <p className="text-2xl font-bold text-gray-900">{getStatusText(site.status)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">实时状态</p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">可用性</span>
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{availability.percentage}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  过去7天 ({availability.online}/{availability.total})
                </p>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">SSL证书</span>
                  <Shield className="w-4 h-4 text-gray-400" />
                </div>
                <p className={`text-2xl font-bold ${sslStatus.color}`}>
                  {formatDate(site.ssl_expiry)}
                </p>
                <p className={`text-xs mt-1 ${sslStatus.color}`}>
                  {sslStatus.text}
                </p>
              </div>
            </div>

            {/* 响应时间趋势图表 */}
            {metrics?.site_availability && metrics.site_availability.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">响应时间趋势（过去7天）</h3>
                <MetricChart
                  data={metrics.site_availability.map(item => ({
                    time: item.timestamp,
                    value: item.response_time || 0,
                  }))}
                  name="响应时间"
                  unit="ms"
                  color="#3b82f6"
                />
              </div>
            )}

            {/* 可用性统计图表 */}
            {metrics?.site_availability && metrics.site_availability.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">可用性统计（过去7天）</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">可用性趋势</p>
                    <MetricChart
                      data={metrics.site_availability.map(item => ({
                        time: item.timestamp,
                        value: item.is_available ? 100 : 0,
                      }))}
                      name="可用性"
                      unit="%"
                      color="#10b981"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">统计信息</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">总检查次数</span>
                        <span className="text-lg font-bold text-gray-900">{availability.total}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                        <span className="text-sm text-gray-600">在线次数</span>
                        <span className="text-lg font-bold text-green-600">{availability.online}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                        <span className="text-sm text-gray-600">离线次数</span>
                        <span className="text-lg font-bold text-red-600">{availability.offline}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                        <span className="text-sm text-gray-600">可用性</span>
                        <span className="text-lg font-bold text-blue-600">{availability.percentage}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 最近检查记录 */}
            {metrics?.site_availability && metrics.site_availability.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">最近检查记录</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">时间</th>
                        <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">状态</th>
                        <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">响应时间</th>
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">错误信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.site_availability.slice(-20).reverse().map((record, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-sm text-gray-900">
                            {new Date(record.timestamp).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              record.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {record.is_available ? '在线' : '离线'}
                            </span>
                          </td>
                          <td className={`py-2 px-4 text-sm text-right ${getResponseTimeColor(record.response_time)}`}>
                            {record.response_time ? `${record.response_time}ms` : '--'}
                          </td>
                          <td className="py-2 px-4 text-sm text-gray-600">
                            {record.error_message || '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {metrics?.site_availability && metrics.site_availability.length > 0 ? (
              <>
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">响应时间历史（过去7天）</h3>
                  <MetricChart
                    data={metrics.site_availability.map(item => ({
                      time: item.timestamp,
                      value: item.response_time || 0,
                    }))}
                    name="响应时间"
                    unit="ms"
                    color="#3b82f6"
                  />
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">可用性历史（过去7天）</h3>
                  <MetricChart
                    data={metrics.site_availability.map(item => ({
                      time: item.timestamp,
                      value: item.is_available ? 100 : 0,
                    }))}
                    name="可用性"
                    unit="%"
                    color="#10b981"
                  />
                </div>
              </>
            ) : (
              <div className="card text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无历史数据</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* 告警规则配置 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">告警规则</h3>
                <button
                  onClick={() => {
                    setEditingAlert(null)
                    setShowAlertForm(true)
                  }}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  添加规则
                </button>
              </div>

              {loadingAlerts ? (
                <div className="text-center py-8">
                  <Loading />
                </div>
              ) : alertRules.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  暂无告警规则，点击"添加规则"创建
                </div>
              ) : (
                <div className="space-y-3">
                  {alertRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900">{rule.name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {rule.enabled ? '已启用' : '已禁用'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {getMetricNameText(rule.metric_name)} {getConditionText(rule.condition)} {rule.threshold}
                          {rule.metric_name === 'response_time' && 'ms'}
                          {rule.metric_name === 'ssl_expiry' && '天'}
                          {rule.duration > 0 && ` (持续${rule.duration}秒)`}
                        </p>
                        {rule.description && (
                          <p className="text-xs text-gray-500">{rule.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleAlert(rule)}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                          title={rule.enabled ? '禁用' : '启用'}
                        >
                          {rule.enabled ? (
                            <ToggleRight className="w-5 h-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAlert(rule)
                            setShowAlertForm(true)
                          }}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(rule.id)}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 告警历史 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">告警历史</h3>
              {alertHistory.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  暂无告警记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">时间</th>
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">规则</th>
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">指标</th>
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">消息</th>
                        <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.map((alert) => (
                        <tr key={alert.id} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-sm text-gray-900">
                            {new Date(alert.created_at).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-2 px-4 text-sm text-gray-900">{alert.rule_name}</td>
                          <td className="py-2 px-4 text-sm text-gray-600">
                            {getMetricNameText(alert.metric_name)}: {alert.metric_value}
                          </td>
                          <td className="py-2 px-4 text-sm text-gray-600">{alert.message}</td>
                          <td className="py-2 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              alert.is_resolved 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {alert.is_resolved ? '已解决' : '未解决'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 告警规则表单 */}
            {showAlertForm && (
              <AlertRuleForm
                siteId={parseInt(id || '0')}
                rule={editingAlert}
                onClose={() => {
                  setShowAlertForm(false)
                  setEditingAlert(null)
                }}
                onSuccess={() => {
                  setShowAlertForm(false)
                  setEditingAlert(null)
                  loadAlertRules()
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 告警规则表单组件
function AlertRuleForm({
  siteId,
  rule,
  onClose,
  onSuccess
}: {
  siteId: number
  rule: AlertRule | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    metric_name: rule?.metric_name || 'response_time',
    condition: rule?.condition || 'gt',
    threshold: rule?.threshold || 1000,
    duration: rule?.duration || 60,
    enabled: rule?.enabled ?? true,
    description: rule?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.name.trim()) {
        setError('规则名称不能为空')
        return
      }

      if (rule) {
        // 更新规则
        await updateAlertRule(rule.id, {
          name: formData.name,
          metric_name: formData.metric_name,
          condition: formData.condition,
          threshold: formData.threshold,
          duration: formData.duration,
          enabled: formData.enabled,
          description: formData.description || undefined,
        })
      } else {
        // 创建规则
        const createData: AlertRuleCreate = {
          name: formData.name,
          resource_type: 'site',
          resource_id: siteId,
          metric_name: formData.metric_name,
          condition: formData.condition,
          threshold: formData.threshold,
          duration: formData.duration,
          enabled: formData.enabled,
          description: formData.description || undefined,
        }
        await createAlertRule(createData)
      }

      onSuccess()
    } catch (err: any) {
      let errorMessage = rule ? '更新失败' : '创建失败'
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
      console.error('保存告警规则失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {rule ? '编辑告警规则' : '添加告警规则'}
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
              规则名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入规则名称"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                监控指标 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.metric_name}
                onChange={(e) => setFormData({ ...formData, metric_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="response_time">响应时间</option>
                <option value="is_available">可用性</option>
                <option value="status_code">状态码</option>
                <option value="ssl_expiry">SSL证书过期</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                条件 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="gt">大于</option>
                <option value="gte">大于等于</option>
                <option value="lt">小于</option>
                <option value="lte">小于等于</option>
                <option value="eq">等于</option>
                <option value="ne">不等于</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                阈值 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="1000"
                required
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.metric_name === 'response_time' && '单位：毫秒(ms)'}
                {formData.metric_name === 'ssl_expiry' && '单位：天数'}
                {formData.metric_name === 'status_code' && 'HTTP状态码'}
                {formData.metric_name === 'is_available' && '0=离线, 1=在线'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                持续时间（秒）
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="60"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">条件持续满足多长时间后触发告警</p>
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
              placeholder="请输入规则描述（可选）"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
              启用规则
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
              {saving ? '保存中...' : rule ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
