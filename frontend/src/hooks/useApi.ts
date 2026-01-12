import { useState, useEffect } from 'react'
import api from '../services/api'

interface UseApiOptions {
  immediate?: boolean
}

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  execute: (...args: any[]) => Promise<T>
  reset: () => void
}

export function useApi<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseApiOptions = { immediate: false }
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = async (...args: any[]): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFunction(...args)
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('未知错误')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setData(null)
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (options.immediate) {
      execute()
    }
  }, [])

  return { data, loading, error, execute, reset }
}

