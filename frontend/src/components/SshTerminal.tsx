import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { X } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface SshTerminalProps {
  serverId: number
  credentialId: number
  token: string
  onDisconnect?: () => void
}

export default function SshTerminal({
  serverId,
  credentialId,
  token,
  onDisconnect
}: SshTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isMountedRef = useRef(true)
  const isInitializedRef = useRef(false)
  const initAttemptRef = useRef(0) // 用于跟踪初始化尝试次数
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!terminalRef.current || !serverId || !credentialId || !token) {
      console.log('SSH终端参数不完整:', { serverId, credentialId, token: !!token })
      return
    }

    // 如果已有正在连接或已连接的 WebSocket，则跳过重复连接
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('已有WebSocket连接，跳过重复连接，状态:', state)
        return
      }
      // 只有在已关闭状态下才清空引用，准备重新建立
      wsRef.current = null
    }

    // 如果终端已经初始化且实例存在，避免 React Strict 模式下重复初始化
    if (isInitializedRef.current && terminalInstanceRef.current) {
      console.log('终端已初始化，跳过重复初始化')
      return
    }

    // 防止 React Strict 模式下的重复初始化
    // 如果这是第二次尝试且距离第一次很近（< 100ms），则跳过
    const now = Date.now()
    if (initAttemptRef.current > 0) {
      const timeSinceLastAttempt = now - (initAttemptRef.current as any)
      if (timeSinceLastAttempt < 100) {
        console.log('检测到快速重复初始化（React Strict模式），跳过')
        return
      }
    }
    initAttemptRef.current = now

    console.log('初始化SSH终端:', { serverId, credentialId })
    
    // 标记为已初始化
    isInitializedRef.current = true
    
    // 重置挂载状态
    isMountedRef.current = true
    setConnected(false)
    setError(null)

    // 初始化终端
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
      lineHeight: 1.2,
      scrollback: 1000, // 减少滚动缓冲区，提高性能
      convertEol: true,
      scrollOnUserInput: true, // 用户输入时自动滚动到底部
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        black: '#1e1e1e',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#bc3fbc',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    })

    // 添加插件
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    // 打开终端
    terminal.open(terminalRef.current)
    fitAddon.fit()

    terminalInstanceRef.current = terminal
    fitAddonRef.current = fitAddon

    // 构建WebSocket URL - 使用新的asyncssh端点
    // 从环境变量或默认值获取API基础URL
    const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api'
    // 移除 /api 后缀，获取基础URL
    const baseUrl = apiUrl.replace(/\/api$/, '')
    const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:'
    const wsHost = baseUrl.replace(/^https?:\/\//, '')
    // 使用新的asyncssh端点
    const wsUrl = `${wsProtocol}//${wsHost}/api/servers/${serverId}/ssh/terminal/asyncssh?credential_id=${credentialId}&token=${encodeURIComponent(token)}`

    // 连接WebSocket
    console.log('正在建立WebSocket连接...', wsUrl)
    setConnected(false)
    setError(null)
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // WebSocket事件处理
    ws.onopen = () => {
      if (!isMountedRef.current) {
        console.log('组件已卸载，关闭连接')
        try {
          ws.close()
        } catch (e) {
          // 忽略关闭错误
        }
        return
      }
      console.log('SSH WebSocket连接已建立')
      setConnected(true)
      setError(null)
      
      // 发送终端大小
      const dimensions = fitAddon.proposeDimensions()
      if (dimensions && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'resize',
            rows: dimensions.rows,
            cols: dimensions.cols
          }))
        } catch (e) {
          console.error('发送终端大小失败:', e)
        }
      }
    }
    
    ws.onerror = (err) => {
      if (!isMountedRef.current) return
      console.error('WebSocket连接错误:', err)
      console.error('WebSocket URL:', wsUrl)
      const errorMsg = 'WebSocket连接失败，请检查后端服务'
      setError(errorMsg)
      setConnected(false)
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.writeln('\r\n\x1b[31m[错误] WebSocket连接失败\x1b[0m\r\n\r\n')
        terminalInstanceRef.current.writeln('可能的原因：\r\n')
        terminalInstanceRef.current.writeln(`  1. 后端服务未运行 (${wsHost})\r\n`)
        terminalInstanceRef.current.writeln(`  2. 凭据认证失败\r\n`)
        terminalInstanceRef.current.writeln(`  3. 服务器无法访问\r\n\r\n`)
        terminalInstanceRef.current.writeln('请检查后端服务状态和凭据配置\r\n')
      }
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === 'connected') {
          terminal.writeln(`\r\n\x1b[32m✓ ${message.message || 'SSH终端已连接'}\x1b[0m\r\n`)
        } else if (message.type === 'output') {
          // 写入SSH输出
          terminal.write(message.data || '')
        } else if (message.type === 'error') {
          terminal.writeln(`\r\n\x1b[31m✗ 错误: ${message.message || '未知错误'}\x1b[0m\r\n`)
          setError(message.message || '未知错误')
        }
      } catch (err) {
        console.error('解析WebSocket消息失败:', err)
        // 可能是原始文本数据
        if (typeof event.data === 'string') {
          terminal.write(event.data)
        }
      }
    }


    ws.onclose = (event) => {
      if (!isMountedRef.current) return
      console.log('SSH WebSocket连接已关闭', event.code, event.reason)
      setConnected(false)
      if (terminalInstanceRef.current) {
        if (event.code === 1000) {
          // 正常关闭
          terminalInstanceRef.current.writeln('\r\n\x1b[33m[连接已断开]\x1b[0m\r\n')
        } else {
          // 异常关闭
          terminalInstanceRef.current.writeln(`\r\n\x1b[31m[连接异常断开] Code: ${event.code}\x1b[0m\r\n`)
          if (event.reason) {
            terminalInstanceRef.current.writeln(`原因: ${event.reason}\r\n`)
          }
        }
      }
      if (onDisconnect) {
        onDisconnect()
      }
    }

    // 终端输入处理
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: data
        }))
      }
    })

    // 窗口大小调整处理
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        const dimensions = fitAddonRef.current.proposeDimensions()
        if (dimensions && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            rows: dimensions.rows,
            cols: dimensions.cols
          }))
        }
      }
    }

    window.addEventListener('resize', handleResize)

    // 清理函数
    return () => {
      // 在React严格模式下，清理函数可能会在连接建立前被调用
      // 只有在真正卸载时才清理资源
      if (!isMountedRef.current) {
        console.log('组件已卸载，跳过清理')
        return
      }
      
      // 检查是否是 React Strict 模式的"模拟卸载"
      // 如果是，只清理 WebSocket，保留终端实例
      const isStrictModeCleanup = isInitializedRef.current && terminalInstanceRef.current && 
                                   (!wsRef.current || wsRef.current.readyState === WebSocket.CONNECTING)
      
      if (isStrictModeCleanup) {
        console.log('检测到 React Strict 模式清理，跳过实际关闭以避免中断连接')
        // 保留正在建立的连接与终端实例，等待下一次挂载复用
        return
      }
      
      console.log('清理SSH终端资源...')
      isMountedRef.current = false
      isInitializedRef.current = false
      initAttemptRef.current = 0
      window.removeEventListener('resize', handleResize)
      
      // 仅在已打开状态下关闭，避免 React Strict 模式下 CONNECTING 被提前关闭
      if (wsRef.current) {
        const readyState = wsRef.current.readyState
        console.log('WebSocket状态:', readyState, {
          CONNECTING: WebSocket.CONNECTING,
          OPEN: WebSocket.OPEN,
          CLOSING: WebSocket.CLOSING,
          CLOSED: WebSocket.CLOSED
        })

        if (readyState === WebSocket.OPEN) {
          try {
            wsRef.current.close(1000, 'Component unmounting')
            console.log('WebSocket连接已关闭')
          } catch (e) {
            console.error('关闭WebSocket失败:', e)
          }
        }
        wsRef.current = null
      }
      
      // 清理终端实例
      if (terminalInstanceRef.current) {
        try {
          terminalInstanceRef.current.dispose()
          console.log('终端实例已清理')
        } catch (e) {
          console.error('清理终端实例失败:', e)
        }
        terminalInstanceRef.current = null
      }
      
      // 清理fitAddon引用
      fitAddonRef.current = null
    }
    // 注意：不包含onDisconnect在依赖项中，避免因函数引用变化导致重复执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, credentialId, token])

  return (
    <div className="relative">
      {error && (
        <div className="absolute top-2 left-2 right-2 bg-red-900/90 text-red-100 px-4 py-2 text-sm z-10 rounded shadow-lg flex items-center gap-2">
          <X className="w-4 h-4" />
          <span className="flex-1">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="hover:bg-red-800 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {connected && !error && (
        <div className="absolute top-2 right-2 bg-green-900/90 text-green-100 px-3 py-1 text-xs z-10 rounded shadow-lg flex items-center gap-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          已连接
        </div>
      )}
      {!connected && !error && (
        <div className="absolute top-2 right-2 bg-yellow-900/90 text-yellow-100 px-3 py-1 text-xs z-10 rounded shadow-lg flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          连接中...
        </div>
      )}
      <div
        ref={terminalRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  )
}
