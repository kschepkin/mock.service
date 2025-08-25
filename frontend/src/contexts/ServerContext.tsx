import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ServerAPI, ServerInfo } from '../api/serverApi'
import { ApiConfig } from '../utils/apiConfig'

interface ServerContextType {
  serverInfo: ServerInfo | null
  loading: boolean
  error: string | null
  refreshServerInfo: () => Promise<void>
  currentApiUrl: string
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
  const [currentApiUrl, setCurrentApiUrl] = useState<string>(ApiConfig.getBaseUrl())

  const fetchServerInfo = async () => {
    try {
      setLoading(true)
      setError(null)
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

  useEffect(() => {
    fetchServerInfo()
    
    // Слушаем изменения настроек API
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mockService_apiSettings') {
        const newUrl = ApiConfig.getBaseUrl()
        setCurrentApiUrl(newUrl)
        // Перезагружаем информацию о сервере с новыми настройками
        fetchServerInfo()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: ServerContextType = {
    serverInfo,
    loading,
    error,
    refreshServerInfo,
    currentApiUrl
  }

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  )
} 