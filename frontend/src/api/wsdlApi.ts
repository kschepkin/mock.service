export interface WSDLOperation {
  name: string
  soap_action: string
  input_message: string
  output_message: string
  input_elements: Array<{
    name: string
    element: string
    type: string
    required: boolean
  }>
  output_elements: Array<{
    name: string
    element: string
    type: string
    required: boolean
  }>
  endpoint_url: string
}

export interface WSDLParseResult {
  service_name: string
  target_namespace: string
  soap_address: string
  operations: WSDLOperation[]
  errors: string[]
  warnings: string[]
}

export interface WSDLImportRequest {
  wsdl_url: string
  base_path: string
  service_prefix: string
}

export interface MockServicePreview {
  name: string
  path: string
  methods: string[]
  operation_name: string
  soap_action: string
  sample_request: string
  sample_response: string
  proxy_url: string
}

export interface WSDLImportResult {
  id?: number
  name?: string
  path?: string
  operation_name: string
  soap_action: string
  status: 'created' | 'failed'
  error?: string
}

export interface WSDLTestUrl {
  name: string
  url: string
  description: string
}

export interface WSDLTestUrlsResponse {
  test_urls: WSDLTestUrl[]
  note: string
}

export class WSDLApi {
  private baseUrl: string

  constructor(baseUrl: string = '/api/wsdl') {
    this.baseUrl = baseUrl
  }

  /**
   * Парсит WSDL документ по URL
   */
  async parseWSDL(wsdlUrl: string): Promise<WSDLParseResult> {
    const response = await fetch(`${this.baseUrl}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wsdl_url: wsdlUrl
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Предварительный просмотр mock сервисов
   */
  async previewImport(request: WSDLImportRequest): Promise<MockServicePreview[]> {
    const response = await fetch(`${this.baseUrl}/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Импорт WSDL как mock сервисы
   */
  async importWSDL(request: WSDLImportRequest): Promise<WSDLImportResult[]> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Получить тестовые WSDL URLs
   */
  async getTestUrls(): Promise<WSDLTestUrlsResponse> {
    const response = await fetch(`${this.baseUrl}/test-urls`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}

export const WSDLApiInstance = new WSDLApi() 