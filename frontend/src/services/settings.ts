import api from './api'

// 系统设置类型定义
export interface Settings {
  backup?: {
    autoBackup?: boolean
    backupFrequency?: string
    backupTime?: string
    retentionDays?: number
    remoteStorage?: string
    s3Bucket?: string
    s3Region?: string
  }
  system?: {
    siteName?: string
    timezone?: string
    language?: string
    sessionTimeout?: number
  }
  notification?: {
    emailEnabled?: boolean
    emailHost?: string
    emailPort?: number
    emailUser?: string
    emailPassword?: string
    webhookEnabled?: boolean
    webhookUrl?: string
  }
  security?: {
    passwordMinLength?: number
    requireSpecialChar?: boolean
    sessionTimeout?: number
    enable2FA?: boolean
  }
}

export interface SettingsUpdateRequest {
  backup?: Record<string, any>
  system?: Record<string, any>
  notification?: Record<string, any>
  security?: Record<string, any>
}

// API方法

/**
 * 获取系统设置
 */
export const getSettings = async (category?: string): Promise<Settings> => {
  return api.get('/settings', { params: { category } })
}

/**
 * 更新系统设置
 */
export const updateSettings = async (data: SettingsUpdateRequest): Promise<{ message: string; success: boolean }> => {
  return api.put('/settings', data)
}

/**
 * 获取单个设置
 */
export const getSetting = async (key: string): Promise<any> => {
  return api.get(`/settings/${key}`)
}

/**
 * 更新单个设置
 */
export const updateSetting = async (
  key: string,
  value: any,
  category?: string
): Promise<{ message: string; success: boolean }> => {
  return api.put(`/settings/${key}`, value, { params: { category } })
}
