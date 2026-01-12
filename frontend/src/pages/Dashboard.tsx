import { useState, useEffect, useRef } from 'react'
import { Cpu, HardDrive, Activity, Server, Network, Database, Globe, AlertCircle } from 'lucide-react'
import { getDashboardStats, getAlertHistory, type DashboardStats, type AlertHistory } from '../services/monitoring'
import { getWebSocketClient, type AlertMessage } from '../services/websocket'
import Loading from '../components/Loading'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alerts, setAlerts] = useState<AlertHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const wsClientRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    connectWebSocket()

    return () => {
      // 清理WebSocket连接
      if (wsClientRef.current) {
        wsClientRef.current.disconnect()
      }
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [statsData, alertsData] = await Promise.all([
        getDashboardStats(),
        getAlertHistory({ limit: 5, is_resolved: false })
      ])

      setStats(statsData)
      setAlerts(alertsData.items)
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
      console.error('加载仪表盘数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('未找到认证token')
        return
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const wsClient = getWebSocketClient(baseUrl, token)

      // 注册告警消息处理器
      wsClient.on('alert', (message: AlertMessage) => {
        // 添加新告警到列表
        const newAlert: AlertHistory = {
          id: message.data.id,
          rule_id: 0,
          rule_name: message.data.rule_name,
          resource_type: message.data.resource_type,
          resource_id: message.data.resource_id,
          resource_name: '',
          metric_name: '',
          metric_value: 0,
          threshold: 0,
          message: message.data.message,
          severity: message.data.severity,
          is_resolved: false,
          created_at: message.timestamp,
        }
        setAlerts(prev => [newAlert, ...prev.slice(0, 4)])
        // 更新统计数据
        if (stats) {
          setStats({
            ...stats,
            alerts_unresolved: stats.alerts_unresolved + 1,
            alerts_today: stats.alerts_today + 1,
          })
        }
      })

      wsClient.on('connected', () => {
        setWsConnected(true)
      })

      // 连接WebSocket
      await wsClient.connect()
      wsClientRef.current = wsClient
    } catch (err) {
      console.error('WebSocket连接失败:', err)
      // WebSocket连接失败不影响页面显示
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

  if (!stats) {
    return null
  }

  // 构建统计卡片数据
  const statsCards = [
    { 
      label: '业务站点', 
      value: stats.sites_total.toString(), 
      online: stats.sites_online,
      offline: stats.sites_offline,
      icon: Globe, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50' 
    },
    { 
      label: '服务器总数', 
      value: stats.servers_total.toString(), 
      online: stats.servers_online,
      offline: stats.servers_offline,
      icon: Server, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: '网络设备', 
      value: stats.devices_total.toString(), 
      online: stats.devices_online,
      offline: stats.devices_offline,
      icon: Network, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: '数据库', 
      value: stats.databases_total.toString(), 
      online: stats.databases_online,
      offline: stats.databases_offline,
      icon: Database, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
  ]

  // 系统状态（使用模拟数据，实际应该从监控API获取）
  const systemStatus = [
    { label: 'CPU', value: '45%', used: 45, total: 100, icon: Cpu },
    { label: '内存', value: '6.2 GB / 16 GB', used: 6200, total: 16000, icon: Activity },
    { label: '磁盘', value: '234 GB / 500 GB', used: 234, total: 500, icon: HardDrive },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-gray-600 mt-1">系统概览和实时状态</p>
        </div>
        {wsConnected && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            实时数据已连接
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-green-600">在线: {stat.online}</span>
                    <span className="text-red-600">离线: {stat.offline}</span>
                  </div>
                </div>
                <div className={`${stat.bg} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 告警信息 */}
      {stats.alerts_unresolved > 0 && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-red-900">未处理告警</h2>
            <span className="px-2 py-1 bg-red-600 text-white text-sm rounded-full">
              {stats.alerts_unresolved}
            </span>
          </div>
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 bg-white rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alert.rule_name}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      alert.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.severity === 'error' ? '严重' : '警告'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 系统状态 */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">系统状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {systemStatus.map((status) => {
            const Icon = status.icon
            const percentage = (status.used / status.total) * 100
            return (
              <div key={status.label} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">{status.label}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{status.value}</span>
                    <span className="text-sm font-medium text-gray-900">{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 告警统计和最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">告警统计</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">今日告警</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.alerts_today}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">未处理告警</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.alerts_unresolved}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">快速操作</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '添加站点', icon: Globe },
              { label: '添加服务器', icon: Server },
              { label: '添加设备', icon: Network },
              { label: '添加数据库', icon: Database },
            ].map((action, index) => {
              const Icon = action.icon
              return (
                <button
                  key={index}
                  className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Icon className="w-6 h-6 text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

