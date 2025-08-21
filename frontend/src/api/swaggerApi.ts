const API_BASE_URL = '/api'

export interface SwaggerEndpoint {
  path: string
  method: string
  summary?: string
  description?: string
  parameters: Array<{
    name: string
    in: string
    required: boolean
    type: string
    description: string
  }>
  responses: Record<string, {
    description: string
    schema?: any
    example?: any
  }>
  request_body?: {
    description: string
    required: boolean
    schema?: any
  }
}

export interface SwaggerImportResult {
  title: string
  version: string
  base_url?: string
  endpoints: SwaggerEndpoint[]
  errors: string[]
  warnings: string[]
}

export interface MockServicePreview {
  name: string
  description: string
  path: string
  method: string
  strategy: string
  static_response: string
  static_headers: Record<string, string>
  delay_ms: number
}

export class SwaggerAPI {
  private static baseUrl = `${API_BASE_URL}/swagger`

  static async parseSwaggerFile(
    file: File,
    contentType?: string
  ): Promise<SwaggerImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (contentType) {
      formData.append('content_type', contentType)
    }

    const response = await fetch(`${this.baseUrl}/parse`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка парсинга файла')
    }

    return response.json()
  }

  static async parseSwaggerContent(
    content: string,
    contentType: string = 'json'
  ): Promise<SwaggerImportResult> {
    const response = await fetch(`${this.baseUrl}/parse-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        content_type: contentType
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка парсинга контента')
    }

    return response.json()
  }

  static async previewSwaggerImport(
    file: File,
    basePath: string = '/api',
    contentType?: string
  ): Promise<MockServicePreview[]> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('base_path', basePath)
    
    if (contentType) {
      formData.append('content_type', contentType)
    }

    const response = await fetch(`${this.baseUrl}/preview`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка предварительного просмотра')
    }

    return response.json()
  }

  static async previewSwaggerContentImport(
    content: string,
    basePath: string = '/api',
    contentType: string = 'json'
  ): Promise<MockServicePreview[]> {
    const response = await fetch(`${this.baseUrl}/preview-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        content_type: contentType,
        base_path: basePath
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка предварительного просмотра')
    }

    return response.json()
  }

  static async importSwaggerFile(
    file: File,
    basePath: string = '/api',
    contentType?: string
  ): Promise<any[]> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('base_path', basePath)
    
    if (contentType) {
      formData.append('content_type', contentType)
    }

    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка импорта')
    }

    return response.json()
  }

  static async importSwaggerContent(
    content: string,
    basePath: string = '/api',
    contentType: string = 'json'
  ): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/import-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        content_type: contentType,
        base_path: basePath
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Ошибка импорта')
    }

    return response.json()
  }
} 