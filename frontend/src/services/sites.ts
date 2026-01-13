import api from './api'

// 业务站点类型定义
export interface BusinessSite {
  id: number
  name: string
  url: string
  type?: string
  group_id?: number
  description?: string
  status: string
  last_check?: string
  last_response_time?: number
  ssl_expiry?: string
  is_monitored: boolean
  // 检查配置
  check_interval?: number
  check_timeout?: number
  check_config?: Record<string, any>
  // 维护模式
  is_maintenance: boolean
  maintenance_start?: string
  maintenance_end?: string
  maintenance_note?: string
  // 健康度评分
  health_score?: number
  health_score_updated_at?: string
  created_at: string
  updated_at: string
  group?: BusinessGroup
}

export interface BusinessGroup {
  id: number
  name: string
  type?: string
  description?: string
  parent_id?: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BusinessSiteListResponse {
  total: number
  items: BusinessSite[]
}

export interface BusinessSiteCreate {
  name: string
  url: string
  type?: string
  group_id?: number
  description?: string
  is_monitored?: boolean
}

export interface BusinessSiteUpdate {
  name?: string
  url?: string
  type?: string
  group_id?: number
  description?: string
  is_monitored?: boolean
  // 检查配置
  check_interval?: number
  check_timeout?: number
  check_config?: Record<string, any>
  // 维护模式
  is_maintenance?: boolean
  maintenance_start?: string
  maintenance_end?: string
  maintenance_note?: string
}

// API方法

/**
 * 获取站点列表
 */
export const getSites = async (params?: {
  skip?: number
  limit?: number
  group_id?: number
  status?: string
  search?: string
}): Promise<BusinessSiteListResponse> => {
  return api.get('/sites', { params })
}

/**
 * 获取站点详情
 */
export const getSite = async (siteId: number): Promise<BusinessSite> => {
  return api.get(`/sites/${siteId}`)
}

/**
 * 创建站点
 */
export const createSite = async (data: BusinessSiteCreate): Promise<BusinessSite> => {
  return api.post('/sites', data)
}

/**
 * 更新站点
 */
export const updateSite = async (siteId: number, data: BusinessSiteUpdate): Promise<BusinessSite> => {
  return api.put(`/sites/${siteId}`, data)
}

/**
 * 删除站点
 */
export const deleteSite = async (siteId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/sites/${siteId}`)
}

/**
 * 获取站点状态
 */
export const getSiteStatus = async (siteId: number): Promise<{
  id: number
  name: string
  url: string
  status: string
  last_check?: string
  last_response_time?: number
  ssl_expiry?: string
  is_monitored: boolean
}> => {
  return api.get(`/sites/${siteId}/status`)
}

/**
 * 获取分组列表
 */
export const getGroups = async (): Promise<BusinessGroup[]> => {
  return api.get('/sites/groups')
}

/**
 * 创建分组
 */
export const createGroup = async (data: {
  name: string
  type?: string
  description?: string
  parent_id?: number
  sort_order?: number
}): Promise<BusinessGroup> => {
  return api.post('/sites/groups', data)
}

/**
 * 更新分组
 */
export const updateGroup = async (groupId: number, data: {
  name?: string
  type?: string
  description?: string
  parent_id?: number
  sort_order?: number
}): Promise<BusinessGroup> => {
  return api.put(`/sites/groups/${groupId}`, data)
}

/**
 * 删除分组
 */
export const deleteGroup = async (groupId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/sites/groups/${groupId}`)
}

/**
 * 立即检查站点
 */
export const checkSiteNow = async (siteId: number): Promise<{
  success: boolean
  status: string
  response_time?: number
  status_code?: number
  ssl_expiry?: string
  message: string
}> => {
  return api.post(`/sites/${siteId}/check`)
}

/**
 * 批量删除站点
 */
export const batchDeleteSites = async (siteIds: number[]): Promise<{ message: string; success: boolean }> => {
  return api.post('/sites/batch/delete', siteIds)
}

/**
 * 批量更新监控状态
 */
export const batchUpdateMonitoring = async (siteIds: number[], isMonitored: boolean): Promise<{ message: string; success: boolean }> => {
  return api.post('/sites/batch/update-monitoring', {
    site_ids: siteIds,
    is_monitored: isMonitored
  })
}

/**
 * 计算站点健康度评分
 */
export const calculateHealthScore = async (siteId: number): Promise<{
  health_score: number
  breakdown: {
    status_score: number
    response_time_score: number
    availability_score: number
    ssl_score: number
  }
}> => {
  return api.get(`/sites/${siteId}/health-score`)
}
