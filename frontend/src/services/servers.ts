import api from './api'

// 服务器类型定义
export interface Server {
  id: number
  name: string
  host: string
  port: number
  server_type?: string
  network_type: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
  status: string
  os_info?: Record<string, any>
  last_check?: string
  created_at: string
  updated_at: string
  created_by?: number
  jump_host?: Server
}

export interface ServerListResponse {
  total: number
  items: Server[]
}

export interface ServerCreate {
  name: string
  host: string
  port?: number
  server_type?: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

export interface ServerUpdate {
  name?: string
  host?: string
  port?: number
  server_type?: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

// API方法

/**
 * 获取服务器列表
 */
export const getServers = async (params?: {
  skip?: number
  limit?: number
  status?: string
  server_type?: string
  search?: string
}): Promise<ServerListResponse> => {
  return api.get('/servers', { params })
}

/**
 * 获取服务器详情
 */
export const getServer = async (serverId: number): Promise<Server> => {
  return api.get(`/servers/${serverId}`)
}

/**
 * 创建服务器
 */
export const createServer = async (data: ServerCreate): Promise<Server> => {
  return api.post('/servers', data)
}

/**
 * 更新服务器
 */
export const updateServer = async (serverId: number, data: ServerUpdate): Promise<Server> => {
  return api.put(`/servers/${serverId}`, data)
}

/**
 * 删除服务器
 */
export const deleteServer = async (serverId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/servers/${serverId}`)
}

/**
 * 获取服务器监控数据
 */
export const getServerMetrics = async (
  serverId: number,
  params?: {
    start_time?: string
    end_time?: string
  }
): Promise<any> => {
  return api.get(`/servers/${serverId}/metrics`, { params })
}

