import api from './api'

// 数据库类型定义
export interface Database {
  id: number
  name: string
  type: string
  host: string
  port: number
  database: string
  network_type: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
  status: string
  last_check?: string
  created_at: string
  updated_at: string
  created_by?: number
  jump_host?: any
}

export interface DatabaseListResponse {
  total: number
  items: Database[]
}

export interface DatabaseCreate {
  name: string
  type: string
  host: string
  port: number
  database: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

export interface DatabaseUpdate {
  name?: string
  type?: string
  host?: string
  port?: number
  database?: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

export interface DatabaseTestResponse {
  success: boolean
  message: string
  connection_time?: number
}

// API方法

/**
 * 获取数据库列表
 */
export const getDatabases = async (params?: {
  skip?: number
  limit?: number
  status?: string
  db_type?: string
  search?: string
}): Promise<DatabaseListResponse> => {
  return api.get('/databases', { params })
}

/**
 * 获取数据库详情
 */
export const getDatabase = async (databaseId: number): Promise<Database> => {
  return api.get(`/databases/${databaseId}`)
}

/**
 * 创建数据库连接
 */
export const createDatabase = async (data: DatabaseCreate): Promise<Database> => {
  return api.post('/databases', data)
}

/**
 * 更新数据库连接
 */
export const updateDatabase = async (databaseId: number, data: DatabaseUpdate): Promise<Database> => {
  return api.put(`/databases/${databaseId}`, data)
}

/**
 * 删除数据库连接
 */
export const deleteDatabase = async (databaseId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/databases/${databaseId}`)
}

/**
 * 测试数据库连接
 */
export const testDatabaseConnection = async (databaseId: number): Promise<DatabaseTestResponse> => {
  return api.post(`/databases/${databaseId}/test`)
}
