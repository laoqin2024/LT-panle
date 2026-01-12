import { useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export interface MetricDataPoint {
  time: string
  cpu_percent?: number
  memory_percent?: number
  disk_percent?: number
  network_in?: number
  network_out?: number
  [key: string]: any
}

interface MetricChartProps {
  data: MetricDataPoint[]
  metrics?: string[] // 要显示的指标，如 ['cpu_percent', 'memory_percent']
  height?: number
  type?: 'line' | 'area'
}

export default function MetricChart({ 
  data, 
  metrics = ['cpu_percent', 'memory_percent'],
  height = 300,
  type = 'line'
}: MetricChartProps) {
  // 格式化时间显示
  const formattedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      time: new Date(item.time).toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }))
  }, [data])

  // 指标配置
  const metricConfig: Record<string, { name: string; color: string; unit?: string }> = {
    cpu_percent: { name: 'CPU使用率', color: '#3b82f6', unit: '%' },
    memory_percent: { name: '内存使用率', color: '#10b981', unit: '%' },
    disk_percent: { name: '磁盘使用率', color: '#f59e0b', unit: '%' },
    network_in: { name: '网络入流量', color: '#8b5cf6', unit: 'B/s' },
    network_out: { name: '网络出流量', color: '#ef4444', unit: 'B/s' },
  }

  // 格式化数值
  const formatValue = (value: number | undefined, unit?: string): string => {
    if (value === undefined || value === null) return '-'
    if (unit === '%') {
      return `${value.toFixed(1)}%`
    }
    if (unit === 'B/s') {
      // 格式化字节
      if (value < 1024) return `${value.toFixed(0)} B/s`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB/s`
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB/s`
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB/s`
    }
    return value.toFixed(1)
  }

  const ChartComponent = type === 'area' ? AreaChart : LineChart
  const DataComponent = type === 'area' ? Area : Line

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="time" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px'
          }}
          formatter={(value: any, name: string) => {
            const config = metricConfig[name]
            return [formatValue(value, config?.unit), config?.name || name]
          }}
        />
        <Legend 
          formatter={(name: string) => {
            const config = metricConfig[name]
            return config?.name || name
          }}
        />
        {metrics.map((metric) => {
          const config = metricConfig[metric]
          if (!config) return null
          
          return (
            <DataComponent
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={config.color}
              fill={config.color}
              fillOpacity={type === 'area' ? 0.1 : 0}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )
        })}
      </ChartComponent>
    </ResponsiveContainer>
  )
}
