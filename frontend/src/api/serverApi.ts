const API_BASE_URL = '/api'

export interface ServerInfo {
  base_url: string
  mock_base_url: string
  api_base_url: string
  version: string
  environment: string
}

export class ServerAPI {
  private static baseUrl = `${API_BASE_URL}/server`

  static async getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${this.baseUrl}/info`)

    if (!response.ok) {
      throw new Error('Не удалось получить информацию о сервере')
    }

    return response.json()
  }
} 