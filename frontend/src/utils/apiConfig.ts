interface ApiSettings {
  domain: string
  port?: string
  protocol: 'http' | 'https'
}

const DEFAULT_SETTINGS: ApiSettings = {
  domain: 'localhost',
  port: '8080',
  protocol: 'http'
}

export class ApiConfig {
  private static settings: ApiSettings | null = null

  /**
   * Получает настройки API из localStorage или использует значения по умолчанию
   */
  static getSettings(): ApiSettings {
    if (this.settings) {
      return this.settings
    }

    try {
      const savedSettings = localStorage.getItem('mockService_apiSettings')
      if (savedSettings) {
        this.settings = JSON.parse(savedSettings)
        return this.settings
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек API:', error)
    }

    this.settings = DEFAULT_SETTINGS
    return this.settings
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
   * Возвращает URL для API эндпоинтов
   */
  static getApiUrl(): string {
    return `${this.getBaseUrl()}/api`
  }

  /**
   * Сохраняет настройки API
   */
  static saveSettings(settings: ApiSettings): void {
    localStorage.setItem('mockService_apiSettings', JSON.stringify(settings))
    this.settings = settings
  }

  /**
   * Сбрасывает кэш настроек (полезно после изменения настроек)
   */
  static clearCache(): void {
    this.settings = null
  }

  /**
   * Проверяет, используются ли настройки по умолчанию
   */
  static isUsingDefaults(): boolean {
    const current = this.getSettings()
    return current.domain === DEFAULT_SETTINGS.domain &&
           current.port === DEFAULT_SETTINGS.port &&
           current.protocol === DEFAULT_SETTINGS.protocol
  }

  /**
   * Возвращает настройки по умолчанию
   */
  static getDefaults(): ApiSettings {
    return { ...DEFAULT_SETTINGS }
  }
}

export type { ApiSettings }