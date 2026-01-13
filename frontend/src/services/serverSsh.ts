import api from './api'

// 文件信息类型
export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: number
  permissions: string
}

export interface FileListResponse {
  path: string
  files: FileInfo[]
}

// API方法

/**
 * 获取文件列表
 */
export const listFiles = async (
  serverId: number,
  path: string = '/',
  credentialId: number
): Promise<FileListResponse> => {
  return api.get(`/servers/${serverId}/files`, {
    params: { path, credential_id: credentialId }
  })
}

/**
 * 上传文件
 */
export const uploadFile = async (
  serverId: number,
  file: File,
  path: string,
  credentialId: number
): Promise<{ message: string; path: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', path)
  formData.append('credential_id', credentialId.toString())
  
  return api.post(`/servers/${serverId}/files/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 下载文件
 */
export const downloadFile = async (
  serverId: number,
  path: string,
  credentialId: number
): Promise<Blob> => {
  const response = await api.get(`/servers/${serverId}/files/download`, {
    params: { path, credential_id: credentialId },
    responseType: 'blob'
  })
  return response.data
}

/**
 * 删除文件或目录
 */
export const deleteFileOrDir = async (
  serverId: number,
  path: string,
  credentialId: number
): Promise<{ message: string }> => {
  return api.delete(`/servers/${serverId}/files`, {
    params: { path, credential_id: credentialId }
  })
}

/**
 * 创建目录
 */
export const createDirectory = async (
  serverId: number,
  path: string,
  credentialId: number
): Promise<{ message: string; path: string }> => {
  return api.post(`/servers/${serverId}/files/mkdir`, null, {
    params: { path, credential_id: credentialId }
  })
}

/**
 * 断开SSH连接
 */
export const disconnectSsh = async (
  serverId: number,
  credentialId: number
): Promise<{ message: string }> => {
  return api.post(`/servers/${serverId}/ssh/disconnect`, null, {
    params: { credential_id: credentialId }
  })
}

// 命令执行类型定义
export interface CommandExecuteRequest {
  command: string
  credential_id: number
  timeout?: number
}

export interface CommandExecuteResponse {
  success: boolean
  exit_status: number
  output: string
  error: string
  command: string
}

// 进程信息类型定义
export interface ProcessInfo {
  user: string
  pid: number
  cpu_percent: number
  memory_percent: number
  vsz: number
  rss: number
  tty: string
  stat: string
  start: string
  time: string
  command: string
}

export interface ProcessListResponse {
  processes: ProcessInfo[]
  total: number
}

/**
 * 执行命令
 */
export const executeCommand = async (
  serverId: number,
  command: string,
  credentialId: number,
  timeout?: number
): Promise<CommandExecuteResponse> => {
  const formData = new FormData()
  formData.append('command', command)
  formData.append('credential_id', credentialId.toString())
  if (timeout) {
    formData.append('timeout', timeout.toString())
  }
  
  return api.post(`/servers/${serverId}/execute`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 获取进程列表
 */
export const getProcesses = async (
  serverId: number,
  credentialId: number,
  search?: string
): Promise<ProcessListResponse> => {
  return api.get(`/servers/${serverId}/processes`, {
    params: {
      credential_id: credentialId,
      search
    }
  })
}

/**
 * 终止进程
 */
export const killProcess = async (
  serverId: number,
  pid: number,
  credentialId: number,
  signal?: number
): Promise<{ message: string; success: boolean }> => {
  const formData = new FormData()
  formData.append('credential_id', credentialId.toString())
  if (signal) {
    formData.append('signal', signal.toString())
  }
  
  return api.post(`/servers/${serverId}/processes/${pid}/kill`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
