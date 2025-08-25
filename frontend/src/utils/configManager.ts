export interface ApiSettings {
  domain: string
  port?: string
  protocol: 'http' | 'https'
}

const DEFAULT_SETTINGS: ApiSettings = {
  domain: 'localhost',
  port: '8080',
  protocol: 'http'
}

export class ConfigManager {
  private static CONFIG_FILE_URL = '/config/api-settings.json'

  /**
   * Загружает настройки из файла volume или возвращает defaults
   */
  static async loadSettings(): Promise<ApiSettings> {
    try {
      const fileSettings = await this.loadFromFile()
      if (fileSettings) {
        return fileSettings
      }
    } catch (error) {
      console.debug('Config file not found, using defaults')
    }

    return DEFAULT_SETTINGS
  }

  /**
   * Сохраняет настройки в файл volume через специальный механизм
   */
  static async saveSettings(settings: ApiSettings): Promise<void> {
    try {
      await this.saveToFile(settings)
      console.log('Settings saved to volume file')
    } catch (error) {
      console.error('Could not save settings to volume file:', error)
      throw new Error('Не удалось сохранить настройки в файл контейнера')
    }
  }

  /**
   * Сбрасывает настройки к умолчанию
   */
  static async resetSettings(): Promise<ApiSettings> {
    try {
      await this.saveToFile(DEFAULT_SETTINGS)
      console.log('Settings reset to defaults')
    } catch (error) {
      console.warn('Could not reset volume file:', error)
      throw new Error('Не удалось сбросить настройки в файле контейнера')
    }

    return DEFAULT_SETTINGS
  }


  /**
   * Загружает настройки из файла volume
   */
  private static async loadFromFile(): Promise<ApiSettings | null> {
    const response = await fetch(this.CONFIG_FILE_URL, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    if (response.ok) {
      const settings = await response.json()
      // Валидируем структуру
      if (settings && typeof settings.domain === 'string' && typeof settings.protocol === 'string') {
        return settings
      }
    }

    return null
  }

  /**
   * Сохраняет настройки в файл volume через POST запрос к nginx
   * Используем специальный механизм для записи файла
   */
  private static async saveToFile(settings: ApiSettings): Promise<void> {
    const configData = JSON.stringify(settings, null, 2)
    
    // Отправляем POST запрос с данными конфигурации
    // Nginx должен будет обработать этот запрос и записать файл
    const response = await fetch('/config/api-settings.json', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Config-Write': 'true'
      },
      body: configData
    })

    if (!response.ok) {
      throw new Error('Failed to save configuration file')
    }
  }

  /**
   * Экспорт настроек в файл (для пользователя)
   */
  static exportSettings(settings: ApiSettings): void {
    const configData = JSON.stringify(settings, null, 2)
    const blob = new Blob([configData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = 'mock-service-config.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }

  /**
   * Импорт настроек из файла (от пользователя)
   */
  static importSettings(): Promise<ApiSettings> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('No file selected'))
          return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const settings = JSON.parse(e.target?.result as string)
            if (this.validateSettings(settings)) {
              resolve(settings)
            } else {
              reject(new Error('Invalid configuration format'))
            }
          } catch (error) {
            reject(new Error('Invalid JSON file'))
          }
        }
        reader.readAsText(file)
      }

      input.click()
    })
  }

  /**
   * Валидация настроек
   */
  private static validateSettings(settings: any): settings is ApiSettings {
    return settings &&
           typeof settings.domain === 'string' &&
           typeof settings.protocol === 'string' &&
           ['http', 'https'].includes(settings.protocol) &&
           (!settings.port || typeof settings.port === 'string')
  }
}