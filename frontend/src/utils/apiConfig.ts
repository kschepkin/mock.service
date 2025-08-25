import { ConfigManager, ApiSettings } from './configManager'

export class ApiConfig {
  private static settings: ApiSettings | null = null
  private static isInitialized = false

  /**
   * Инициализация настроек
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.settings = await ConfigManager.loadSettings()
      this.isInitialized = true
    } catch (error) {
      console.error('Error initializing API config:', error)
      this.settings = {
        domain: 'localhost',
        port: '8080',
        protocol: 'http',
        basePath: ''
      }
      this.isInitialized = true
    }
  }

  /**
   * Получает настройки API (синхронно, после инициализации)
   */
  static getSettings(): ApiSettings {
    if (!this.isInitialized || !this.settings) {
      // Fallback если не инициализировано
      return {
        domain: 'localhost',
        port: '8080',
        protocol: 'http',
        basePath: ''
      }
    }

    return this.settings
  }

  /**
   * Проверяет, инициализирован ли ApiConfig
   */
  static isReady(): boolean {
    return this.isInitialized && this.settings !== null
  }

  /**
   * Возвращает полный базовый URL для API
   */
  static getBaseUrl(): string {
    const settings = this.getSettings()
    const portPart = settings.port ? `:${settings.port}` : ''
    return `${settings.protocol}://${settings.domain}${portPart}`
  }

  /**
   * Возвращает базовый путь для mock сервисов
   */
  static getBasePath(): string {
    const settings = this.getSettings()
    const basePath = settings.basePath || ''
    return basePath.startsWith('/') ? basePath : (basePath ? `/${basePath}` : '')
  }

  /**
   * Возвращает полный URL с базовым путем для mock сервиса
   */
  static getMockServiceUrl(servicePath: string): string {
    const baseUrl = this.getBaseUrl()
    const basePath = this.getBasePath()
    const cleanServicePath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`
    return `${baseUrl}${basePath}${cleanServicePath}`
  }

  /**
   * Возвращает URL для API эндпоинтов
   */
  static getApiUrl(): string {
    return `${this.getBaseUrl()}/api`
  }

  /**
   * Сохраняет настройки API
   */
  static async saveSettings(settings: ApiSettings): Promise<void> {
    await ConfigManager.saveSettings(settings)
    this.settings = settings
  }

  /**
   * Сбрасывает кэш настроек (полезно после изменения настроек)
   */
  static clearCache(): void {
    this.settings = null
    this.isInitialized = false
  }

  /**
   * Сбрасывает настройки к умолчанию
   */
  static async resetSettings(): Promise<ApiSettings> {
    const defaults = await ConfigManager.resetSettings()
    this.settings = defaults
    return defaults
  }

  /**
   * Проверяет, используются ли настройки по умолчанию
   */
  static isUsingDefaults(): boolean {
    const current = this.getSettings()
    return current.domain === 'localhost' &&
           current.port === '8080' &&
           current.protocol === 'http'
  }

  /**
   * Возвращает настройки по умолчанию
   */
  static getDefaults(): ApiSettings {
    return {
      domain: 'localhost',
      port: '8080',
      protocol: 'http'
    }
  }
}

export type { ApiSettings }