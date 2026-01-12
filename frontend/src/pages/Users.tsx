import { useState, useEffect } from 'react'
import { 
  Users as UsersIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Shield,
  UserCheck,
  UserX
} from 'lucide-react'
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  getRoles,
  type User,
  type UserCreate,
  type UserUpdate,
  type Role
} from '../services/users'
import Loading from '../components/Loading'
import { useAuthStore } from '../store/authStore'

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const currentUser = useAuthStore((state) => state.user)

  useEffect(() => {
    loadData()
  }, [searchTerm, selectedRole])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [usersData, rolesData] = await Promise.all([
        getUsers({
          search: searchTerm || undefined,
          role_id: selectedRole || undefined,
          limit: 100
        }),
        getRoles()
      ])

      setUsers(usersData.items)
      setRoles(rolesData.items)
    } catch (err: any) {
      let errorMessage = '加载数据失败'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
      console.error('加载用户数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId: number) => {
    if (!window.confirm('确定要删除这个用户吗？')) {
      return
    }

    try {
      await deleteUser(userId)
      await loadData()
    } catch (err: any) {
      let errorMessage = '删除失败'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      alert(errorMessage)
      console.error('删除用户失败:', err)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setShowAddModal(true)
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600 mt-1">管理系统用户、角色和权限</p>
        </div>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => {
              setEditingUser(null)
              setShowAddModal(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            添加用户
          </button>
        )}
      </div>

      {/* 搜索和筛选 */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索用户名、邮箱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={selectedRole || ''}
            onChange={(e) => setSelectedRole(e.target.value ? parseInt(e.target.value) : null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">所有角色</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 用户列表 */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">用户名</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">邮箱</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">角色</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">最后登录</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{user.username}</span>
                      {user.is_superuser && (
                        <Shield className="w-4 h-4 text-yellow-600" title="超级用户" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                      {user.role_name || '未知'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {user.is_active ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <UserCheck className="w-4 h-4" />
                        激活
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <UserX className="w-4 h-4" />
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm">
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleString('zh-CN')
                      : '从未登录'
                    }
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      {currentUser?.role === 'admin' && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>暂无用户</p>
            </div>
          )}
        </div>
      </div>

      {/* 添加/编辑用户表单 */}
      {showAddModal && (
        <UserForm
          user={editingUser}
          roles={roles}
          onClose={() => {
            setShowAddModal(false)
            setEditingUser(null)
          }}
          onSuccess={() => {
            setShowAddModal(false)
            setEditingUser(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// 用户表单组件
function UserForm({
  user,
  roles,
  onClose,
  onSuccess
}: {
  user: User | null
  roles: Role[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    full_name: user?.full_name || '',
    role_id: user?.role_id || 2,
    is_active: user?.is_active ?? true,
    is_superuser: user?.is_superuser ?? false,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      if (user) {
        // 更新用户
        const updateData: UserUpdate = {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          role_id: formData.role_id,
          is_active: formData.is_active,
          is_superuser: formData.is_superuser,
        }
        if (formData.password) {
          updateData.password = formData.password
        }
        await updateUser(user.id, updateData)
      } else {
        // 创建用户
        if (!formData.password) {
          alert('请设置密码')
          return
        }
        const createData: UserCreate = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role_id: formData.role_id,
          is_active: formData.is_active,
          is_superuser: formData.is_superuser,
        }
        await createUser(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = user ? '更新失败' : '创建失败'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join('; ')
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      alert(errorMessage)
      console.error('保存用户失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {user ? '编辑用户' : '添加用户'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  用户名 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱 *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {user ? '新密码（留空不修改）' : '密码 *'}
              </label>
              <input
                type="password"
                required={!user}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  角色 *
                </label>
                <select
                  required
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">激活</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_superuser}
                  onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">超级用户</span>
              </label>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? '保存中...' : '保存'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary">
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
