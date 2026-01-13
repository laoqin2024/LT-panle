import { useEffect, useState } from 'react'

/**
 * 页面可见性检测Hook
 * 
 * 用于检测页面是否可见，优化资源使用：
 * - 页面不可见时暂停轮询
 * - 页面可见时恢复轮询
 * - 节省服务器资源和电池电量
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}
