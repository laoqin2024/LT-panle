import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Network, 
  ArrowLeft, 
  Terminal, 
  Settings, 
  Activity, 
  Wifi,
  Info,
  RefreshCw,
  Download,
  Key
} from 'lucide-react'
import CredentialSelector from '../components/CredentialSelector'

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // 模拟华为交换机数据
  const device = {
    id: id,
    name: '核心交换机-01',
    ip: '192.168.1.10',
    type: '华为 S5700',
    model: 'S5700-28C-EI',
    version: 'VRP (R) software, Version 5.170 (S5700 V200R010C00SPC600)',
    uptime: '120天 5小时 30分钟',
    status: 'online',
    protocol: 'SSH',
    cpu: 35,
    memory: 48,
    temperature: 42,
    interfaces: [
      { name: 'GigabitEthernet0/0/1', status: 'up', speed: '1G', in: 1024, out: 2048 },
      { name: 'GigabitEthernet0/0/2', status: 'up', speed: '1G', in: 512, out: 1024 },
      { name: 'GigabitEthernet0/0/3', status: 'down', speed: '1G', in: 0, out: 0 },
      { name: 'GigabitEthernet0/0/4', status: 'up', speed: '1G', in: 256, out: 512 },
    ],
    vlans: [
      { id: 1, name: 'VLAN1', members: 24 },
      { id: 10, name: 'VLAN10', members: 8 },
      { id: 20, name: 'VLAN20', members: 12 },
    ],
  }

  const tabs = [
    { id: 'overview', label: '概览', icon: Activity },
    { id: 'interfaces', label: '接口', icon: Wifi },
    { id: 'terminal', label: '命令终端', icon: Terminal },
    { id: 'config', label: '配置管理', icon: Settings },
    { id: 'credentials', label: '凭据管理', icon: Key },
    { id: 'info', label: '设备信息', icon: Info },
  ]

  // 模拟凭据数据
  const credentials = [
    { id: 1, username: 'admin', description: '管理密码', credentialType: 'password' as const },
    { id: 2, username: 'huawei', description: 'SSH密钥', credentialType: 'ssh_key' as const },
  ]
  const [selectedCredential, setSelectedCredential] = useState<number | undefined>(credentials[0]?.id)

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/devices')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{device.name}</h1>
            <p className="text-gray-600 mt-1">{device.ip} · {device.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <div className={`w-3 h-3 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{device.status === 'online' ? '在线' : '离线'}</span>
        </div>
      </div>

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

      {/* 标签页内容 */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 性能指标 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">CPU</h3>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{device.cpu}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${device.cpu}%` }}
                  ></div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-900">内存</h3>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{device.memory}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${device.memory}%` }}
                  ></div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-gray-900">温度</h3>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{device.temperature}°C</span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>正常范围: 0-70°C</p>
                </div>
              </div>
            </div>

            {/* 接口统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">接口状态</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">总接口数</span>
                    <span className="text-sm font-medium text-gray-900">{device.interfaces.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">在线接口</span>
                    <span className="text-sm font-medium text-green-600">
                      {device.interfaces.filter(i => i.status === 'up').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">离线接口</span>
                    <span className="text-sm font-medium text-red-600">
                      {device.interfaces.filter(i => i.status === 'down').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4">VLAN信息</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">VLAN数量</span>
                    <span className="text-sm font-medium text-gray-900">{device.vlans.length}</span>
                  </div>
                  <div className="space-y-1">
                    {device.vlans.map((vlan) => (
                      <div key={vlan.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{vlan.name}</span>
                        <span className="text-gray-900">{vlan.members} 个接口</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 监控图表 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">性能趋势</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">监控图表（待集成 ECharts）</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'interfaces' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">接口列表</h3>
              <button className="btn-secondary text-sm">刷新</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">接口名称</th>
                    <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">状态</th>
                    <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">速率</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">入流量</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">出流量</th>
                  </tr>
                </thead>
                <tbody>
                  {device.interfaces.map((iface, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-4 text-sm text-gray-900">{iface.name}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          iface.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {iface.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-600 text-center">{iface.speed}</td>
                      <td className="py-2 px-4 text-sm text-gray-600 text-right">
                        {(iface.in / 1024).toFixed(2)} MB/s
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-600 text-right">
                        {(iface.out / 1024).toFixed(2)} MB/s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">命令终端</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">协议: {device.protocol}</span>
                <div className="w-64">
                  <CredentialSelector
                    credentials={credentials}
                    selectedId={selectedCredential}
                    onSelect={setSelectedCredential}
                    onUse={(credId) => {
                      console.log('使用凭据连接:', credId)
                    }}
                  />
                </div>
                <button className="btn-primary text-sm">连接</button>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 h-96 font-mono text-sm">
              <div className="text-green-400 mb-2">$ 连接到 {device.ip}...</div>
              <div className="text-gray-300">
                <div className="mb-2">Welcome to Huawei VRP</div>
                <div className="mb-2">Last login: Mon Jan 15 10:30:25 2024</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">&lt;{device.name}&gt;</span>
                  <span className="text-gray-500">_</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-4">
                提示: 支持华为设备命令（display、config等）
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">配置备份</h3>
                <div className="flex items-center gap-2">
                  <button className="btn-primary text-sm">备份配置</button>
                  <button className="btn-secondary text-sm flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'config_2024-01-15_10-30-00.cfg', time: '2024-01-15 10:30:00', size: '45.2 KB' },
                  { name: 'config_2024-01-14_10-30-00.cfg', time: '2024-01-14 10:30:00', size: '45.1 KB' },
                ].map((backup, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{backup.name}</p>
                      <p className="text-xs text-gray-500">{backup.time} · {backup.size}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-sm text-primary-600 hover:text-primary-700">恢复</button>
                      <button className="text-sm text-gray-600 hover:text-gray-700">对比</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">当前配置</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-96 overflow-auto">
                <pre className="text-gray-300">
{`#
sysname {device.name}
#
vlan batch 1 10 20
#
interface GigabitEthernet0/0/1
 port link-type access
 port default vlan 10
#
interface GigabitEthernet0/0/2
 port link-type trunk
 port trunk allow-pass vlan 1 10 20
#`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">凭据管理</h3>
                <button className="btn-primary text-sm">添加凭据</button>
              </div>
              <div className="space-y-4">
                {credentials.map((cred) => (
                  <div key={cred.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{cred.username}</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {cred.credentialType === 'password' ? '密码' : 'SSH密钥'}
                          </span>
                        </div>
                        {cred.description && (
                          <p className="text-sm text-gray-600 mt-1">{cred.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-secondary text-sm">查看</button>
                        <button className="btn-secondary text-sm">编辑</button>
                        <button className="text-sm text-red-600 hover:text-red-700">删除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">设备信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">设备名称</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">IP地址</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.ip}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">设备型号</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.model}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">系统版本</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 text-xs">{device.version}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">运行时间</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.uptime}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">连接协议</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.protocol}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">设备类型</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{device.type}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      device.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {device.status === 'online' ? '在线' : '离线'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

