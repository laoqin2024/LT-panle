import api from './api'

// 凭据类型定义
export interface Credential {
  id: number
  resource_type: string
  resource_id: number
  credential_type: string
  username?: string
  ssh_key_path?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: number
}

export interface CredentialListResponse {
  total: number
  items: Credential[]
}

export interface CredentialCreate {
  resource_type: string
  resource_id: number
  credential_type: string
  username?: string
  password?: string
  ssh_key_path?: string
  description?: string
  is_active?: boolean
}

export interface CredentialUpdate {
  credential_type?: string
  username?: string
  password?: string
  ssh_key_path?: string
  description?: string
  is_active?: boolean
}

export interface CredentialDecryptResponse {
  password: string
  message: string
}

export interface CredentialAccessLog {
  id: number
  user_id: number
  action: string
  ip_address?: string
  user_agent?: string
  accessed_at: string
  success: boolean
}

// API方法

/**
 * 获取凭据列表
 */
export const getCredentials = async (params?: {
  skip?: number
  limit?: number
  resource_type?: string
  resource_id?: number
  credential_type?: string
  search?: string
}): Promise<CredentialListResponse> => {
  return api.get('/credentials', { params })
}

/**
 * 获取凭据详情
 */
export const getCredential = async (credentialId: number): Promise<Credential> => {
  return api.get(`/credentials/${credentialId}`)
}

/**
 * 创建凭据
 */
export const createCredential = async (data: CredentialCreate): Promise<Credential> => {
  return api.post('/credentials', data)
}

/**
 * 更新凭据
 */
export const updateCredential = async (credentialId: number, data: CredentialUpdate): Promise<Credential> => {
  return api.put(`/credentials/${credentialId}`, data)
}

/**
 * 删除凭据
 */
export const deleteCredential = async (credentialId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/credentials/${credentialId}`)
}

/**
 * 解密凭据密码
 */
export const decryptCredential = async (credentialId: number): Promise<CredentialDecryptResponse> => {
  return api.post(`/credentials/${credentialId}/decrypt`)
}

/**
 * 获取凭据访问日志
 */
export const getCredentialLogs = async (
  credentialId: number,
  params?: {
    skip?: number
    limit?: number
  }
): Promise<{ total: number; items: CredentialAccessLog[] }> => {
  return api.get(`/credentials/${credentialId}/logs`, { params })
}

/**
 * 测试凭据连接
 */
export const testCredentialConnection = async (
  credentialId: number
): Promise<{
  success: boolean
  message: string
  output?: string
  server_host?: string
  server_port?: number
  username?: string
}> => {
  return api.post(`/credentials/${credentialId}/test`)
}
