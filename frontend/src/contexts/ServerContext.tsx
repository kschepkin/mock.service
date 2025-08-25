import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ServerAPI, ServerInfo } from '../api/serverApi'
import { ApiConfig } from '../utils/apiConfig'

interface ServerContextType {
  serverInfo: ServerInfo | null
  loading: boolean
  error: string | null
  refreshServerInfo: () => Promise<void>
  currentApiUrl: string
  updateApiSettings: () => void
}

const ServerContext = createContext<ServerContextType | undefined>(undefined)

export const useServerInfo = () => {
  const context = useContext(ServerContext)
  if (context === undefined) {
    throw new Error('useServerInfo must be used within a ServerProvider')
  }
  return context
}

interface ServerProviderProps {
  children: ReactNode
}

export const ServerProvider: React.FC<ServerProviderProps> = ({ children }) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentApiUrl, setCurrentApiUrl] = useState<string>('')

  const fetchServerInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Обновляем currentApiUrl каждый раз при запросе
      const newUrl = ApiConfig.getBaseUrl()
      setCurrentApiUrl(newUrl)
      
      const info = await ServerAPI.getServerInfo()
      setServerInfo(info)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки информации о сервере')
      console.error('Ошибка загрузки server info:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshServerInfo = async () => {
    await fetchServerInfo()
  }

  const updateApiSettings = () => {
    // Принудительно обновляем настройки и перезагружаем server info
    const newUrl = ApiConfig.getBaseUrl()
    setCurrentApiUrl(newUrl)
    fetchServerInfo()
  }

  useEffect(() => {
    // Инициализируем currentApiUrl с актуальными настройками
    setCurrentApiUrl(ApiConfig.getBaseUrl())
    fetchServerInfo()
  }, [])

  const value: ServerContextType = {
    serverInfo,
    loading,
    error,
    refreshServerInfo,
    currentApiUrl,
    updateApiSettings
  }

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  )
} 