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

