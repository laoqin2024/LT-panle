import api from './api'

// 用户类型定义
export interface User {
  id: number
  username: string
  email: string
  full_name?: string
  role_id: number
  role_name?: string
  is_active: boolean
  is_superuser: boolean
  last_login?: string
  created_at: string
}

export interface UserListResponse {
  total: number
  items: User[]
}

export interface UserCreate {
  username: string
  email: string
  password: string
  full_name?: string
  role_id?: number
  is_active?: boolean
  is_superuser?: boolean
}

export interface UserUpdate {
  username?: string
  email?: string
  full_name?: string
  role_id?: number
  is_active?: boolean
  is_superuser?: boolean
  password?: string
}

// 角色类型定义
export interface Role {
  id: number
  name: string
  description?: string
  created_at: string
}

export interface RoleListResponse {
  total: number
  items: Role[]
}

export interface RoleCreate {
  name: string
  description?: string
}

export interface RoleUpdate {
  name?: string
  description?: string
}

// 权限类型定义
export interface Permission {
  id: number
  name: string
  resource: string
  action: string
  description?: string
  created_at: string
}

export interface PermissionListResponse {
  total: number
  items: Permission[]
}

// API方法

/**
 * 获取用户列表
 */
export const getUsers = async (params?: {
  skip?: number
  limit?: number
  search?: string
  role_id?: number
  is_active?: boolean
}): Promise<UserListResponse> => {
  return api.get('/users', { params })
}

/**
 * 获取用户详情
 */
export const getUser = async (userId: number): Promise<User> => {
  return api.get(`/users/${userId}`)
}

/**
 * 创建用户
 */
export const createUser = async (data: UserCreate): Promise<User> => {
  return api.post('/users', data)
}

/**
 * 更新用户
 */
export const updateUser = async (userId: number, data: UserUpdate): Promise<User> => {
  return api.put(`/users/${userId}`, data)
}

/**
 * 删除用户
 */
export const deleteUser = async (userId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/users/${userId}`)
}

/**
 * 获取角色列表
 */
export const getRoles = async (): Promise<RoleListResponse> => {
  return api.get('/users/roles')
}

/**
 * 创建角色
 */
export const createRole = async (data: RoleCreate): Promise<Role> => {
  return api.post('/users/roles', data)
}

/**
 * 更新角色
 */
export const updateRole = async (roleId: number, data: RoleUpdate): Promise<Role> => {
  return api.put(`/users/roles/${roleId}`, data)
}

/**
 * 删除角色
 */
export const deleteRole = async (roleId: number): Promise<{ message: string; success: boolean }> => {
  return api.delete(`/users/roles/${roleId}`)
}

/**
 * 获取权限列表
 */
export const getPermissions = async (params?: {
  resource?: string
}): Promise<PermissionListResponse> => {
  return api.get('/users/permissions', { params })
}
