import api from './api'

// 操作日志类型定义
export interface OperationLog {
  id: number
  user_id: number
  username?: string
  action: string
  resource_type?: string
  resource_id?: number
  details?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface OperationLogListResponse {
  total: number
  items: OperationLog[]
}

export interface LogStats {
  total: number
  action_stats: Record<string, number>
  resource_stats: Record<string, number>
  user_stats: Record<string, number>
}

// API方法

/**
 * 获取操作日志列表
 */
export const getOperationLogs = async (params?: {
  skip?: number
  limit?: number
  user_id?: number
  action?: string
  resource_type?: string
  resource_id?: number
  start_time?: string
  end_time?: string
  search?: string
}): Promise<OperationLogListResponse> => {
  return api.get('/logs', { params })
}

/**
 * 获取操作日志详情
 */
export const getOperationLog = async (logId: number): Promise<OperationLog> => {
  return api.get(`/logs/${logId}`)
}

/**
 * 获取操作日志统计
 */
export const getLogStats = async (params?: {
  start_time?: string
  end_time?: string
}): Promise<LogStats> => {
  return api.get('/logs/stats/summary', { params })
}
