import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">出现错误</h2>
            </div>
            <p className="text-gray-600 mb-4 whitespace-pre-wrap break-words">
              {this.state.error?.message 
                ? String(this.state.error.message)
                : '发生了未知错误'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                刷新页面
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn-secondary"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

