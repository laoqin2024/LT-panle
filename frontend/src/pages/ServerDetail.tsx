import { useState, useEffect, useRef } from 'react'
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
  Key,
  Upload,
  Download,
  Trash2,
  Plus,
  File as FileIcon,
  FolderOpen,
  ChevronRight,
  Home,
  Play,
  X,
  Search,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react'
import CredentialSelector from '../components/CredentialSelector'
import { getServer, getServerMetrics, collectServerInfo, getServerInfo, testServerConnection, updateServer } from '../services/servers'
import { getCredentials, getCredential, createCredential, updateCredential, deleteCredential, decryptCredential, testCredentialConnection, type Credential, type CredentialCreate, type CredentialUpdate } from '../services/credentials'
import { listFiles, uploadFile, downloadFile, deleteFileOrDir, createDirectory, type FileInfo, executeCommand, getProcesses, killProcess, type ProcessInfo } from '../services/serverSsh'
import { getMetrics, type MetricResponse } from '../services/monitoring'
import { useAuthStore } from '../store/authStore'
import Loading from '../components/Loading'
import MetricChart from '../components/MetricChart'
import SshTerminal from '../components/SshTerminal'
import { useMonitoringWebSocket } from '../hooks/useMonitoringWebSocket'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function ServerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [activeTab, setActiveTab] = useState('monitor')
  const [server, setServer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [credentials, setCredentials] = useState<any[]>([])
  const [selectedCredential, setSelectedCredential] = useState<number | undefined>()
  
  // 监控数据状态
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [monitoringMode, setMonitoringMode] = useState<'websocket' | 'polling' | 'manual'>('websocket') // 监控模式：websocket/polling/manual
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true) // 是否启用自动刷新
  
  // 文件管理状态
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showMkdirDialog, setShowMkdirDialog] = useState(false)
  const [newDirName, setNewDirName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // SSH终端状态
  const [sshConnected, setSshConnected] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  
  // 进程管理状态
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loadingProcesses, setLoadingProcesses] = useState(false)
  const [processSearch, setProcessSearch] = useState('')
  
  // 命令执行状态
  const [commandInput, setCommandInput] = useState('')
  const [commandOutput, setCommandOutput] = useState<{ command: string; output: string; error: string; success: boolean } | null>(null)
  const [executingCommand, setExecutingCommand] = useState(false)
  
  // 连接测试状态
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; output?: string; error?: string } | null>(null)
  
  // 凭据管理状态
  const [showCredentialForm, setShowCredentialForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [testingCredential, setTestingCredential] = useState<number | null>(null)

  const tabs = [
    { id: 'monitor', label: '监控', icon: Activity },
    { id: 'terminal', label: 'SSH终端', icon: Terminal },
    { id: 'files', label: '文件管理', icon: Folder },
    { id: 'processes', label: '进程管理', icon: Cpu },
    { id: 'commands', label: '命令执行', icon: Terminal },
    { id: 'credentials', label: '凭据管理', icon: Key },
    { id: 'info', label: '系统信息', icon: Info },
  ]

  useEffect(() => {
    if (id) {
      loadServer()
    }
  }, [id])

  // 服务器加载完成后，加载凭据并设置默认凭据
  useEffect(() => {
    if (server && id) {
      loadCredentials()
      // 如果有默认凭据且当前未选择，自动选择默认凭据
      if (server.default_credential_id && !selectedCredential) {
        setSelectedCredential(server.default_credential_id)
      }
    }
  }, [server, id])

  // 当切换到需要凭据的标签页时，如果没有选择凭据，自动使用默认凭据
  useEffect(() => {
    const tabsNeedCredential = ['monitor', 'terminal', 'files', 'processes', 'commands']
    if (tabsNeedCredential.includes(activeTab) && server?.default_credential_id && !selectedCredential) {
      const defaultCred = credentials.find(c => c.id === server.default_credential_id)
      if (defaultCred) {
        setSelectedCredential(defaultCred.id)
      }
    }
  }, [activeTab, server, credentials, selectedCredential])

  // 定义 loadMetrics 函数（需要在 hooks 之前定义，因为会被 useAutoRefresh 使用）
  const loadMetrics = async () => {
    if (!id) return
    try {
      setLoadingMetrics(true)
      // 从监控API获取数据
      // 注意：如果TimescaleDB没有数据，API会返回空数组，这是正常的
      const data = await getMetrics('server', parseInt(id), {
        interval: '1h'
      }).catch((err) => {
        // 如果API调用失败（可能是TimescaleDB未配置或表不存在），返回null
        console.warn('监控API调用失败，将使用服务器信息作为后备:', err)
        return null
      })
      
      // 如果API返回null（调用失败），直接使用server.os_info
      if (!data) {
        if (server && server.os_info) {
          // 使用server.os_info作为后备数据源
          const osInfo = server.os_info
          const collectedMetrics: any = {
            cpu: osInfo.cpu ? {
              usage: osInfo.cpu.usage || 0,
              cores: osInfo.cpu.cores || 0,
              load: osInfo.load_average ? [
                osInfo.load_average['1min'] || 0,
                osInfo.load_average['5min'] || 0,
                osInfo.load_average['15min'] || 0
              ] : [0, 0, 0]
            } : null,
            memory: osInfo.memory ? {
              used: osInfo.memory.used || 0,
              total: osInfo.memory.total || 0,
              cached: osInfo.memory.cached || 0,
              swap: osInfo.memory.swap || 0
            } : null,
            disk: [],
            network: [],
            os: osInfo.os || null,
            uptime: osInfo.uptime || null,
            load_average: osInfo.load_average || null
          }
          
          // 转换磁盘数据格式
          if (osInfo.disk && osInfo.disk.disks && Array.isArray(osInfo.disk.disks)) {
            collectedMetrics.disk = osInfo.disk.disks.map((d: any) => ({
              mount: d.mount_point || d.filesystem || '/',
              used: (d.used || 0) / (1024 * 1024 * 1024),
              total: (d.size || 0) / (1024 * 1024 * 1024),
              percent: d.usage_percent || 0
            }))
          }
          
          // 转换网络数据格式
          if (osInfo.network && osInfo.network.interfaces && Array.isArray(osInfo.network.interfaces)) {
            collectedMetrics.network = osInfo.network.interfaces.map((iface: any) => ({
              interface: iface.name || '',
              in: iface.rx_bytes || 0,
              out: iface.tx_bytes || 0,
              status: iface.status || 'unknown'
            }))
          }
          
          if (collectedMetrics.cpu || collectedMetrics.memory || collectedMetrics.disk.length > 0) {
            setMetrics(collectedMetrics)
          } else {
            setMetrics(null)
          }
        } else {
          setMetrics(null)
        }
        setLoadingMetrics(false)
        return
      }
      
      // 处理监控数据，转换为前端需要的格式
      if (data.metrics && data.metrics.length > 0) {
        // 获取最新的监控数据作为实时数据
        const latest = data.metrics[data.metrics.length - 1]
        const cpuUsage = latest.cpu_percent || 0
        const memoryUsed = latest.memory_used || 0
        const memoryTotal = latest.memory_total || 0
        const diskUsed = latest.disk_used || 0
        const diskTotal = latest.disk_total || 0
        
        // 构造实时监控数据结构
        setMetrics({
          cpu: {
            usage: cpuUsage,
            cores: 4, // 这个需要从其他地方获取
            load: [latest.load_avg_1m || 0, latest.load_avg_5m || 0, latest.load_avg_15m || 0]
          },
          memory: {
            used: memoryUsed,
            total: memoryTotal,
            cached: 0, // 这个需要从其他地方获取
            swap: 0
          },
          disk: [{
            mount: '/',
            used: diskUsed / (1024 * 1024 * 1024), // 转换为GB
            total: diskTotal / (1024 * 1024 * 1024),
            percent: diskTotal > 0 ? (diskUsed / diskTotal * 100) : 0
          }],
          network: [], // 网络数据需要单独处理
          history: data.metrics // 历史数据用于图表
        })
      } else {
        // 如果监控数据库没有数据，尝试从 server.os_info 中读取采集的信息
        if (server && server.os_info) {
          const osInfo = server.os_info
          const collectedMetrics: any = {
            cpu: osInfo.cpu ? {
              usage: osInfo.cpu.usage || 0,
              cores: osInfo.cpu.cores || 0,
              load: osInfo.load_average ? [
                osInfo.load_average['1min'] || 0,
                osInfo.load_average['5min'] || 0,
                osInfo.load_average['15min'] || 0
              ] : [0, 0, 0]
            } : null,
            memory: osInfo.memory ? {
              used: osInfo.memory.used || 0,
              total: osInfo.memory.total || 0,
              cached: osInfo.memory.cached || 0,
              swap: osInfo.memory.swap || 0
            } : null,
            disk: [],
            network: [],
            os: osInfo.os || null,
            uptime: osInfo.uptime || null,
            load_average: osInfo.load_average || null
          }
          
          // 转换磁盘数据格式
          if (osInfo.disk && osInfo.disk.disks && Array.isArray(osInfo.disk.disks)) {
            collectedMetrics.disk = osInfo.disk.disks.map((d: any) => ({
              mount: d.mount_point || d.filesystem || '/',
              used: (d.used || 0) / (1024 * 1024 * 1024), // 转换为GB
              total: (d.size || 0) / (1024 * 1024 * 1024), // 转换为GB
              percent: d.usage_percent || 0
            }))
          }
          
          // 转换网络数据格式
          if (osInfo.network && osInfo.network.interfaces && Array.isArray(osInfo.network.interfaces)) {
            collectedMetrics.network = osInfo.network.interfaces.map((iface: any) => ({
              interface: iface.name || '',
              in: iface.rx_bytes || 0,
              out: iface.tx_bytes || 0,
              status: iface.status || 'unknown'
            }))
          }
          
          // 只有当有实际数据时才设置
          if (collectedMetrics.cpu || collectedMetrics.memory || collectedMetrics.disk.length > 0) {
            setMetrics(collectedMetrics)
          } else {
            setMetrics(null)
          }
        } else {
          setMetrics(null)
        }
      }
    } catch (err) {
      console.error('加载监控数据失败:', err)
      // 如果监控API失败，也尝试从 server.os_info 中读取
      if (server && server.os_info) {
        const osInfo = server.os_info
        const collectedMetrics: any = {
          cpu: osInfo.cpu ? {
            usage: osInfo.cpu.usage || 0,
            cores: osInfo.cpu.cores || 0,
            load: osInfo.load_average ? [
              osInfo.load_average['1min'] || 0,
              osInfo.load_average['5min'] || 0,
              osInfo.load_average['15min'] || 0
            ] : [0, 0, 0]
          } : null,
          memory: osInfo.memory ? {
            used: osInfo.memory.used || 0,
            total: osInfo.memory.total || 0,
            cached: osInfo.memory.cached || 0,
            swap: osInfo.memory.swap || 0
          } : null,
          disk: [],
          network: [],
          os: osInfo.os || null,
          uptime: osInfo.uptime || null,
          load_average: osInfo.load_average || null
        }
        
        // 转换磁盘数据格式
        if (osInfo.disk && osInfo.disk.disks && Array.isArray(osInfo.disk.disks)) {
          collectedMetrics.disk = osInfo.disk.disks.map((d: any) => ({
            mount: d.mount_point || d.filesystem || '/',
            used: (d.used || 0) / (1024 * 1024 * 1024),
            total: (d.size || 0) / (1024 * 1024 * 1024),
            percent: d.usage_percent || 0
          }))
        }
        
        // 转换网络数据格式
        if (osInfo.network && osInfo.network.interfaces && Array.isArray(osInfo.network.interfaces)) {
          collectedMetrics.network = osInfo.network.interfaces.map((iface: any) => ({
            interface: iface.name || '',
            in: iface.rx_bytes || 0,
            out: iface.tx_bytes || 0,
            status: iface.status || 'unknown'
          }))
        }
        
        if (collectedMetrics.cpu || collectedMetrics.memory || collectedMetrics.disk.length > 0) {
          setMetrics(collectedMetrics)
        } else {
          setMetrics(null)
        }
      } else {
        setMetrics(null)
      }
    } finally {
      setLoadingMetrics(false)
    }
  }

  // WebSocket监控（推荐方案）
  const { connected: wsConnected } = useMonitoringWebSocket({
    resourceType: 'server',
    resourceId: parseInt(id || '0'),
    enabled: autoRefreshEnabled && monitoringMode === 'websocket' && activeTab === 'monitor' && !!id,
    onMetricUpdate: (data) => {
      console.log('[监控] 收到WebSocket监控数据:', data)
      // 将WebSocket推送的数据转换为前端需要的格式
      // 注意：后端推送的数据格式可能与前端期望的不同，需要适配
      const updatedMetrics: any = {
        cpu: data.cpu ? {
          usage: data.cpu.usage || data.cpu_percent || 0,
          cores: data.cpu.cores || 0,
          load: data.cpu.load || [data.load_avg_1m || 0, data.load_avg_5m || 0, data.load_avg_15m || 0]
        } : metrics?.cpu,
        memory: data.memory ? {
          used: data.memory.used || data.memory_used || 0,
          total: data.memory.total || data.memory_total || 0,
          cached: data.memory.cached || 0,
          swap: data.memory.swap || 0
        } : metrics?.memory,
        disk: data.disk || metrics?.disk || [],
        network: data.network || metrics?.network || [],
        history: metrics?.history || [] // 保留历史数据
      }
      setMetrics(updatedMetrics)
    },
    onError: (error) => {
      console.error('[监控] WebSocket错误，降级到轮询模式:', error)
      // WebSocket失败时自动降级到轮询（立即切换，避免继续尝试连接）
      if (monitoringMode === 'websocket') {
        console.log('[监控] 自动切换到轮询模式')
        setMonitoringMode('polling')
      }
    }
  })

  // 当WebSocket连接成功时，如果当前是轮询模式，自动切换回WebSocket模式
  useEffect(() => {
    if (wsConnected && monitoringMode === 'polling' && autoRefreshEnabled) {
      console.log('[监控] WebSocket连接成功，自动切换回WebSocket模式')
      setMonitoringMode('websocket')
    }
  }, [wsConnected, monitoringMode, autoRefreshEnabled])

  // 智能轮询（降级方案）
  // 注意：当WebSocket模式启用时，轮询应该禁用，避免同时运行
  useAutoRefresh({
    enabled: autoRefreshEnabled && monitoringMode === 'polling' && activeTab === 'monitor' && !!id && monitoringMode !== 'websocket',
    interval: 10000, // 10秒轮询一次（比WebSocket频率低）
    onRefresh: loadMetrics,
    immediate: true // 立即执行一次，确保数据及时更新
  })

  useEffect(() => {
    if (activeTab === 'files' && selectedCredential) {
      loadFiles()
    }
    if (activeTab === 'monitor' && id) {
      loadMetrics()
    }
    if (activeTab === 'processes' && selectedCredential) {
      loadProcesses()
    }
  }, [activeTab, currentPath, selectedCredential, id, processSearch, server])

  const loadServer = async () => {
    try {
      setLoading(true)
      const data = await getServer(parseInt(id || '0'))
      setServer(data)
      
      // 默认凭据的选择逻辑移到 useEffect 中处理
    } catch (err) {
      console.error('加载服务器信息失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!id || !selectedCredential) {
      alert('请先选择凭据')
      return
    }
    
    setTestingConnection(true)
    setTestResult(null)
    
    try {
      const result = await testServerConnection(parseInt(id), selectedCredential)
      setTestResult({
        success: result.success,
        message: result.message,
        output: result.output,
        error: result.error
      })
      
      // 如果测试成功，刷新服务器信息
      if (result.success) {
        loadServer()
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || '连接测试失败'
      setTestResult({
        success: false,
        message: '连接测试失败',
        error: errorMsg
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleCollectInfo = async () => {
    if (!id || !selectedCredential) {
      alert('请先选择凭据')
      return
    }
    
    try {
      setLoading(true)
      const result = await collectServerInfo(parseInt(id), selectedCredential)
      
      // 如果采集成功，直接使用采集到的数据更新监控显示
      if (result.info && activeTab === 'monitor') {
        const info = result.info
        // 构造监控数据结构
        const collectedMetrics: any = {
          cpu: info.cpu ? {
            usage: info.cpu.usage || 0,
            cores: info.cpu.cores || 0,
            load: info.load_average ? [
              info.load_average['1min'] || 0,
              info.load_average['5min'] || 0,
              info.load_average['15min'] || 0
            ] : [0, 0, 0]
          } : null,
          memory: info.memory ? {
            used: info.memory.used || 0,
            total: info.memory.total || 0,
            cached: info.memory.cached || 0,
            swap: info.memory.swap || 0
          } : null,
          disk: [],
          network: [],
          os: info.os || null,
          uptime: info.uptime || null,
          load_average: info.load_average || null
        }
        
        // 转换磁盘数据格式：后端返回 {disks: [...]}，需要转换为前端格式
        if (info.disk && info.disk.disks && Array.isArray(info.disk.disks)) {
          collectedMetrics.disk = info.disk.disks.map((d: any) => ({
            mount: d.mount_point || d.filesystem || '/',
            used: (d.used || 0) / (1024 * 1024 * 1024), // 转换为GB
            total: (d.size || 0) / (1024 * 1024 * 1024), // 转换为GB
            percent: d.usage_percent || 0
          }))
        }
        
        // 转换网络数据格式：后端返回 {interfaces: [...]}，需要转换为前端格式
        if (info.network && info.network.interfaces && Array.isArray(info.network.interfaces)) {
          collectedMetrics.network = info.network.interfaces.map((iface: any) => ({
            interface: iface.name || '',
            in: iface.rx_bytes || 0,
            out: iface.tx_bytes || 0,
            status: iface.status || 'unknown'
          }))
        }
        
        setMetrics(collectedMetrics)
      }
      
      alert('服务器信息采集成功！')
      // 重新加载服务器信息以显示最新数据
      await loadServer()
    } catch (err: any) {
      console.error('采集服务器信息失败:', err)
      alert(err.response?.data?.detail || '采集服务器信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadCredentials = async () => {
    if (!id) return
    try {
      // 只加载当前服务器相关的凭据
      const response = await getCredentials({
        resource_type: 'server',
        resource_id: parseInt(id),
      })
      setCredentials(response.items || [])
      
      // 如果有默认凭据，优先选择默认凭据
      if (server?.default_credential_id) {
        const defaultCred = response.items?.find(c => c.id === server.default_credential_id)
        if (defaultCred) {
          setSelectedCredential(defaultCred.id)
          return
        }
      }
      
      // 否则选择第一个凭据
      if (response.items && response.items.length > 0) {
        setSelectedCredential(response.items[0].id)
      }
    } catch (err) {
      console.error('加载凭据失败:', err)
    }
  }

  const loadFiles = async () => {
    if (!id || !selectedCredential) {
      alert('请先选择SSH凭据')
      return
    }
    try {
      setLoadingFiles(true)
      const response = await listFiles(parseInt(id), currentPath, selectedCredential)
      setFiles(response.files)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || '加载文件列表失败'
      console.error('加载文件列表失败:', err)
      alert(errorMsg)
      // SSH错误不应该清空文件列表，保持当前状态
      if (!errorMsg.includes('SSH') && !errorMsg.includes('ssh')) {
        setFiles([])
      }
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleFileClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id || !selectedCredential) return
    
    try {
      await uploadFile(parseInt(id), file, currentPath, selectedCredential)
      alert('文件上传成功')
      loadFiles()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setShowUploadDialog(false)
    } catch (err: any) {
      alert(err.response?.data?.detail || '文件上传失败')
    }
  }

  const handleDownload = async (file: FileInfo) => {
    if (!id || !selectedCredential) return
    
    try {
      const blob = await downloadFile(parseInt(id), file.path, selectedCredential)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert(err.response?.data?.detail || '文件下载失败')
    }
  }

  const handleDelete = async (file: FileInfo) => {
    if (!window.confirm(`确定要删除 ${file.name} 吗？`)) return
    if (!id || !selectedCredential) return
    
    try {
      await deleteFileOrDir(parseInt(id), file.path, selectedCredential)
      alert('删除成功')
      loadFiles()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleCreateDir = async () => {
    if (!newDirName.trim() || !id || !selectedCredential) return
    
    try {
      const basePath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath
      const newPath = basePath === '' ? `/${newDirName}` : `${basePath}/${newDirName}`
      await createDirectory(parseInt(id), newPath, selectedCredential)
      alert('目录创建成功')
      setNewDirName('')
      setShowMkdirDialog(false)
      loadFiles()
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建目录失败')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }

  const handleConnectSSH = () => {
    if (!id || !selectedCredential || !token) {
      alert('请先选择凭据')
      return
    }
    setSshConnected(true)
  }

  const handleDisconnectSSH = () => {
    setSshConnected(false)
  }

  // 取消自动连接，改为手动连接
  // 用户需要点击"连接SSH终端"按钮才会建立连接

  const loadProcesses = async () => {
    if (!id || !selectedCredential) {
      alert('请先选择SSH凭据')
      return
    }
    try {
      setLoadingProcesses(true)
      const response = await getProcesses(parseInt(id), selectedCredential, processSearch || undefined)
      setProcesses(response.processes)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || '加载进程列表失败'
      console.error('加载进程列表失败:', err)
      alert(errorMsg)
      // SSH错误不应该清空进程列表，保持当前状态
      if (!errorMsg.includes('SSH') && !errorMsg.includes('ssh')) {
        setProcesses([])
      }
    } finally {
      setLoadingProcesses(false)
    }
  }

  const handleKillProcess = async (pid: number) => {
    if (!window.confirm(`确定要终止进程 ${pid} 吗？`)) return
    if (!id || !selectedCredential) return
    
    try {
      await killProcess(parseInt(id), pid, selectedCredential)
      alert('进程已终止')
      loadProcesses()
    } catch (err: any) {
      alert(err.response?.data?.detail || '终止进程失败')
    }
  }

  const handleExecuteCommand = async () => {
    if (!commandInput.trim() || !id || !selectedCredential) return
    
    try {
      setExecutingCommand(true)
      const response = await executeCommand(parseInt(id), commandInput, selectedCredential)
      setCommandOutput({
        command: response.command,
        output: response.output,
        error: response.error,
        success: response.success
      })
      setCommandInput('')
    } catch (err: any) {
      alert(err.response?.data?.detail || '命令执行失败')
    } finally {
      setExecutingCommand(false)
    }
  }

  // 凭据管理相关函数
  const handleSetDefaultCredential = async (credentialId: number) => {
    if (!id) return
    try {
      const updatedServer = await updateServer(parseInt(id), { default_credential_id: credentialId })
      // 更新本地服务器状态
      if (updatedServer) {
        setServer(updatedServer)
      }
      // 重新加载服务器信息和凭据列表
      await loadServer()
      await loadCredentials()
      alert('已设置为默认凭据')
    } catch (err: any) {
      console.error('设置默认凭据失败:', err)
      // 即使出错也尝试重新加载，因为后端可能已经更新成功
      try {
        await loadServer()
        await loadCredentials()
        // 检查是否真的更新成功了
        const refreshedServer = await getServer(parseInt(id))
        if (refreshedServer?.default_credential_id === credentialId) {
          alert('已设置为默认凭据')
          return
        }
      } catch (reloadErr) {
        console.error('重新加载失败:', reloadErr)
      }
      alert(err.response?.data?.detail || err.message || '设置默认凭据失败')
    }
  }

  const handleDeleteCredential = async (credentialId: number) => {
    if (!window.confirm('确定要删除这个凭据吗？')) return
    try {
      await deleteCredential(credentialId)
      await loadCredentials()
      // 如果删除的是当前选中的凭据，清空选择
      if (selectedCredential === credentialId) {
        setSelectedCredential(undefined)
      }
      // 如果删除的是默认凭据，重新加载服务器信息
      if (server?.default_credential_id === credentialId) {
        await loadServer()
      }
      alert('删除成功')
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleViewCredential = async (credential: Credential) => {
    setViewingCredential(credential)
    setRevealedPassword(null)
  }

  const handleTestCredentialConnection = async (credentialId: number) => {
    try {
      setTestingCredential(credentialId)
      const result = await testCredentialConnection(credentialId)
      if (result.success) {
        alert(`连接测试成功！\n服务器: ${result.server_host}:${result.server_port}\n用户名: ${result.username}\n输出: ${result.output || '无'}`)
      } else {
        alert(`连接测试失败: ${result.message}`)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || '连接测试失败')
    } finally {
      setTestingCredential(null)
    }
  }

  const togglePasswordVisibility = async (credential: Credential) => {
    if (revealedPassword) {
      setRevealedPassword(null)
    } else {
      try {
        const response = await decryptCredential(credential.id)
        setRevealedPassword(response.password)
      } catch (err: any) {
        alert(err.response?.data?.detail || '解密失败')
      }
    }
  }

  if (loading) {
    return <Loading />
  }

  if (!server) {
    return <div className="text-center py-8">服务器不存在</div>
  }

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
            {/* 采集信息按钮 */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">服务器信息采集</h3>
                  <p className="text-sm text-gray-600">
                    通过SSH连接采集服务器的CPU、内存、磁盘、网络等实时信息
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CredentialSelector
                    credentials={credentials}
                    selectedId={selectedCredential}
                    onSelect={setSelectedCredential}
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={!selectedCredential || testingConnection}
                    className="btn-secondary flex items-center gap-2"
                    title="测试SSH连接"
                  >
                    <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
                    {testingConnection ? '测试中...' : '测试连接'}
                  </button>
                  <button
                    onClick={handleCollectInfo}
                    disabled={!selectedCredential || loading}
                    className="btn-primary flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    采集信息
                  </button>
                </div>
              </div>
            </div>

            {/* 连接测试结果 */}
            {testResult && (
              <div className={`card border-2 ${
                testResult.success 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-red-500 bg-red-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className={`font-bold ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '✓ 连接测试成功' : '✗ 连接测试失败'}
                  </h4>
                  <button
                    onClick={() => setTestResult(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-sm mb-2 ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </p>
                {testResult.output && (
                  <div className="mt-2 p-2 bg-gray-900 text-green-400 font-mono text-xs rounded overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{testResult.output}</pre>
                  </div>
                )}
                {testResult.error && (
                  <div className="mt-2 p-2 bg-gray-900 text-red-400 font-mono text-xs rounded overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{testResult.error}</pre>
                  </div>
                )}
              </div>
            )}

            {/* 监控模式控制栏 */}
            {metrics && (
              <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefreshEnabled}
                      onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-sm text-gray-700">自动刷新</span>
                  {autoRefreshEnabled && (
                    <>
                      <select
                        value={monitoringMode}
                        onChange={(e) => setMonitoringMode(e.target.value as 'websocket' | 'polling' | 'manual')}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="websocket">WebSocket实时推送</option>
                        <option value="polling">智能轮询（10秒）</option>
                        <option value="manual">手动刷新</option>
                      </select>
                      {monitoringMode === 'websocket' && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          wsConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {wsConnected ? '✓ 已连接' : '⏳ 连接中...'}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={loadMetrics}
                  className="btn-secondary text-sm flex items-center gap-2"
                  disabled={loadingMetrics}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingMetrics ? 'animate-spin' : ''}`} />
                  手动刷新
                </button>
              </div>
            )}

            {loadingMetrics ? (
              <div className="text-center py-8">
                <Loading />
              </div>
            ) : metrics ? (
              <>
                {/* CPU、内存、网络监控 - 同一行 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* CPU监控 */}
                  {metrics.cpu && (
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-5 h-5 text-blue-600" />
                          <h3 className="font-bold text-gray-900">CPU</h3>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{metrics.cpu.usage || 0}%</span>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${metrics.cpu.usage || 0}%` }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {metrics.cpu.cores && <p>核心数: {metrics.cpu.cores}</p>}
                          {metrics.cpu.load && <p>负载: {metrics.cpu.load.join(' / ')}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 内存监控 */}
                  {metrics.memory && (
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-green-600" />
                          <h3 className="font-bold text-gray-900">内存</h3>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          {metrics.memory.total > 0 
                            ? ((metrics.memory.used / metrics.memory.total) * 100).toFixed(0) 
                            : 0}%
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${metrics.memory.total > 0 ? (metrics.memory.used / metrics.memory.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>已用: {((metrics.memory.used || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                          <p>总计: {((metrics.memory.total || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                          {metrics.memory.cached && <p>缓存: {(metrics.memory.cached / (1024 * 1024 * 1024)).toFixed(2)} GB</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 网络监控 */}
                  {metrics.network && metrics.network.length > 0 && (
                    <div className="card">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Network className="w-5 h-5" />
                        网络接口
                      </h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {metrics.network.map((net: any, index: number) => (
                          <div key={index} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{net.interface}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                net.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {net.status || 'unknown'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>入: {((net.in || 0) / (1024 * 1024)).toFixed(2)} MB</div>
                              <div>出: {((net.out || 0) / (1024 * 1024)).toFixed(2)} MB</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 磁盘监控 - 单独一行 */}
                {metrics.disk && metrics.disk.length > 0 && (
                  <div className="card mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-gray-900">磁盘</h3>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {metrics.disk.map((d: any, index: number) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">{d.mount}</span>
                            <span className="text-sm font-medium text-gray-900">{d.percent || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-purple-500"
                              style={{ width: `${d.percent || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(d.used || 0).toFixed(2)} GB / {(d.total || 0).toFixed(2)} GB
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card">
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无监控数据</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    监控数据需要从监控API获取，当前服务器暂无监控数据
                  </p>
                  <button
                    onClick={loadMetrics}
                    className="btn-secondary text-sm mb-4"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    手动刷新
                  </button>
                  
                  {/* 监控模式切换 */}
                  <div className="mt-6 max-w-md mx-auto p-4 bg-gray-50 rounded-lg text-left">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">自动刷新</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoRefreshEnabled}
                          onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {autoRefreshEnabled && (
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">刷新模式</label>
                        <select
                          value={monitoringMode}
                          onChange={(e) => setMonitoringMode(e.target.value as 'websocket' | 'polling' | 'manual')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="websocket">WebSocket实时推送（推荐）</option>
                          <option value="polling">智能轮询（10秒）</option>
                          <option value="manual">手动刷新</option>
                        </select>
                        {monitoringMode === 'websocket' && (
                          <p className="text-xs text-gray-500 mt-2">
                            {wsConnected ? '✓ WebSocket已连接' : '⏳ WebSocket连接中...'}
                          </p>
                        )}
                        {monitoringMode === 'polling' && (
                          <p className="text-xs text-gray-500 mt-2">
                            ℹ️ 每10秒自动刷新一次（页面不可见时暂停）
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 监控图表 */}
            {metrics && metrics.history && metrics.history.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">CPU使用率趋势</h3>
                  <MetricChart
                    data={metrics.history}
                    dataKey="cpu_percent"
                    name="CPU使用率"
                    unit="%"
                    color="#3b82f6"
                    height={200}
                  />
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">内存使用率趋势</h3>
                  <MetricChart
                    data={metrics.history}
                    dataKey="memory_percent"
                    name="内存使用率"
                    unit="%"
                    color="#10b981"
                    height={200}
                  />
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">磁盘使用率趋势</h3>
                  <MetricChart
                    data={metrics.history}
                    dataKey="disk_percent"
                    name="磁盘使用率"
                    unit="%"
                    color="#8b5cf6"
                    height={200}
                  />
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-900 mb-4">网络流量趋势</h3>
                  <MetricChart
                    data={metrics.history}
                    dataKey={['network_in', 'network_out']}
                    name={['入流量', '出流量']}
                    unit="bytes"
                    color={['#f59e0b', '#ef4444']}
                    height={200}
                  />
                </div>
              </div>
            )}
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
                  />
                </div>
                {!sshConnected ? (
                  <button
                    onClick={handleConnectSSH}
                    disabled={!selectedCredential}
                    className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Terminal className="w-4 h-4 inline mr-1" />
                    连接
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectSSH}
                    className="btn-secondary text-sm"
                  >
                    断开
                  </button>
                )}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              {!sshConnected ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center max-w-md">
                    <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    {selectedCredential ? (
                      <>
                        <div className="mb-3 text-lg">准备就绪</div>
                        <div className="mb-4 text-sm text-gray-500">
                          点击"连接"按钮开始SSH会话
                        </div>
                        <button
                          onClick={handleConnectSSH}
                          className="btn-primary"
                        >
                          <Terminal className="w-4 h-4 inline mr-2" />
                          立即连接
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 text-lg">SSH终端</div>
                        <div className="mb-4 text-sm text-gray-500">
                          {credentials.length > 0 
                            ? '请先选择一个凭据'
                            : '请先添加服务器凭据'
                          }
                        </div>
                        {credentials.length === 0 && (
                          <button
                            onClick={() => navigate('/credentials')}
                            className="btn-secondary"
                          >
                            前往凭据管理
                          </button>
                        )}
                      </>
                    )}
                    <div className="mt-4 text-xs text-gray-600">
                      SSH终端需要WebSocket支持，请确保后端服务正常运行
                    </div>
                  </div>
                </div>
              ) : id && selectedCredential && token ? (
                <SshTerminal
                  serverId={parseInt(id)}
                  credentialId={selectedCredential}
                  token={token}
                  onDisconnect={handleDisconnectSSH}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <X className="w-12 h-12 mx-auto mb-4 text-red-400" />
                    <div>连接参数不完整</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">文件管理</h3>
              <div className="flex items-center gap-2">
                {!selectedCredential && (
                  <div className="text-sm text-gray-500">请先选择凭据</div>
                )}
                {selectedCredential && (
                  <>
                    <CredentialSelector
                      credentials={credentials}
                      selectedId={selectedCredential}
                      onSelect={setSelectedCredential}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      上传
                    </button>
                    <button
                      onClick={() => setShowMkdirDialog(true)}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      新建文件夹
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleUpload}
                    />
                  </>
                )}
              </div>
            </div>
            
            {selectedCredential ? (
              <>
                {/* 路径导航 */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => setCurrentPath('/')}
                      className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
                    >
                      <Home className="w-4 h-4" />
                    </button>
                    {currentPath !== '/' && (
                      <>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 font-mono">{currentPath}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 文件列表 */}
                {loadingFiles ? (
                  <div className="text-center py-8">
                    <Loading />
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">名称</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">类型</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">大小</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">修改时间</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">权限</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPath !== '/' && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <td colSpan={6}>
                                <button
                                  onClick={() => {
                                    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
                                    setCurrentPath(parentPath)
                                  }}
                                  className="w-full text-left py-2 px-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-2"
                                >
                                  <FolderOpen className="w-4 h-4" />
                                  ..
                                </button>
                              </td>
                            </tr>
                          )}
                          {files.map((file) => (
                            <tr key={file.path} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-4">
                                <button
                                  onClick={() => handleFileClick(file)}
                                  className="flex items-center gap-2 text-sm text-gray-900 hover:text-blue-600"
                                >
                                  {file.type === 'directory' ? (
                                    <Folder className="w-4 h-4 text-blue-500" />
                                  ) : (
                                    <FileIcon className="w-4 h-4 text-gray-400" />
                                  )}
                                  {file.name}
                                </button>
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600">
                                {file.type === 'directory' ? '目录' : '文件'}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600 text-right">
                                {file.type === 'file' ? formatFileSize(file.size) : '-'}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600">
                                {formatDate(file.modified)}
                              </td>
                              <td className="py-2 px-4 text-sm text-gray-600 font-mono">
                                {file.permissions}
                              </td>
                              <td className="py-2 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  {file.type === 'file' && (
                                    <button
                                      onClick={() => handleDownload(file)}
                                      className="p-1 hover:bg-gray-200 rounded"
                                      title="下载"
                                    >
                                      <Download className="w-4 h-4 text-gray-600" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(file)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {files.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                                当前目录为空
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                请先选择凭据以访问文件系统
              </div>
            )}

            {/* 创建目录对话框 */}
            {showMkdirDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">创建目录</h3>
                  <input
                    type="text"
                    value={newDirName}
                    onChange={(e) => setNewDirName(e.target.value)}
                    placeholder="目录名称"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateDir()
                      }
                    }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowMkdirDialog(false)
                        setNewDirName('')
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreateDir}
                      className="btn-primary px-4 py-2"
                    >
                      创建
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'processes' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">进程管理</h3>
              <div className="flex items-center gap-2">
                {!selectedCredential && (
                  <div className="text-sm text-gray-500">请先选择凭据</div>
                )}
                {selectedCredential && (
                  <>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        placeholder="搜索进程..."
                        className="outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={loadProcesses}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      刷新
                    </button>
                  </>
                )}
              </div>
            </div>

            {selectedCredential ? (
              <>
                {loadingProcesses ? (
                  <div className="text-center py-8">
                    <Loading />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">PID</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">用户</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">CPU%</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">内存%</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">内存(MB)</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">状态</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">命令</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processes.map((proc) => (
                          <tr key={proc.pid} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-sm text-gray-900 font-mono">{proc.pid}</td>
                            <td className="py-2 px-4 text-sm text-gray-600">{proc.user}</td>
                            <td className="py-2 px-4 text-sm text-gray-600 text-right">{proc.cpu_percent.toFixed(1)}%</td>
                            <td className="py-2 px-4 text-sm text-gray-600 text-right">{proc.memory_percent.toFixed(1)}%</td>
                            <td className="py-2 px-4 text-sm text-gray-600 text-right">{(proc.rss / 1024).toFixed(1)}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                proc.stat.includes('R') ? 'bg-green-100 text-green-700' :
                                proc.stat.includes('S') ? 'bg-blue-100 text-blue-700' :
                                proc.stat.includes('Z') ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {proc.stat}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-sm text-gray-600 truncate max-w-xs" title={proc.command}>
                              {proc.command}
                            </td>
                            <td className="py-2 px-4">
                              <button
                                onClick={() => handleKillProcess(proc.pid)}
                                className="p-1 hover:bg-gray-200 rounded text-red-600"
                                title="终止进程"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {processes.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                              {processSearch ? '未找到匹配的进程' : '暂无进程数据'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                请先选择凭据以查看进程列表
              </div>
            )}
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">命令执行</h3>
              {!selectedCredential && (
                <div className="text-sm text-gray-500">请先选择凭据</div>
              )}
            </div>

            {selectedCredential ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
                    <span className="text-gray-600">$</span>
                    <input
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !executingCommand) {
                          handleExecuteCommand()
                        }
                      }}
                      placeholder="输入命令..."
                      className="flex-1 outline-none bg-transparent text-sm"
                      disabled={executingCommand}
                    />
                  </div>
                  <button
                    onClick={handleExecuteCommand}
                    disabled={!commandInput.trim() || executingCommand}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {executingCommand ? '执行中...' : '执行'}
                  </button>
                </div>

                {commandOutput && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-900 text-gray-100 px-4 py-2 text-sm font-mono">
                      $ {commandOutput.command}
                    </div>
                    <div className="bg-gray-800 text-gray-100 p-4 font-mono text-sm max-h-96 overflow-y-auto">
                      {commandOutput.output && (
                        <div className="text-green-400 whitespace-pre-wrap mb-2">
                          {commandOutput.output}
                        </div>
                      )}
                      {commandOutput.error && (
                        <div className="text-red-400 whitespace-pre-wrap">
                          {commandOutput.error}
                        </div>
                      )}
                      {!commandOutput.output && !commandOutput.error && (
                        <div className="text-gray-400">命令执行完成（无输出）</div>
                      )}
                    </div>
                    <div className={`px-4 py-2 text-sm ${
                      commandOutput.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      退出状态: {commandOutput.success ? '成功' : '失败'}
                    </div>
                  </div>
                )}

                {!commandOutput && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>输入命令并点击"执行"按钮</p>
                    <p className="text-xs mt-2">提示：命令将在服务器上执行，请谨慎操作</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                请先选择凭据以执行命令
              </div>
            )}
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">凭据管理</h3>
                <button 
                  className="btn-primary text-sm flex items-center gap-2"
                  onClick={() => {
                    setEditingCredential(null)
                    setShowCredentialForm(true)
                  }}
                >
                  <Plus className="w-4 h-4" />
                  添加凭据
                </button>
              </div>
              <div className="space-y-4">
                {credentials.map((cred) => (
                  <div key={cred.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{cred.username || '--'}</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {cred.credential_type === 'password' ? '密码' : 
                             cred.credential_type === 'ssh_key' ? 'SSH密钥' : 
                             cred.credential_type === 'api_key' ? 'API密钥' : '未知'}
                          </span>
                          {cred.id === selectedCredential && (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                              当前使用
                            </span>
                          )}
                          {server?.default_credential_id === cred.id && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                              默认凭据
                            </span>
                          )}
                          {!cred.is_active && (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                              已禁用
                            </span>
                          )}
                        </div>
                        {cred.description && (
                          <p className="text-sm text-gray-600 mt-1">{cred.description}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          最后更新: {new Date(cred.updated_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewCredential(cred)}
                          className="btn-secondary text-sm"
                          title="查看详情"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => {
                            setEditingCredential(cred)
                            setShowCredentialForm(true)
                          }}
                          className="btn-secondary text-sm"
                          title="编辑"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleTestCredentialConnection(cred.id)}
                          disabled={testingCredential === cred.id}
                          className="btn-secondary text-sm flex items-center gap-1"
                          title="测试连接"
                        >
                          {testingCredential === cred.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          测试
                        </button>
                        {server?.default_credential_id !== cred.id && (
                          <button
                            onClick={() => handleSetDefaultCredential(cred.id)}
                            className="btn-secondary text-sm"
                            title="设为默认"
                          >
                            设默认
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCredential(cred.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                          title="删除"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {credentials.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无凭据，请先添加凭据</p>
                    <button
                      className="btn-primary text-sm mt-4 flex items-center gap-2 mx-auto"
                      onClick={() => {
                        setEditingCredential(null)
                        setShowCredentialForm(true)
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      添加第一个凭据
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 连接测试结果 */}
            {testResult && (
              <div className={`card border-2 ${
                testResult.success 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-red-500 bg-red-50'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className={`font-bold ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '✓ 连接测试成功' : '✗ 连接测试失败'}
                  </h4>
                  <button
                    onClick={() => setTestResult(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-sm mb-2 ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </p>
                {testResult.output && (
                  <div className="mt-2 p-2 bg-gray-900 text-green-400 font-mono text-xs rounded overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{testResult.output}</pre>
                  </div>
                )}
                {testResult.error && (
                  <div className="mt-2 p-2 bg-gray-900 text-red-400 font-mono text-xs rounded overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{testResult.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">系统信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">服务器名称</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.name || '--'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">主机地址</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.host || '--'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">端口</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.port || 22}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">服务器类型</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.server_type || '--'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">网络类型</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{server.network_type || '--'}</p>
                </div>
                {server.os_info && server.os_info.os && (
                  <>
                    <div>
                      <label className="text-sm text-gray-600">操作系统</label>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {server.os_info.os.name && server.os_info.os.name !== 'Unknown' 
                          ? server.os_info.os.name 
                          : '--'}
                        {server.os_info.os.version && server.os_info.os.version !== 'Unknown' && ` ${server.os_info.os.version}`}
                        {server.os_info.os.codename && ` (${server.os_info.os.codename})`}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">内核版本</label>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {server.os_info.os.kernel && server.os_info.os.kernel !== 'Unknown' 
                          ? server.os_info.os.kernel 
                          : '--'}
                      </p>
                    </div>
                    {server.os_info.os.architecture && server.os_info.os.architecture !== 'Unknown' && (
                      <div>
                        <label className="text-sm text-gray-600">架构</label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.os.architecture}</p>
                      </div>
                    )}
                  </>
                )}
                {server.os_info && server.os_info.hostname && (
                  <div>
                    <label className="text-sm text-gray-600">主机名</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.hostname}</p>
                  </div>
                )}
                {server.os_info && server.os_info.timezone && (
                  <div>
                    <label className="text-sm text-gray-600">时区</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.timezone}</p>
                  </div>
                )}
                {server.os_info && server.os_info.system_time && (
                  <div>
                    <label className="text-sm text-gray-600">系统时间</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.system_time}</p>
                  </div>
                )}
                {server.os_info && server.os_info.uptime && (
                  <div>
                    <label className="text-sm text-gray-600">运行时间</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.uptime}</p>
                  </div>
                )}
                {server.os_info && server.os_info.language && (
                  <div>
                    <label className="text-sm text-gray-600">系统语言</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.language}</p>
                  </div>
                )}
                {server.os_info && server.os_info.logged_in_users !== undefined && (
                  <div>
                    <label className="text-sm text-gray-600">登录用户数</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.logged_in_users}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      server.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {server.status === 'online' ? '在线' : server.status === 'offline' ? '离线' : server.status || '未知'}
                    </span>
                  </p>
                </div>
                {server.last_check && (
                  <div>
                    <label className="text-sm text-gray-600">最后检查时间</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {new Date(server.last_check).toLocaleString('zh-CN')}
                    </p>
                  </div>
                )}
                {server.jump_host && (
                  <div>
                    <label className="text-sm text-gray-600">跳板机</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {server.jump_host.name} ({server.jump_host.host})
                    </p>
                  </div>
                )}
                {server.os_info && server.os_info.cpu && (
                  <>
                    {server.os_info.cpu.model && server.os_info.cpu.model !== 'Unknown' && (
                      <div>
                        <label className="text-sm text-gray-600">CPU型号</label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.cpu.model}</p>
                      </div>
                    )}
                    {server.os_info.cpu.cores > 0 && (
                      <div>
                        <label className="text-sm text-gray-600">CPU核心数</label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.cpu.cores}</p>
                      </div>
                    )}
                    {server.os_info.cpu.frequency_mhz && (
                      <div>
                        <label className="text-sm text-gray-600">CPU频率</label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.cpu.frequency_mhz} MHz</p>
                      </div>
                    )}
                    {server.os_info.cpu.cache_size && (
                      <div>
                        <label className="text-sm text-gray-600">CPU缓存</label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{server.os_info.cpu.cache_size}</p>
                      </div>
                    )}
                  </>
                )}
                {server.description && (
                  <div>
                    <label className="text-sm text-gray-600">描述</label>
                    <p className="text-sm font-medium text-gray-900 mt-1">{server.description}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">创建时间</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {server.created_at ? new Date(server.created_at).toLocaleString('zh-CN') : '--'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">更新时间</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {server.updated_at ? new Date(server.updated_at).toLocaleString('zh-CN') : '--'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 凭据表单对话框 */}
        {showCredentialForm && (
          <CredentialFormDialog
            serverId={id ? parseInt(id) : 0}
            credential={editingCredential}
            onClose={() => {
              setShowCredentialForm(false)
              setEditingCredential(null)
            }}
            onSuccess={() => {
              setShowCredentialForm(false)
              setEditingCredential(null)
              loadCredentials()
            }}
          />
        )}

        {/* 查看凭据详情对话框 */}
        {viewingCredential && (
          <ViewCredentialDialog
            credential={viewingCredential}
            revealedPassword={revealedPassword}
            onClose={() => {
              setViewingCredential(null)
              setRevealedPassword(null)
            }}
            onTogglePassword={() => togglePasswordVisibility(viewingCredential)}
          />
        )}
      </div>
    </div>
  )
}

// 凭据表单对话框组件（简化版，默认关联到当前服务器）
function CredentialFormDialog({
  serverId,
  credential,
  onClose,
  onSuccess
}: {
  serverId: number
  credential: Credential | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    credential_type: credential?.credential_type || 'password',
    username: credential?.username || '',
    password: '',
    ssh_key_path: credential?.ssh_key_path || '',
    ssh_key_content: '',
    ssh_key_mode: (credential?.credential_type === 'ssh_key' && credential?.ssh_key_path) ? 'path' as const : 'content' as const,
    description: credential?.description || '',
    is_active: credential?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingSshKey, setLoadingSshKey] = useState(false)

  // 编辑时加载SSH密钥内容
  useEffect(() => {
    if (credential && credential.credential_type === 'ssh_key' && formData.ssh_key_mode === 'content' && !formData.ssh_key_content) {
      loadSshKeyContent()
    }
  }, [credential, formData.credential_type, formData.ssh_key_mode])

  const loadSshKeyContent = async () => {
    if (!credential) return
    try {
      setLoadingSshKey(true)
      const response = await decryptCredential(credential.id)
      setFormData(prev => ({ ...prev, ssh_key_content: response.password }))
    } catch (err: any) {
      console.error('加载SSH密钥内容失败:', err)
    } finally {
      setLoadingSshKey(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      if (!formData.credential_type) {
        setError('凭据类型不能为空')
        return
      }
      if (formData.credential_type === 'password' && !formData.password && !credential) {
        setError('密码不能为空')
        return
      }
      if (formData.credential_type === 'ssh_key') {
        if (formData.ssh_key_mode === 'content' && !formData.ssh_key_content.trim()) {
          setError('SSH私钥内容不能为空')
          return
        }
        if (formData.ssh_key_mode === 'path' && !formData.ssh_key_path.trim()) {
          setError('SSH私钥路径不能为空')
          return
        }
      }

      if (credential) {
        // 更新凭据
        const updateData: CredentialUpdate = {
          credential_type: formData.credential_type,
          username: formData.username || undefined,
          ssh_key_path: formData.ssh_key_mode === 'path' ? formData.ssh_key_path || undefined : undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        }
        
        if (formData.credential_type === 'password') {
          if (formData.password && formData.password.trim()) {
            updateData.password = formData.password
          }
        } else if (formData.credential_type === 'ssh_key') {
          if (formData.ssh_key_mode === 'content' && formData.ssh_key_content && formData.ssh_key_content.trim()) {
            updateData.password = formData.ssh_key_content
          }
        }
        
        await updateCredential(credential.id, updateData)
      } else {
        // 创建凭据（默认关联到当前服务器）
        const createData: CredentialCreate = {
          resource_type: 'server',
          resource_id: serverId,
          credential_type: formData.credential_type,
          username: formData.username || undefined,
          password: formData.credential_type === 'ssh_key' && formData.ssh_key_mode === 'content' 
            ? formData.ssh_key_content 
            : formData.password || undefined,
          ssh_key_path: formData.ssh_key_mode === 'path' ? formData.ssh_key_path || undefined : undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        }
        await createCredential(createData)
      }
      onSuccess()
    } catch (err: any) {
      let errorMessage = credential ? '更新失败' : '创建失败'
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
      console.error('保存凭据失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {credential ? '编辑凭据' : '添加凭据'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              凭据类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.credential_type}
              onChange={(e) => setFormData({ ...formData, credential_type: e.target.value, password: '', ssh_key_path: '', ssh_key_content: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="password">密码</option>
              <option value="ssh_key">SSH密钥</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="请输入用户名（可选）"
            />
          </div>

          {formData.credential_type === 'password' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码 {!credential && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={credential ? '留空则不修改密码' : '请输入密码'}
                required={!credential}
              />
              {credential && (
                <p className="text-xs text-gray-500 mt-1">留空则不修改密码</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SSH私钥使用方式 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ssh_key_mode"
                      value="content"
                      checked={formData.ssh_key_mode === 'content'}
                      onChange={(e) => setFormData({ ...formData, ssh_key_mode: 'content' as const })}
                      className="mr-2"
                    />
                    <span className="text-sm">私钥内容（推荐）</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ssh_key_mode"
                      value="path"
                      checked={formData.ssh_key_mode === 'path'}
                      onChange={(e) => setFormData({ ...formData, ssh_key_mode: 'path' as const })}
                      className="mr-2"
                    />
                    <span className="text-sm">私钥路径</span>
                  </label>
                </div>
              </div>

              {formData.ssh_key_mode === 'content' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH私钥内容 <span className="text-red-500">*</span>
                    {loadingSshKey && (
                      <span className="text-xs text-blue-600 ml-2">加载中...</span>
                    )}
                  </label>
                  <textarea
                    value={formData.ssh_key_content}
                    onChange={(e) => setFormData({ ...formData, ssh_key_content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-xs"
                    rows={10}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEpAIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
                    required
                    disabled={loadingSshKey}
                  />
                </div>
              )}

              {formData.ssh_key_mode === 'path' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSH私钥路径 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ssh_key_path}
                    onChange={(e) => setFormData({ ...formData, ssh_key_path: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="/opt/ssh_keys/id_rsa 或 ~/.ssh/id_rsa"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="请输入凭据描述（可选）"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              启用凭据
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 py-2"
            >
              {saving ? '保存中...' : credential ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 查看凭据详情对话框组件
function ViewCredentialDialog({
  credential,
  revealedPassword,
  onClose,
  onTogglePassword
}: {
  credential: Credential
  revealedPassword: string | null
  onClose: () => void
  onTogglePassword: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">凭据详情</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <p className="text-sm text-gray-900">{credential.username || '--'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">凭据类型</label>
            <p className="text-sm text-gray-900">
              {credential.credential_type === 'password' ? '密码' : 
               credential.credential_type === 'ssh_key' ? 'SSH密钥' : 
               credential.credential_type === 'api_key' ? 'API密钥' : '未知'}
            </p>
          </div>

          {credential.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <p className="text-sm text-gray-900">{credential.description}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <p className="text-sm">
              <span className={`px-2 py-1 rounded text-xs ${
                credential.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {credential.is_active ? '启用' : '已禁用'}
              </span>
            </p>
          </div>

          {credential.credential_type === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <div className="flex items-center gap-2">
                {revealedPassword ? (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-mono text-sm flex-1">{revealedPassword}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(revealedPassword)
                        alert('已复制到剪贴板')
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="复制"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-500">点击眼睛图标查看密码</span>
                  </div>
                )}
                <button
                  onClick={onTogglePassword}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title={revealedPassword ? '隐藏密码' : '显示密码'}
                >
                  {revealedPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          )}

          {credential.credential_type === 'ssh_key' && credential.ssh_key_path && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSH私钥路径</label>
              <p className="text-sm font-mono text-gray-900">{credential.ssh_key_path}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">创建时间</label>
            <p className="text-sm text-gray-900">{new Date(credential.created_at).toLocaleString('zh-CN')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">更新时间</label>
            <p className="text-sm text-gray-900">{new Date(credential.updated_at).toLocaleString('zh-CN')}</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="btn-primary px-4 py-2"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

