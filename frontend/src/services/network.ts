import api from './api'

// 跳板机类型定义
export interface JumpHost {
  id: number
  name: string
  host: string
  port: number
  status: string
  description?: string
}

export interface JumpHostListResponse {
  total: number
  items: JumpHost[]
}

// VPN配置类型定义
export interface VPNConfig {
  id: number
  name: string
  type: string
  config_file?: string
  config_content?: string
  description?: string
  status?: string
  connected_at?: string
  created_at: string
  updated_at: string
}

export interface VPNConfigListResponse {
  total: number
  items: VPNConfig[]
}

export interface VPNConfigCreate {
  name: string
  type: string
  config_file?: string
  config_content?: string
  description?: string
}

// 内网穿透配置类型定义
export interface TunnelConfig {
  id: number
  name: string
  server_url: string
  client_token?: string
  description?: string
  status?: string
  connected_at?: string
  created_at: string
  updated_at: string
}

export interface TunnelConfigListResponse {
  total: number
  items: TunnelConfig[]
}

export interface TunnelConfigCreate {
  name: string
  server_url: string
  client_token?: string
  description?: string
}

// 网络测试类型定义
export interface NetworkTestRequest {
  host: string
  port: number
  timeout?: number
}

export interface NetworkTestResponse {
  success: boolean
  message: string
  latency?: number
}

// API方法

/**
 * 获取跳板机列表
 */
export const getJumpHosts = async (): Promise<JumpHostListResponse> => {
  return api.get('/network/jump-hosts')
}

/**
 * 获取VPN配置列表
 */
export const getVPNConfigs = async (params?: {
  skip?: number
  limit?: number
}): Promise<VPNConfigListResponse> => {
  return api.get('/network/vpn-configs', { params })
}

/**
 * 创建VPN配置
 */
export const createVPNConfig = async (data: VPNConfigCreate): Promise<VPNConfig> => {
  return api.post('/network/vpn-configs', data)
}

/**
 * 删除VPN配置
 */
export const deleteVPNConfig = async (configId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/network/vpn-configs/${configId}`)
}

/**
 * 获取内网穿透配置列表
 */
export const getTunnelConfigs = async (params?: {
  skip?: number
  limit?: number
}): Promise<TunnelConfigListResponse> => {
  return api.get('/network/tunnel-configs', { params })
}

/**
 * 创建内网穿透配置
 */
export const createTunnelConfig = async (data: TunnelConfigCreate): Promise<TunnelConfig> => {
  return api.post('/network/tunnel-configs', data)
}

/**
 * 删除内网穿透配置
 */
export const deleteTunnelConfig = async (configId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/network/tunnel-configs/${configId}`)
}

/**
 * 测试网络连接
 */
export const testNetworkConnection = async (data: NetworkTestRequest): Promise<NetworkTestResponse> => {
  return api.post('/network/test', data)
}
