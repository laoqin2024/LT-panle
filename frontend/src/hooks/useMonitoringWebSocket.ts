import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'

interface MetricData {
  type: string
  resource_type: string
  resource_id: number
  data: any
  timestamp: string
}

interface UseMonitoringWebSocketOptions {
  resourceType: 'server' | 'device' | 'site' | 'database'
  resourceId: number
  enabled?: boolean
  onMetricUpdate?: (data: any) => void
  onError?: (error: Error) => void
}

/**
 * WebSocket监控数据推送Hook
 * 
 * 优势：
 * 1. 实时推送，延迟低
 * 2. 服务器主动推送，减少无效请求
 * 3. 连接复用，资源占用少
 * 4. 支持订阅/取消订阅，灵活控制
 * 
 * 注意事项：
 * 1. 需要后端支持WebSocket推送
 * 2. 连接断开时会自动重连
 * 3. 页面不可见时会暂停接收（但保持连接）
 */
export function useMonitoringWebSocket({
  resourceType,
  resourceId,
  enabled = true,
  onMetricUpdate,
  onError
}: UseMonitoringWebSocketOptions) {
  const { token } = useAuthStore()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000 // 3秒
  const hasReachedMaxAttempts = useRef(false) // 是否已达到最大重试次数
  const isEnabledRef = useRef(enabled) // 使用ref存储enabled状态，避免依赖变化导致重新连接
  
  // 使用ref存储回调函数，避免依赖变化导致重新连接
  const onMetricUpdateRef = useRef(onMetricUpdate)
  const onErrorRef = useRef(onError)
  
  // 更新ref值
  useEffect(() => {
    onMetricUpdateRef.current = onMetricUpdate
    onErrorRef.current = onError
    isEnabledRef.current = enabled
  }, [onMetricUpdate, onError, enabled])

  useEffect(() => {
    if (!enabled || !token) {
      // 如果禁用或没有token，关闭现有连接
      hasReachedMaxAttempts.current = false // 重置标志
      reconnectAttempts.current = 0 // 重置重试次数
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
      return
    }
    
    // 如果已达到最大重试次数，不再尝试连接
    if (hasReachedMaxAttempts.current) {
      console.log('[MonitoringWebSocket] 已达到最大重试次数，不再尝试连接')
      return
    }

    // 构建WebSocket URL
    // 从API URL中提取主机和端口，去掉 /api 后缀（WebSocket不在 /api 下）
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    // 去掉 /api 后缀（如果存在）
    apiUrl = apiUrl.replace(/\/api\/?$/, '')
    // 转换为WebSocket协议
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:'
    // 提取主机和端口
    const wsHost = apiUrl.replace(/^https?:\/\//, '')
    const wsUrl = `${wsProtocol}//${wsHost}/ws/monitoring?token=${token}`
    
    console.log('[MonitoringWebSocket] 连接URL:', wsUrl.replace(/token=[^&]+/, 'token=***'))

    let ws: WebSocket | null = null

    const connect = () => {
      // 检查是否仍然启用
      if (!isEnabledRef.current || hasReachedMaxAttempts.current) {
        console.log('[MonitoringWebSocket] 连接已禁用或已达到最大重试次数，取消连接')
        return
      }
      
      try {
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[MonitoringWebSocket] 连接已建立')
          setConnected(true)
          setError(null)
          reconnectAttempts.current = 0

          // 订阅资源（延迟一点，确保连接完全建立）
          setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              const resourceKey = `${resourceType}:${resourceId}`
              try {
                // 根据后端API，使用 action: "subscribe" 格式
                ws.send(JSON.stringify({
                  action: 'subscribe',
                  resource_type: resourceType,
                  resource_id: resourceId
                }))
                console.log(`[MonitoringWebSocket] 已发送订阅请求: ${resourceKey}`)
              } catch (err) {
                console.error('[MonitoringWebSocket] 发送订阅消息失败:', err)
                setError(new Error('发送订阅消息失败'))
                ws.close()
              }
            } else {
              console.warn('[MonitoringWebSocket] WebSocket未处于OPEN状态，无法订阅')
            }
          }, 200) // 增加延迟，确保连接完全建立
        }

        ws.onmessage = (event) => {
          try {
            const message: any = JSON.parse(event.data)
            console.log('[MonitoringWebSocket] 收到消息:', message.type || message.action, message)
            
            if (message.type === 'metric' && 
                message.resource_type === resourceType && 
                message.resource_id === resourceId) {
              // 调用回调函数更新监控数据
              if (onMetricUpdateRef.current) {
                onMetricUpdateRef.current(message.data)
              }
            } else if (message.type === 'connected' || message.type === 'subscribed') {
              console.log('[MonitoringWebSocket] 服务器确认连接/订阅:', message)
              // 连接成功，确保状态正确
              setConnected(true)
              setError(null)
            } else if (message.type === 'ping') {
              // 收到ping消息，回复pong（心跳检测）
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(JSON.stringify({
                    action: 'pong'
                  }))
                } catch (err) {
                  console.error('[MonitoringWebSocket] 发送pong消息失败:', err)
                }
              }
            } else if (message.type === 'pong') {
              // 收到pong消息（心跳响应），不处理，只记录
              console.log('[MonitoringWebSocket] 收到心跳响应')
            } else if (message.type === 'error') {
              console.error('[MonitoringWebSocket] 服务器错误:', message)
              const detailMsg = message.message || message.data?.message || 'WebSocket服务器错误'
              const err = new Error(detailMsg)
              setError(err)
              // 如果是token或认证问题，停止重试，避免死循环
              if (detailMsg.toLowerCase().includes('token') || detailMsg.includes('认证')) {
                hasReachedMaxAttempts.current = true
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.close(1008, detailMsg)
                }
              }
              if (onErrorRef.current) {
                onErrorRef.current(err)
              }
            } else {
              // 其他类型的消息，记录但不处理（降低日志级别）
              console.debug('[MonitoringWebSocket] 收到其他类型消息:', message.type, message)
            }
          } catch (err) {
            console.error('[MonitoringWebSocket] 解析消息失败:', err, event.data)
          }
        }

        ws.onerror = (event) => {
          console.error('[MonitoringWebSocket] WebSocket错误:', event)
          const err = new Error('WebSocket连接错误')
          setError(err)
          setConnected(false)
          if (onErrorRef.current) {
            onErrorRef.current(err)
          }
        }

        ws.onclose = (event) => {
          console.log('[MonitoringWebSocket] 连接已关闭', {
            code: event.code,
            reason: event.reason || '无原因',
            wasClean: event.wasClean
          })
          setConnected(false)
          wsRef.current = null

          // 认证相关的关闭（例如1008或提示token问题），直接停止重试并抛错
          const reasonText = (event.reason || '').toLowerCase()
          if (event.code === 1008 || reasonText.includes('token')) {
            hasReachedMaxAttempts.current = true
            const authErr = new Error('WebSocket认证失败或token失效，请重新登录')
            setError(authErr)
            if (onErrorRef.current) {
              onErrorRef.current(authErr)
            }
            return
          }

          // 如果已达到最大重试次数，不再尝试重连
          if (hasReachedMaxAttempts.current) {
            console.log('[MonitoringWebSocket] 已达到最大重试次数，不再重连')
            return
          }

          // 如果不是正常关闭，且仍然启用，尝试重连
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && isEnabledRef.current) {
            reconnectAttempts.current++
            console.log(`[MonitoringWebSocket] ${reconnectDelay}ms后尝试重连 (${reconnectAttempts.current}/${maxReconnectAttempts})`)
            
            reconnectTimeoutRef.current = setTimeout(() => {
              // 再次检查是否仍然启用
              if (isEnabledRef.current && !hasReachedMaxAttempts.current) {
                connect()
              }
            }, reconnectDelay)
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            hasReachedMaxAttempts.current = true
            const err = new Error('WebSocket重连失败，已达到最大重试次数')
            console.error('[MonitoringWebSocket]', err.message)
            setError(err)
            if (onErrorRef.current) {
              onErrorRef.current(err)
            }
          } else if (event.code === 1000) {
            // 正常关闭，不需要重连
            console.log('[MonitoringWebSocket] 连接正常关闭')
          }
        }
      } catch (err) {
        console.error('[MonitoringWebSocket] 连接失败:', err)
        const error = err instanceof Error ? err : new Error('WebSocket连接失败')
        setError(error)
        setConnected(false)
        if (onErrorRef.current) {
          onErrorRef.current(error)
        }
      }
    }

    // 重置重试状态
    hasReachedMaxAttempts.current = false
    reconnectAttempts.current = 0
    
    connect()

    // 清理函数
    return () => {
      hasReachedMaxAttempts.current = false
      reconnectAttempts.current = 0
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        // 取消订阅
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({
              action: 'unsubscribe',
              resource_type: resourceType,
              resource_id: resourceId
            }))
          } catch (err) {
            console.error('[MonitoringWebSocket] 取消订阅失败:', err)
          }
        }
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, token, resourceType, resourceId]) // 移除回调函数的依赖，使用ref代替

  return {
    connected,
    error
  }
}
