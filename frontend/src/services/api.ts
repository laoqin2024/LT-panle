import axios, { AxiosInstance, AxiosError } from 'axios'

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 60000, // 增加到60秒，因为TimescaleDB查询可能需要更长时间
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error: AxiosError) => {
    // 处理错误
    if (error.response) {
      const responseData = error.response.data as any
      
      // 处理FastAPI的验证错误（422）
      if (error.response.status === 422 && Array.isArray(responseData?.detail)) {
        // 将验证错误数组转换为可读的字符串
        const errorMessages = responseData.detail.map((err: any) => {
          const field = err.loc?.slice(1).join('.') || '字段'
          return `${field}: ${err.msg}`
        }).join('; ')
        error.message = errorMessages
        error.response.data = { detail: errorMessages }
      }
      
      switch (error.response.status) {
        case 401:
          // 未授权，但需要区分是用户认证失败还是业务错误
          const errorMessage = responseData?.detail || error.message || ''
          // 如果是SSH相关错误，不应该退出登录
          if (errorMessage.includes('SSH') || errorMessage.includes('ssh')) {
            // SSH错误是业务错误，不触发登录退出
            console.error('SSH连接错误:', errorMessage)
            break
          }
          // 真正的用户认证失败，清除token并跳转到登录页
          localStorage.removeItem('token')
          window.location.href = '/login'
          break
        case 403:
          // 无权限
          console.error('无权限访问')
          break
        case 404:
          // 资源不存在
          console.error('资源不存在')
          break
        case 422:
          // 验证错误（已在上方处理）
          console.error('数据验证失败:', error.message)
          break
        case 500:
          // 服务器错误
          console.error('服务器错误')
          break
        default:
          console.error('请求失败:', error.message)
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('网络错误，请检查网络连接')
      error.message = '网络错误，请检查网络连接'
    } else {
      // 其他错误
      console.error('请求配置错误:', error.message)
    }
    return Promise.reject(error)
  }
)

export default api

