import api from './api'

// 备份类型定义
export interface Backup {
  id: number
  backup_name: string
  backup_type: string
  file_path?: string
  file_size?: number
  status: string
  backup_metadata?: Record<string, any>
  created_at: string
  created_by?: number
}

export interface BackupListResponse {
  total: number
  items: Backup[]
}

export interface BackupCreate {
  backup_name: string
  backup_type: string
  backup_metadata?: Record<string, any>
}

export interface Restore {
  id: number
  backup_id: number
  status: string
  started_at: string
  completed_at?: string
  error_message?: string
  restored_by: number
  backup?: Backup
}

export interface RestoreListResponse {
  total: number
  items: Restore[]
}

// API方法

/**
 * 获取备份列表
 */
export const getBackups = async (params?: {
  skip?: number
  limit?: number
  backup_type?: string
  status?: string
}): Promise<BackupListResponse> => {
  return api.get('/backups', { params })
}

/**
 * 获取备份详情
 */
export const getBackup = async (backupId: number): Promise<Backup> => {
  return api.get(`/backups/${backupId}`)
}

/**
 * 创建备份
 */
export const createBackup = async (data: BackupCreate): Promise<Backup> => {
  return api.post('/backups', data)
}

/**
 * 删除备份
 */
export const deleteBackup = async (backupId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/backups/${backupId}`)
}

/**
 * 恢复备份
 */
export const restoreBackup = async (backupId: number): Promise<Restore> => {
  return api.post(`/backups/${backupId}/restore`)
}

/**
 * 获取恢复历史
 */
export const getRestores = async (params?: {
  skip?: number
  limit?: number
  status?: string
}): Promise<RestoreListResponse> => {
  return api.get('/backups/restores', { params })
}

/**
 * 获取恢复详情
 */
export const getRestore = async (restoreId: number): Promise<Restore> => {
  return api.get(`/backups/restores/${restoreId}`)
}
