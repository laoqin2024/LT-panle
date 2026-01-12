/**
 * 类型定义
 */

// 用户类型
export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
}

// 服务器类型
export interface Server {
  id: number
  name: string
  host: string
  port: number
  username?: string
  server_type: string
  status: 'online' | 'offline' | 'unknown'
  os_info?: Record<string, any>
  created_at: string
  updated_at: string
}

// 网络设备类型
export interface NetworkDevice {
  id: number
  name: string
  ip: string
  device_type: string
  protocol: 'SSH' | 'Telnet' | 'SNMP'
  status: 'online' | 'offline' | 'warning'
  created_at: string
}

// 数据库类型
export interface Database {
  id: number
  name: string
  type: 'PostgreSQL' | 'MySQL' | 'SQL Server'
  host: string
  port: number
  database: string
  status: 'online' | 'offline' | 'warning'
  created_at: string
}

// 业务站点类型
export interface BusinessSite {
  id: number
  name: string
  url: string
  type: string
  group_id?: number
  status: 'online' | 'offline' | 'warning'
  created_at: string
}

// 凭据类型
export interface Credential {
  id: number
  resource_type: 'server' | 'device' | 'database' | 'site'
  resource_id: number
  credential_type: 'password' | 'ssh_key'
  username: string
  description?: string
  created_at: string
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

