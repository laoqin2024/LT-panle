import api from './api'

// 应用类型定义
export interface Application {
  id: number
  name: string
  site_id?: number
  app_type?: string
  config?: Record<string, any>
  port?: number
  process_name?: string
  description?: string
  status: string
  created_at: string
  updated_at: string
  created_by?: number
  site?: {
    id: number
    name: string
    url: string
  }
}

export interface ApplicationListResponse {
  total: number
  items: Application[]
}

export interface ApplicationCreate {
  name: string
  site_id?: number
  app_type?: string
  config?: Record<string, any>
  port?: number
  process_name?: string
  description?: string
}

export interface ApplicationUpdate {
  name?: string
  site_id?: number
  app_type?: string
  config?: Record<string, any>
  port?: number
  process_name?: string
  description?: string
}

// API方法

/**
 * 获取应用列表
 */
export const getApplications = async (params?: {
  skip?: number
  limit?: number
  status?: string
  app_type?: string
  site_id?: number
  search?: string
}): Promise<ApplicationListResponse> => {
  return api.get('/applications', { params })
}

/**
 * 获取应用详情
 */
export const getApplication = async (applicationId: number): Promise<Application> => {
  return api.get(`/applications/${applicationId}`)
}

/**
 * 创建应用
 */
export const createApplication = async (data: ApplicationCreate): Promise<Application> => {
  return api.post('/applications', data)
}

/**
 * 更新应用
 */
export const updateApplication = async (applicationId: number, data: ApplicationUpdate): Promise<Application> => {
  return api.put(`/applications/${applicationId}`, data)
}

/**
 * 删除应用
 */
export const deleteApplication = async (applicationId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/applications/${applicationId}`)
}

/**
 * 获取应用状态
 */
export const getApplicationStatus = async (applicationId: number): Promise<any> => {
  return api.get(`/applications/${applicationId}/status`)
}
