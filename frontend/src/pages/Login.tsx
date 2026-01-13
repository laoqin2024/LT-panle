import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Lock, User, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 调用登录API（使用JSON格式）
      const response = await api.post('/auth/login', {
        username: formData.username,
        password: formData.password,
      })

      // 后端返回的数据中同时包含 token 和 access_token，这里兼容两种字段
      const token = response.access_token || response.token

      if (!token) {
        throw new Error('登录响应中缺少token')
      }

      // 保存token和用户信息
      login(token, response.user)
      
      // 跳转到仪表盘
      navigate('/dashboard')
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        '登录失败，请检查用户名和密码'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Laoqin Panel</h1>
          <p className="text-purple-200">业务系统集中管理面板</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名 */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>

            {/* 记住我 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/30 bg-white/20 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-white/80 text-sm">记住我</span>
              </label>
              <a href="#" className="text-white/80 text-sm hover:text-white">
                忘记密码？
              </a>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-purple-900 py-3 rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-purple-900 border-t-transparent rounded-full animate-spin"></div>
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  登录
                </>
              )}
            </button>
          </form>
        </div>

        {/* 底部信息 */}
        <p className="text-center text-white/60 text-sm mt-6">
          © 2024 Laoqin Panel. All rights reserved.
        </p>
      </div>
    </div>
  )
}

