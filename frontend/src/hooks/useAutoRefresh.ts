import { useEffect, useRef } from 'react'
import { usePageVisibility } from './usePageVisibility'

interface UseAutoRefreshOptions {
  enabled?: boolean
  interval?: number // 刷新间隔（毫秒）
  onRefresh: () => void | Promise<void>
  immediate?: boolean // 是否立即执行一次
}

/**
 * 自动刷新Hook（智能轮询）
 * 
 * 特性：
 * 1. 页面不可见时自动暂停
 * 2. 页面可见时自动恢复
 * 3. 支持自定义刷新间隔
 * 4. 组件卸载时自动清理
 * 
 * 使用场景：
 * - WebSocket不可用时的降级方案
 * - 需要定期拉取数据的场景
 * 
 * 资源占用：
 * - 仅在页面可见时轮询
 * - 可配置刷新间隔（建议 >= 5秒）
 */
export function useAutoRefresh({
  enabled = true,
  interval = 5000, // 默认5秒
  onRefresh,
  immediate = true
}: UseAutoRefreshOptions) {
  const isVisible = usePageVisibility()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  // 使用 ref 存储最新的 onRefresh 函数，避免依赖变化导致定时器重新创建
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled || !isVisible) {
      // 禁用或页面不可见时，清除定时器
      if (intervalRef.current) {
        console.log('[useAutoRefresh] 禁用或页面不可见，清除定时器')
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // 立即执行一次（如果需要）
    if (immediate) {
      const executeRefresh = async () => {
        if (isRefreshingRef.current) {
          console.log('[useAutoRefresh] 上次刷新未完成，跳过立即刷新')
          return
        }
        isRefreshingRef.current = true
        try {
          console.log('[useAutoRefresh] 立即执行刷新')
          await onRefreshRef.current()
        } catch (err) {
          console.error('[useAutoRefresh] 立即刷新失败:', err)
        } finally {
          isRefreshingRef.current = false
        }
      }
      // 延迟一点执行，避免与useEffect中的loadMetrics冲突
      const timeoutId = setTimeout(executeRefresh, 500)
      return () => clearTimeout(timeoutId)
    }

    // 设置定时器
    console.log(`[useAutoRefresh] 启动轮询，间隔: ${interval}ms, enabled: ${enabled}, visible: ${isVisible}`)
    intervalRef.current = setInterval(async () => {
      if (isRefreshingRef.current) {
        console.log('[useAutoRefresh] 上次刷新未完成，跳过本次刷新')
        return
      }
      isRefreshingRef.current = true
      try {
        console.log(`[useAutoRefresh] 执行定时刷新 (间隔: ${interval}ms)`)
        await onRefreshRef.current()
      } catch (err) {
        console.error('[useAutoRefresh] 定时刷新失败:', err)
      } finally {
        isRefreshingRef.current = false
      }
    }, interval)

    // 清理函数
    return () => {
      if (intervalRef.current) {
        console.log('[useAutoRefresh] 清理定时器')
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isVisible, interval, immediate]) // 移除 onRefresh 依赖，使用 ref 存储

  // 手动刷新函数
  const refresh = async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      await onRefresh()
    } catch (err) {
      console.error('[useAutoRefresh] 手动刷新失败:', err)
      throw err
    } finally {
      isRefreshingRef.current = false
    }
  }

  return { refresh }
}
