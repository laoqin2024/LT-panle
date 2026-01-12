/**
 * 本地存储工具
 */

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export const storage = {
  // Token
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY)
  },
  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token)
  },
  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY)
  },

  // User
  getUser: (): any | null => {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  },
  setUser: (user: any): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  removeUser: (): void => {
    localStorage.removeItem(USER_KEY)
  },

  // 通用方法
  get: (key: string): any => {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  },
  set: (key: string, value: any): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  remove: (key: string): void => {
    localStorage.removeItem(key)
  },
  clear: (): void => {
    localStorage.clear()
  },
}

