import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Server, 
  ArrowLeft, 
  Terminal, 
  Folder, 
  Activity, 
  Cpu, 
  HardDrive, 
  Network,
  Info,
  RefreshCw,
  Key
} from 'lucide-react'
import CredentialSelector from '../components/CredentialSelector'

export default function ServerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('monitor')

  // 模拟服务器数据
  const server = {
    id: id,
    name: 'Web服务器-01',
    host: '192.168.1.100',
    status: 'online',
    os: 'Ubuntu 22.04',
    kernel: '5.15.0-91-generic',
    uptime: '15天 3小时 25分钟',
    cpu: { usage: 45, cores: 4, load: [0.8, 0.6, 0.5] },
    memory: { used: 6200, total: 16000, cached: 1200, swap: 0 },
    disk: [
      { mount: '/', used: 234, total: 500, percent: 47 },
      { mount: '/home', used: 120, total: 200, percent: 60 },
    ],
    network: [
      { interface: 'eth0', in: 1024, out: 2048, status: 'up' },
      { interface: 'eth1', in: 512, out: 1024, status: 'up' },
    ],
  }

  const tabs = [
    { id: 'monitor', label: '监控', icon: Activity },
    { id: 'terminal', label: 'SSH终端', icon: Terminal },
    { id: 'files', label: '文件管理', icon: Folder },
    { id: 'credentials', label: '凭据管理', icon: Key },
    { id: 'info', label: '系统信息', icon: Info },
  ]

  // 模拟凭据数据
  const credentials = [
    { id: 1, username: 'root', description: 'root用户密码', credentialType: 'password' as const },
    { id: 2, username: 'ubuntu', description: 'SSH密钥', credentialType: 'ssh_key' as const },
  ]
  const [selectedCredential, setSelectedCredential] = useState<number | undefined>(credentials[0]?.id)

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/servers')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{server.name}</h1>
            <p className="text-gray-600 mt-1">{server.host}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <div className={`w-3 h-3 rounded-full ${server.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{server.status === 'online' ? '在线' : '离线'}</span>
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
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* 实时资源监控 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CPU监控 */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">CPU</h3>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{server.cpu.usage}%</span>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${server.cpu.usage}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>核心数: {server.cpu.cores}</p>
                    <p>负载: {server.cpu.load.join(' / ')}</p>
                  </div>
                </div>
              </div>

              {/* 内存监控 */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-900">内存</h3>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {((server.memory.used / server.memory.total) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${(server.memory.used / server.memory.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>已用: {(server.memory.used / 1024).toFixed(1)} GB</p>
                    <p>总计: {(server.memory.total / 1024).toFixed(1)} GB</p>
                    <p>缓存: {(server.memory.cached / 1024).toFixed(1)} GB</p>
                  </div>
                </div>
              </div>

              {/* 磁盘监控 */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900">磁盘</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {server.disk.map((d, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{d.mount}</span>
                        <span className="text-sm font-medium text-gray-900">{d.percent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${d.percent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {d.used} GB / {d.total} GB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 网络监控 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Network className="w-5 h-5" />
                网络接口
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">接口</th>
                      <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">入流量</th>
                      <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">出流量</th>
                      <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {server.network.map((net, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 px-4 text-sm text-gray-900">{net.interface}</td>
                        <td className="py-2 px-4 text-sm text-gray-600 text-right">
                          {(net.in / 1024).toFixed(2)} MB/s
                        </td>
                        <td className="py-2 px-4 text-sm text-gray-600 text-right">
                          {(net.out / 1024).toFixed(2)} MB/s
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            net.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {net.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 监控图表占位 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">历史趋势</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">监控图表（待集成 ECharts）</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">SSH终端</h3>
              <div className="flex items-center gap-2">
                <div className="w-64">
                  <CredentialSelector
                    credentials={credentials}
                    selectedId={selectedCredential}
                    onSelect={setSelectedCredential}
                    onUse={(credId) => {
                      console.log('使用凭据连接:', credId)
                      // 这里调用SSH连接API
                    }}
                  />
                </div>
                <button className="btn-primary text-sm">连接</button>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 h-96 font-mono text-sm">
              <div className="text-green-400 mb-2">$ 连接到 {server.host}...</div>
              <div className="text-gray-300">
                <div className="mb-2">Welcome to Ubuntu 22.04 LTS</div>
                <div className="mb-2">Last login: Mon Jan 15 10:30:25 2024</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">user@{server.host}</span>
                  <span className="text-gray-500">:</span>
                  <span className="text-blue-400">~</span>
                  <span className="text-gray-500">$</span>
                  <span className="ml-2 text-gray-300">_</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-4">
                提示: 终端功能需要集成 xterm.js 和 WebSocket 连接
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">文件管理</h3>
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-sm">上传</button>
                <button className="btn-secondary text-sm">新建文件夹</button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Folder className="w-4 h-4" />
                  <span>/home/user</span>
                </div>
              </div>
              <div className="p-4">
                <div className="text-sm text-gray-500 text-center py-8">
                  文件浏览器（待实现）
                  <br />
                  <span className="text-xs">需要集成文件浏览、上传、下载功能</span>
                </div>
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
            <h3 className="font-bold text-gray-900 mb-4">系统信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">服务器名称</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">主机地址</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.host}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">操作系统</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.os}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">内核版本</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.kernel}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">运行时间</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.uptime}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">CPU核心数</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.cpu.cores} 核</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">总内存</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {(server.memory.total / 1024).toFixed(1)} GB
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      server.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {server.status === 'online' ? '在线' : '离线'}
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

