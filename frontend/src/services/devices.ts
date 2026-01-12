import api from './api'

// 网络设备类型定义
export interface DeviceInterface {
  id: number
  device_id: number
  name: string
  interface_type?: string
  status?: string
  speed?: string
  duplex?: string
  bytes_in: number
  bytes_out: number
  packets_in: number
  packets_out: number
  errors_in: number
  errors_out: number
  last_update?: string
}

export interface NetworkDevice {
  id: number
  name: string
  ip: string
  device_type?: string
  model?: string
  vendor: string
  system_version?: string
  protocol: string
  snmp_version?: string
  snmp_community?: string
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
  interfaces?: DeviceInterface[]
  interface_count?: {
    up: number
    down: number
    total: number
  }
}

export interface NetworkDeviceListResponse {
  total: number
  items: NetworkDevice[]
}

export interface NetworkDeviceCreate {
  name: string
  ip: string
  device_type?: string
  model?: string
  vendor?: string
  system_version?: string
  protocol?: string
  snmp_version?: string
  snmp_community?: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

export interface NetworkDeviceUpdate {
  name?: string
  ip?: string
  device_type?: string
  model?: string
  vendor?: string
  system_version?: string
  protocol?: string
  snmp_version?: string
  snmp_community?: string
  network_type?: string
  jump_host_id?: number
  vpn_config?: Record<string, any>
  tunnel_config?: Record<string, any>
  description?: string
}

// API方法

/**
 * 获取网络设备列表
 */
export const getDevices = async (params?: {
  skip?: number
  limit?: number
  status?: string
  device_type?: string
  vendor?: string
  search?: string
}): Promise<NetworkDeviceListResponse> => {
  return api.get('/devices', { params })
}

/**
 * 获取网络设备详情
 */
export const getDevice = async (deviceId: number): Promise<NetworkDevice> => {
  return api.get(`/devices/${deviceId}`)
}

/**
 * 创建网络设备
 */
export const createDevice = async (data: NetworkDeviceCreate): Promise<NetworkDevice> => {
  return api.post('/devices', data)
}

/**
 * 更新网络设备
 */
export const updateDevice = async (deviceId: number, data: NetworkDeviceUpdate): Promise<NetworkDevice> => {
  return api.put(`/devices/${deviceId}`, data)
}

/**
 * 删除网络设备
 */
export const deleteDevice = async (deviceId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/devices/${deviceId}`)
}

/**
 * 获取设备接口列表
 */
export const getDeviceInterfaces = async (deviceId: number): Promise<DeviceInterface[]> => {
  return api.get(`/devices/${deviceId}/interfaces`)
}

