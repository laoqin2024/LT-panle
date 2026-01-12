import { useState } from 'react'
import { Key, ChevronDown, Check, Eye, EyeOff, Copy } from 'lucide-react'

interface Credential {
  id: number
  username: string
  description?: string
  credentialType: 'password' | 'ssh_key'
}

interface CredentialSelectorProps {
  credentials: Credential[]
  selectedId?: number
  onSelect: (credentialId: number) => void
  onUse?: (credentialId: number) => void
  showPassword?: boolean
}

export default function CredentialSelector({
  credentials,
  selectedId,
  onSelect,
  onUse,
  showPassword = false,
}: CredentialSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState<number | null>(null)

  const selectedCredential = credentials.find((c) => c.id === selectedId)

  const handleSelect = (credId: number) => {
    onSelect(credId)
    setIsOpen(false)
  }

  const handleUse = (credId: number) => {
    if (onUse) {
      onUse(credId)
    }
    setIsOpen(false)
  }

  const togglePasswordVisibility = (credId: number) => {
    setRevealedPassword(revealedPassword === credId ? null : credId)
  }

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password)
  }

  return (
    <div className="relative">
      {/* 选择器按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            {selectedCredential
              ? `${selectedCredential.username}${selectedCredential.description ? ` - ${selectedCredential.description}` : ''}`
              : '选择凭据'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
            {credentials.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                暂无可用凭据
              </div>
            ) : (
              <div className="py-1">
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1"
                        onClick={() => handleSelect(cred.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {cred.username}
                          </span>
                          {selectedId === cred.id && (
                            <Check className="w-4 h-4 text-primary-600" />
                          )}
                        </div>
                        {cred.description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {cred.description}
                          </p>
                        )}
                        <span className="text-xs text-gray-400 mt-1 inline-block">
                          {cred.credentialType === 'password' ? '密码' : 'SSH密钥'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {showPassword && cred.credentialType === 'password' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePasswordVisibility(cred.id)
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {revealedPassword === cred.id ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        )}
                        {onUse && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUse(cred.id)
                            }}
                            className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            使用
                          </button>
                        )}
                      </div>
                    </div>
                    {showPassword && revealedPassword === cred.id && (
                      <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-gray-100 rounded">
                        <span className="font-mono text-sm flex-1">••••••••</span>
                        <button
                          onClick={() => copyPassword('••••••••')}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Copy className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

