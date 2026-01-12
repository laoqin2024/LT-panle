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
  TrendingUp
} from 'lucide-react'
import { getSite, getSiteStatus, type BusinessSite } from '../services/sites'
import { getMetrics, type MetricResponse } from '../services/monitoring'
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

  useEffect(() => {
    if (id) {
      loadData()
      loadMetrics()
    }
  }, [id])

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
            onClick={handleRefresh}
            disabled={refreshing}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">告警记录</h3>
            <div className="text-sm text-gray-500 text-center py-8">
              暂无告警记录
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
