import api from './api'

// 监控数据查询类型定义
export interface MetricQueryParams {
  resource_id: number
  resource_type: 'server' | 'device' | 'site' | 'database'
  start_time?: string
  end_time?: string
  interval?: '1m' | '5m' | '15m' | '1h' | '6h' | '1d'
}

export interface MetricData {
  time: string
  cpu_percent?: number
  memory_used?: number
  memory_total?: number
  memory_percent?: number
  disk_used?: number
  disk_total?: number
  disk_percent?: number
  network_in?: number
  network_out?: number
  // 站点可用性数据
  response_time?: number
  is_available?: boolean
  status_code?: number
  error_message?: string
  [key: string]: any
}

export interface SiteAvailabilityData {
  timestamp: string
  response_time?: number
  is_available?: boolean
  status_code?: number
  error_message?: string
}

export interface MetricResponse {
  resource_type: string
  resource_id: number
  metrics: MetricData[]
  start_time: string
  end_time: string
  // 站点可用性数据（当resource_type为site时）
  site_availability?: SiteAvailabilityData[]
}

// 告警规则类型定义
export interface AlertRule {
  id: number
  name: string
  resource_type: string
  resource_id?: number
  metric_name: string
  condition: string
  threshold: number
  duration: number
  enabled: boolean
  description?: string
  created_at: string
  updated_at: string
}

export interface AlertRuleListResponse {
  total: number
  items: AlertRule[]
}

export interface AlertRuleCreate {
  name: string
  resource_type: string
  resource_id?: number
  metric_name: string
  condition: string
  threshold: number
  duration?: number
  enabled?: boolean
  description?: string
}

// 告警历史类型定义
export interface AlertHistory {
  id: number
  rule_id: number
  rule_name: string
  resource_type: string
  resource_id: number
  resource_name: string
  metric_name: string
  metric_value: number
  threshold: number
  message: string
  severity: string
  is_resolved: boolean
  resolved_at?: string
  created_at: string
}

export interface AlertHistoryListResponse {
  total: number
  items: AlertHistory[]
}

// 仪表盘统计类型定义
export interface DashboardStats {
  sites_total: number
  sites_online: number
  sites_offline: number
  servers_total: number
  servers_online: number
  servers_offline: number
  devices_total: number
  devices_online: number
  devices_offline: number
  databases_total: number
  databases_online: number
  databases_offline: number
  alerts_unresolved: number
  alerts_today: number
}

// API方法

/**
 * 获取监控数据
 */
export const getMetrics = async (
  resourceType: string,
  resourceId: number,
  params?: {
    start_time?: string
    end_time?: string
    interval?: string
  }
): Promise<MetricResponse> => {
  return api.get(`/monitoring/metrics/${resourceType}/${resourceId}`, { params })
}

/**
 * 获取告警规则列表
 */
export const getAlertRules = async (params?: {
  skip?: number
  limit?: number
  resource_type?: string
  enabled?: boolean
}): Promise<AlertRuleListResponse> => {
  return api.get('/monitoring/alert-rules', { params })
}

/**
 * 创建告警规则
 */
export const createAlertRule = async (data: AlertRuleCreate): Promise<AlertRule> => {
  return api.post('/monitoring/alert-rules', data)
}

/**
 * 删除告警规则
 */
export const deleteAlertRule = async (ruleId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/monitoring/alert-rules/${ruleId}`)
}

/**
 * 获取告警历史
 */
export const getAlertHistory = async (params?: {
  skip?: number
  limit?: number
  is_resolved?: boolean
  resource_type?: string
}): Promise<AlertHistoryListResponse> => {
  return api.get('/monitoring/alert-history', { params })
}

/**
 * 获取仪表盘统计数据
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  return api.get('/monitoring/dashboard/stats')
}
