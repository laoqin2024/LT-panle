import { useState, useEffect } from 'react'
import { 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  HardDrive,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus
} from 'lucide-react'
import { getBackups, createBackup, deleteBackup, restoreBackup, getRestores, type Backup, type Restore } from '../services/backups'
import Loading from '../components/Loading'

export default function BackupRestore() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [restores, setRestores] = useState<Restore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('backups')
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)

  // 加载数据
  useEffect(() => {
    if (selectedTab === 'backups') {
      loadBackups()
    } else if (selectedTab === 'restore') {
      loadRestores()
    }
  }, [selectedTab])

  const loadBackups = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getBackups({ limit: 100 })
      setBackups(response.items)
    } catch (err: any) {
      let errorMessage = '加载备份列表失败'
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
      console.error('加载备份列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRestores = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getRestores({ limit: 100 })
      setRestores(response.items)
    } catch (err: any) {
      let errorMessage = '加载恢复历史失败'
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
      console.error('加载恢复历史失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setIsCreatingBackup(true)
      const backupName = `backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`
      await createBackup({
        backup_name: backupName,
        backup_type: 'manual',
      })
      // 重新加载列表
      await loadBackups()
      alert('备份创建成功')
    } catch (err: any) {
      let errorMessage = '创建备份失败'
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
      console.error('创建备份失败:', err)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleDelete = async (backupId: number) => {
    if (!window.confirm('确定要删除这个备份吗？')) {
      return
    }

    try {
      await deleteBackup(backupId)
      // 重新加载列表
      await loadBackups()
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
      console.error('删除备份失败:', err)
    }
  }

  const handleRestore = async (backupId: number) => {
    if (!window.confirm('确定要恢复此备份吗？当前数据将被覆盖！')) {
      return
    }

    try {
      await restoreBackup(backupId)
      alert('恢复操作已开始，请稍候...')
      // 切换到恢复历史标签页
      setSelectedTab('restore')
      await loadRestores()
    } catch (err: any) {
      let errorMessage = '恢复失败'
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
      console.error('恢复备份失败:', err)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--'
    const mb = bytes / (1024 * 1024)
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(2)} KB`
    }
    return `${mb.toFixed(2)} MB`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'in_progress':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'daily':
        return '每日备份'
      case 'weekly':
        return '每周备份'
      case 'monthly':
        return '每月备份'
      case 'manual':
        return '手动备份'
      default:
        return type
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error && selectedTab === 'backups') {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadBackups} className="btn-primary">
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">备份与恢复</h1>
          <p className="text-gray-600 mt-1">管理数据备份和恢复操作</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={isCreatingBackup}
          className="btn-primary flex items-center gap-2"
        >
          {isCreatingBackup ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              创建备份
            </>
          )}
        </button>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setSelectedTab('backups')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'backups'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            备份列表
          </button>
          <button
            onClick={() => setSelectedTab('restore')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'restore'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            恢复历史
          </button>
          <button
            onClick={() => setSelectedTab('migrate')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === 'migrate'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            数据迁移
          </button>
        </nav>
      </div>

      {/* 备份列表 */}
      {selectedTab === 'backups' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">备份名称</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">类型</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">大小</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">创建时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">创建者</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">{backup.backup_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {getTypeLabel(backup.backup_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatFileSize(backup.file_size)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(backup.status)}
                        <span className="text-sm text-gray-600">
                          {backup.status === 'completed' ? '已完成' : 
                           backup.status === 'failed' ? '失败' : '进行中'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(backup.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">--</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {backup.file_path && (
                          <button
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="下载"
                            onClick={() => {
                              // TODO: 实现下载功能
                              alert('下载功能待实现')
                            }}
                          >
                            <Download className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {backup.status === 'completed' && (
                          <button
                            onClick={() => handleRestore(backup.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="恢复"
                          >
                            <Upload className="w-4 h-4 text-primary-600" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(backup.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {backups.length === 0 && (
                <tbody>
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      暂无备份记录
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 恢复历史 */}
      {selectedTab === 'restore' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">恢复历史</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">备份文件</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">开始时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">完成时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作者</th>
                  </tr>
                </thead>
                <tbody>
                  {restores.map((restore) => (
                    <tr key={restore.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {restore.backup?.backup_name || `备份ID: ${restore.backup_id}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(restore.status)}
                          <span className="text-sm text-gray-600">
                            {restore.status === 'completed' ? '已完成' : 
                             restore.status === 'failed' ? '失败' : '进行中'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(restore.started_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {restore.completed_at ? new Date(restore.completed_at).toLocaleString('zh-CN') : '--'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">--</td>
                    </tr>
                  ))}
                </tbody>
                {restores.length === 0 && (
                  <tbody>
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        暂无恢复记录
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>
          </div>

          {/* 手动恢复 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">手动恢复</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择备份文件
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".tar.gz,.gz,.sql"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button className="btn-primary">上传并恢复</button>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">警告</p>
                    <p>恢复操作将覆盖当前所有数据，请确保已备份当前数据。恢复过程可能需要几分钟时间。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 数据迁移 */}
      {selectedTab === 'migrate' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 导出数据 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              导出数据
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                导出所有数据，包括数据库、配置文件和上传的文件，用于迁移到新服务器。
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-700">数据库数据</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-700">配置文件</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-700">上传的文件</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">备份文件（可选）</span>
                </label>
              </div>
              <button className="w-full btn-primary">导出数据</button>
              <div className="text-xs text-gray-500">
                导出文件将包含所有选中的数据，文件大小可能较大，请耐心等待。
              </div>
            </div>
          </div>

          {/* 导入数据 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              导入数据
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                从备份文件导入数据，快速迁移到新服务器。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择备份文件
                </label>
                <input
                  type="file"
                  accept=".tar.gz,.gz"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button className="w-full btn-primary">导入数据</button>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>提示：</strong>导入前系统会自动备份当前数据，确保数据安全。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

