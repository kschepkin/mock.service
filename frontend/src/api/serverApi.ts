import { ApiConfig } from '@/utils/apiConfig'

export interface ServerInfo {
  base_url: string
  mock_base_url: string
  api_base_url: string
  version: string
  environment: string
}

export class ServerAPI {
  static async getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${ApiConfig.getApiUrl()}/server/info`)

    if (!response.ok) {
      throw new Error('Не удалось получить информацию о сервере')
    }

    return response.json()
  }
} 