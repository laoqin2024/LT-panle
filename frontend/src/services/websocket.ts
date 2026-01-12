/**
 * WebSocket客户端服务
 * 用于实时监控数据推送
 */

export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface MetricMessage extends WebSocketMessage {
  type: 'metric'
  resource_type: string
  resource_id: number
  data: {
    cpu_percent?: number
    memory_percent?: number
    disk_percent?: number
    network_in?: number
    network_out?: number
    [key: string]: any
  }
  timestamp: string
}

export interface AlertMessage extends WebSocketMessage {
  type: 'alert'
  data: {
    id: number
    rule_name: string
    resource_type: string
    resource_id: number
    message: string
    severity: string
  }
  timestamp: string
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private handlers: Map<string, Set<WebSocketMessageHandler>> = new Map()
  private isConnecting = false
  private heartbeatInterval: number | null = null

  constructor(baseUrl: string, token: string) {
    // 将http/https转换为ws/wss
    const wsUrl = baseUrl.replace(/^http/, 'ws')
    this.url = `${wsUrl}/ws/monitoring?token=${token}`
    this.token = token
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    if (this.isConnecting) {
      return Promise.reject(new Error('正在连接中...'))
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket连接已建立')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('解析WebSocket消息失败:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          this.isConnecting = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('WebSocket连接已关闭')
          this.isConnecting = false
          this.stopHeartbeat()
          this.attemptReconnect()
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  subscribe(resourceType: string, resourceId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        resource_type: resourceType,
        resource_id: resourceId
      }))
    }
  }

  unsubscribe(resourceType: string, resourceId: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'unsubscribe',
        resource_type: resourceType,
        resource_id: resourceId
      }))
    }
  }

  on(messageType: string, handler: WebSocketMessageHandler): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set())
    }
    this.handlers.get(messageType)!.add(handler)
  }

  off(messageType: string, handler: WebSocketMessageHandler): void {
    const handlers = this.handlers.get(messageType)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // 调用所有注册的处理器
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('处理WebSocket消息失败:', error)
        }
      })
    }

    // 也调用通用处理器
    const allHandlers = this.handlers.get('*')
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('处理WebSocket消息失败:', error)
        }
      })
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket重连次数已达上限')
      return
    }

    this.reconnectAttempts++
    console.log(`尝试重连WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('WebSocket重连失败:', error)
      })
    }, this.reconnectDelay)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping' }))
      }
    }, 30000) // 每30秒发送一次心跳
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// 单例WebSocket客户端
let wsClient: WebSocketClient | null = null

export const getWebSocketClient = (baseUrl: string, token: string): WebSocketClient => {
  if (!wsClient) {
    wsClient = new WebSocketClient(baseUrl, token)
  }
  return wsClient
}

export const disconnectWebSocket = (): void => {
  if (wsClient) {
    wsClient.disconnect()
    wsClient = null
  }
}
