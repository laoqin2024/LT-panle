import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, Server, Network, Database, Globe } from 'lucide-react'
import { getMetrics, type MetricResponse } from '../services/monitoring'
import { getWebSocketClient, type MetricMessage } from '../services/websocket'
import MetricChart, { type MetricDataPoint } from '../components/MetricChart'
import Loading from '../components/Loading'

const RESOURCE_ICONS: Record<string, any> = {
  server: Server,
  device: Network,
  database: Database,
  site: Globe,
}

export default function Monitoring() {
  const { resourceType, resourceId } = useParams<{ resourceType: string; resourceId: string }>()
  const [metrics, setMetrics] = useState<MetricDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const wsClientRef = useRef<any>(null)
  const metricsRef = useRef<MetricDataPoint[]>([])

  useEffect(() => {
    if (!resourceType || !resourceId) {
      setError('缺少资源类型或ID')
      setLoading(false)
      return
    }

    loadHistoricalData()
    connectWebSocket()

    return () => {
      // 清理WebSocket连接
      if (wsClientRef.current) {
        wsClientRef.current.unsubscribe(resourceType, parseInt(resourceId))
        wsClientRef.current.disconnect()
      }
    }
  }, [resourceType, resourceId])

  const loadHistoricalData = async () => {
    try {
      setLoading(true)
      setError(null)

      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000) // 24小时前

      const response: MetricResponse = await getMetrics(
        resourceType!,
        parseInt(resourceId!),
        {
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          interval: '1h'
        }
      )

      const formattedMetrics: MetricDataPoint[] = response.metrics.map(m => ({
        time: m.time,
        cpu_percent: m.cpu_percent,
        memory_percent: m.memory_percent,
        disk_percent: m.disk_percent,
        network_in: m.network_in,
        network_out: m.network_out,
      }))

      metricsRef.current = formattedMetrics
      setMetrics(formattedMetrics)
    } catch (err: any) {
      let errorMessage = '加载历史数据失败'
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
      console.error('加载监控数据失败:', err)
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

      // 注册消息处理器
      wsClient.on('metric', (message: MetricMessage) => {
        if (
          message.resource_type === resourceType &&
          message.resource_id === parseInt(resourceId!)
        ) {
          // 添加新的监控数据点
          const newPoint: MetricDataPoint = {
            time: message.timestamp,
            cpu_percent: message.data.cpu_percent,
            memory_percent: message.data.memory_percent,
            disk_percent: message.data.disk_percent,
            network_in: message.data.network_in,
            network_out: message.data.network_out,
          }

          // 更新指标数据（保留最近100个数据点）
          metricsRef.current = [...metricsRef.current.slice(-99), newPoint]
          setMetrics([...metricsRef.current])
        }
      })

      wsClient.on('connected', () => {
        setWsConnected(true)
        // 订阅资源
        wsClient.subscribe(resourceType!, parseInt(resourceId!))
      })

      wsClient.on('error', (message: any) => {
        console.error('WebSocket错误:', message)
      })

      // 连接WebSocket
      await wsClient.connect()
      wsClientRef.current = wsClient
    } catch (err) {
      console.error('WebSocket连接失败:', err)
      setError('WebSocket连接失败，将仅显示历史数据')
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error && metrics.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadHistoricalData} className="btn-primary">
          重试
        </button>
      </div>
    )
  }

  const Icon = resourceType ? RESOURCE_ICONS[resourceType] || Activity : Activity

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-gray-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">实时监控</h1>
            <p className="text-gray-600 mt-1">
              {resourceType} #{resourceId}
              {wsConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  实时数据已连接
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 实时状态卡片 */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">CPU使用率</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics[metrics.length - 1]?.cpu_percent?.toFixed(1) || '-'}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">内存使用率</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics[metrics.length - 1]?.memory_percent?.toFixed(1) || '-'}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">磁盘使用率</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics[metrics.length - 1]?.disk_percent?.toFixed(1) || '-'}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
      )}

      {/* 监控图表 */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">资源使用率趋势</h2>
        {metrics.length > 0 ? (
          <MetricChart
            data={metrics}
            metrics={['cpu_percent', 'memory_percent', 'disk_percent']}
            height={400}
            type="area"
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>暂无监控数据</p>
          </div>
        )}
      </div>

      {/* 网络流量图表 */}
      {(metrics[metrics.length - 1]?.network_in || metrics[metrics.length - 1]?.network_out) && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">网络流量趋势</h2>
          <MetricChart
            data={metrics}
            metrics={['network_in', 'network_out']}
            height={300}
            type="line"
          />
        </div>
      )}

      {error && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">{error}</p>
        </div>
      )}
    </div>
  )
}
