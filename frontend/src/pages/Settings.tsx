import { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon, 
  Save,
  Database,
  HardDrive,
  Bell,
  Shield
} from 'lucide-react'
import { getSettings, updateSettings, type Settings } from '../services/settings'
import Loading from '../components/Loading'

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    backup: {
      autoBackup: true,
      backupFrequency: 'daily',
      backupTime: '02:00',
      retentionDays: 30,
      remoteStorage: 'local',
      s3Bucket: '',
      s3Region: '',
    },
    system: {
      siteName: 'Laoqin Panel',
      timezone: 'Asia/Shanghai',
      language: 'zh-CN',
      sessionTimeout: 30,
    },
    notification: {
      emailEnabled: false,
      emailHost: '',
      emailPort: 587,
      emailUser: '',
      emailPassword: '',
      webhookEnabled: false,
      webhookUrl: '',
    },
    security: {
      passwordMinLength: 12,
      requireSpecialChar: true,
      sessionTimeout: 30,
      enable2FA: false,
    },
  })

  const [activeTab, setActiveTab] = useState('backup')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载设置
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSettings()
      
      // 合并默认设置和服务器设置
      setSettings({
        backup: { ...settings.backup, ...data.backup },
        system: { ...settings.system, ...data.system },
        notification: { ...settings.notification, ...data.notification },
        security: { ...settings.security, ...data.security },
      })
    } catch (err: any) {
      let errorMessage = '加载设置失败'
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
      console.error('加载设置失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'backup', label: '备份设置', icon: Database },
    { id: 'system', label: '系统设置', icon: SettingsIcon },
    { id: 'notification', label: '通知设置', icon: Bell },
    { id: 'security', label: '安全设置', icon: Shield },
  ]

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      // 准备更新数据（只发送有值的字段）
      const updateData: any = {}
      
      if (settings.backup) {
        updateData.backup = {}
        Object.entries(settings.backup).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            updateData.backup[key] = value
          }
        })
      }
      
      if (settings.system) {
        updateData.system = {}
        Object.entries(settings.system).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            updateData.system[key] = value
          }
        })
      }
      
      if (settings.notification) {
        updateData.notification = {}
        Object.entries(settings.notification).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            updateData.notification[key] = value
          }
        })
      }
      
      if (settings.security) {
        updateData.security = {}
        Object.entries(settings.security).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            updateData.security[key] = value
          }
        })
      }
      
      await updateSettings(updateData)
      alert('设置已保存')
    } catch (err: any) {
      let errorMessage = '保存设置失败'
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
      alert(errorMessage)
      console.error('保存设置失败:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
          <p className="text-gray-600 mt-1">配置系统参数和功能选项</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="card bg-red-50 border border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 备份设置 */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              自动备份设置
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">启用自动备份</label>
                  <p className="text-xs text-gray-500 mt-1">系统将自动定期备份数据</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.backup.autoBackup}
                  onChange={(e) => setSettings({
                    ...settings,
                    backup: { ...settings.backup, autoBackup: e.target.checked }
                  })}
                  className="w-4 h-4 rounded"
                />
              </div>

              {settings.backup.autoBackup && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      备份频率
                    </label>
                    <select
                      value={settings.backup.backupFrequency}
                      onChange={(e) => setSettings({
                        ...settings,
                        backup: { ...settings.backup, backupFrequency: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="daily">每日备份</option>
                      <option value="weekly">每周备份</option>
                      <option value="monthly">每月备份</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      备份时间
                    </label>
                    <input
                      type="time"
                      value={settings.backup.backupTime}
                      onChange={(e) => setSettings({
                        ...settings,
                        backup: { ...settings.backup, backupTime: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      备份保留天数
                    </label>
                    <input
                      type="number"
                      value={settings.backup.retentionDays}
                      onChange={(e) => setSettings({
                        ...settings,
                        backup: { ...settings.backup, retentionDays: parseInt(e.target.value) }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">超过此天数的备份将被自动删除</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              远程存储设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  存储类型
                </label>
                <select
                  value={settings.backup.remoteStorage}
                  onChange={(e) => setSettings({
                    ...settings,
                    backup: { ...settings.backup, remoteStorage: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="local">本地存储</option>
                  <option value="s3">AWS S3</option>
                  <option value="oss">阿里云OSS</option>
                  <option value="ftp">FTP服务器</option>
                </select>
              </div>

              {settings.backup.remoteStorage === 's3' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      S3 Bucket
                    </label>
                    <input
                      type="text"
                      value={settings.backup.s3Bucket}
                      onChange={(e) => setSettings({
                        ...settings,
                        backup: { ...settings.backup, s3Bucket: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="my-backup-bucket"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      S3 Region
                    </label>
                    <input
                      type="text"
                      value={settings.backup.s3Region}
                      onChange={(e) => setSettings({
                        ...settings,
                        backup: { ...settings.backup, s3Region: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="us-east-1"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 系统设置 */}
      {activeTab === 'system' && (
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            系统参数
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                站点名称
              </label>
              <input
                type="text"
                value={settings.system.siteName}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, siteName: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                时区
              </label>
              <select
                value={settings.system.timezone}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, timezone: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                语言
              </label>
              <select
                value={settings.system.language}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, language: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                会话超时（分钟）
              </label>
              <input
                type="number"
                value={settings.system.sessionTimeout}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, sessionTimeout: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 通知设置 */}
      {activeTab === 'notification' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              邮件通知
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">启用邮件通知</label>
                  <p className="text-xs text-gray-500 mt-1">告警和重要事件将通过邮件通知</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notification.emailEnabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    notification: { ...settings.notification, emailEnabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded"
                />
              </div>

              {settings.notification.emailEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SMTP主机
                      </label>
                      <input
                        type="text"
                        value={settings.notification.emailHost}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification: { ...settings.notification, emailHost: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SMTP端口
                      </label>
                      <input
                        type="number"
                        value={settings.notification.emailPort}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification: { ...settings.notification, emailPort: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={settings.notification.emailUser}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification: { ...settings.notification, emailUser: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        密码
                      </label>
                      <input
                        type="password"
                        value={settings.notification.emailPassword}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification: { ...settings.notification, emailPassword: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Webhook通知
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">启用Webhook通知</label>
                  <p className="text-xs text-gray-500 mt-1">告警将通过Webhook发送</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notification.webhookEnabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    notification: { ...settings.notification, webhookEnabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded"
                />
              </div>

              {settings.notification.webhookEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={settings.notification.webhookUrl}
                    onChange={(e) => setSettings({
                      ...settings,
                      notification: { ...settings.notification, webhookUrl: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://example.com/webhook"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 安全设置 */}
      {activeTab === 'security' && (
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            安全策略
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码最小长度
              </label>
              <input
                type="number"
                value={settings.security.passwordMinLength}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, passwordMinLength: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">要求特殊字符</label>
                <p className="text-xs text-gray-500 mt-1">密码必须包含特殊字符</p>
              </div>
              <input
                type="checkbox"
                checked={settings.security.requireSpecialChar}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, requireSpecialChar: e.target.checked }
                })}
                className="w-4 h-4 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                会话超时（分钟）
              </label>
              <input
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, sessionTimeout: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">启用双因素认证</label>
                <p className="text-xs text-gray-500 mt-1">登录时需要二次验证</p>
              </div>
              <input
                type="checkbox"
                checked={settings.security.enable2FA}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, enable2FA: e.target.checked }
                })}
                className="w-4 h-4 rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

