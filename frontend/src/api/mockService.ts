import axios from 'axios'
import { MockService, MockServiceCreate, RequestLog } from '@/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export class MockServiceAPI {
  // Управление mock сервисами
  static async getMockServices(): Promise<MockService[]> {
    const response = await api.get('/mock-services/')
    return response.data
  }

  static async getMockService(id: number): Promise<MockService> {
    const response = await api.get(`/mock-services/${id}`)
    return response.data
  }

  static async createMockService(data: MockServiceCreate): Promise<MockService> {
    const response = await api.post('/mock-services/', data)
    return response.data
  }

  static async updateMockService(id: number, data: Partial<MockServiceCreate>): Promise<MockService> {
    const response = await api.put(`/mock-services/${id}`, data)
    return response.data
  }

  static async deleteMockService(id: number): Promise<void> {
    await api.delete(`/mock-services/${id}`)
  }

  // Логи
  static async getAllLogs(skip = 0, limit = 100): Promise<RequestLog[]> {
    const response = await api.get('/mock-services/logs/all', {
      params: { skip, limit }
    })
    return response.data
  }

  static async getServiceLogs(serviceId: number, skip = 0, limit = 100): Promise<RequestLog[]> {
    const response = await api.get(`/mock-services/${serviceId}/logs`, {
      params: { skip, limit }
    })
    return response.data
  }
}

// WebSocket клиент для логов
export class LogWebSocketClient {
  private ws: WebSocket | null = null
  private onMessage: (log: RequestLog) => void
  private onError: (error: Event) => void
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private shouldReconnect = true

  constructor(
    onMessage: (log: RequestLog) => void,
    onError: (error: Event) => void = () => {}
  ) {
    this.onMessage = onMessage
    this.onError = onError
  }

  connect(serviceId?: number) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = serviceId 
      ? `${protocol}//${window.location.host}/ws/logs/${serviceId}`
      : `${protocol}//${window.location.host}/ws/logs`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('WebSocket подключен')
        this.reconnectAttempts = 0
        this.shouldReconnect = true
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'log') {
            this.onMessage(message.data)
          }
        } catch (error) {
          console.error('Ошибка парсинга WebSocket сообщения:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket соединение закрыто')
        this.attemptReconnect(serviceId)
      }

      this.ws.onerror = (error) => {
        console.error('Ошибка WebSocket:', error)
        this.onError(error)
      }
    } catch (error) {
      console.error('Ошибка создания WebSocket:', error)
    }
  }

  private attemptReconnect(serviceId?: number) {
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      setTimeout(() => {
        this.connect(serviceId)
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('ping')
    }
  }
} 