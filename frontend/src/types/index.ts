export interface MockService {
  id: number
  name: string
  path: string
  methods: string[]
  strategy: 'proxy' | 'static' | 'conditional'
  service_type: 'rest' | 'soap'
  is_active: boolean
  
  // Proxy настройки
  proxy_url?: string
  proxy_delay: number
  
  // Static настройки
  static_response?: string
  static_status_code: number
  static_headers?: Record<string, string>
  static_delay: number
  
  // Conditional настройки
  condition_code?: string
  conditional_responses?: ConditionalResponse[]
  conditional_delay: number
  conditional_status_code: number
  conditional_headers?: Record<string, string>
  
  created_at: string
  updated_at?: string
}

export interface ConditionalResponse {
  condition: string
  response_type: 'static' | 'proxy'
  response?: string
  proxy_url?: string
  status_code: number
  headers?: Record<string, string>
  delay: number
}

export interface MockServiceCreate {
  name: string
  path: string
  methods: string[]
  strategy: 'proxy' | 'static' | 'conditional'
  service_type?: 'rest' | 'soap'
  is_active: boolean
  
  proxy_url?: string
  proxy_delay?: number
  static_response?: string
  static_status_code?: number
  static_headers?: Record<string, string>
  static_delay?: number
  condition_code?: string
  conditional_responses?: ConditionalResponse[]
  conditional_delay?: number
  conditional_status_code?: number
  conditional_headers?: Record<string, string>
}

export interface ProxyInfo {
  target_url: string
  proxy_headers: Record<string, string>
  proxy_response_status?: number
  proxy_response_headers: Record<string, string>
  proxy_response_body?: string
  proxy_time: number
  proxy_error?: string
}

export interface RequestLog {
  id: string
  mock_service_id?: number
  mock_service_name?: string
  path: string
  method: string
  headers?: Record<string, any>
  query_params?: Record<string, any>
  body?: string
  response_status?: number
  response_body?: string
  response_headers?: Record<string, string>
  processing_time?: number
  timestamp: string
  proxy_info?: ProxyInfo
}

export interface LogMessage {
  type: 'log'
  data: RequestLog
  timestamp: string
} 