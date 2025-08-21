import React, { useState, useEffect, useRef } from 'react'
import { Card, List, Tag, Button, Space, Badge, Typography, Collapse, Switch, Select, Input, DatePicker, Tooltip } from 'antd'
import { ReloadOutlined, DeleteOutlined, SearchOutlined, CalendarOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { useParams } from 'react-router-dom'
import { RequestLog, MockService } from '@/types'
import { MockServiceAPI, LogWebSocketClient } from '@/api/mockService'

const { Text } = Typography
const { Panel } = Collapse

const LogsPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>()
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [services, setServices] = useState<MockService[]>([])
  const [loading, setLoading] = useState(false)
  const [realtime, setRealtime] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [selectedService, setSelectedService] = useState<number | undefined>(
    serviceId ? parseInt(serviceId) : undefined
  )
  const [wsConnected, setWsConnected] = useState(false)
  const wsClient = useRef<LogWebSocketClient | null>(null)

  useEffect(() => {
    loadServices()
    // Загружаем логи при первой загрузке страницы
    loadLogs()
  }, [selectedService])

  useEffect(() => {
    if (realtime) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [realtime, selectedService])

  // Отдельный useEffect для загрузки логов при изменении сервиса в статичном режиме
  useEffect(() => {
    if (!realtime && selectedService !== undefined) {
      // В статичном режиме загружаем логи при изменении сервиса
      loadLogs()
    }
  }, [selectedService, realtime])



  const loadServices = async () => {
    try {
      const data = await MockServiceAPI.getMockServices()
      setServices(data)
    } catch (error) {
      console.error('Ошибка загрузки сервисов:', error)
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = selectedService
        ? await MockServiceAPI.getServiceLogs(selectedService)
        : await MockServiceAPI.getAllLogs()
      setLogs(data)
    } catch (error) {
      console.error('Ошибка загрузки логов:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    if (wsClient.current) {
      wsClient.current.disconnect()
    }

    wsClient.current = new LogWebSocketClient(
      (newLog: RequestLog) => {
        // Добавляем новый лог только в режиме реального времени
        // Дополнительная проверка для безопасности
        if (realtime && wsClient.current) {
          setLogs(prev => [newLog, ...prev])
        }
      },
      (error) => {
        console.error('WebSocket ошибка:', error)
        setWsConnected(false)
      }
    )

    wsClient.current.connect(selectedService)
    setWsConnected(true)

    // Ping каждые 30 секунд для поддержания соединения
    const pingInterval = setInterval(() => {
      wsClient.current?.sendPing()
    }, 30000)

    return () => clearInterval(pingInterval)
  }

  const disconnectWebSocket = () => {
    if (wsClient.current) {
      wsClient.current.disconnect()
      wsClient.current = null
    }
    setWsConnected(false)
  }

  const handleRealtimeToggle = (checked: boolean) => {
    setRealtime(checked)
    
    if (checked) {
      // Включаем режим реального времени
      connectWebSocket()
    } else {
      // Отключаем режим реального времени и загружаем текущие логи
      disconnectWebSocket()
      // Небольшая задержка перед загрузкой логов, чтобы WebSocket успел отключиться
      setTimeout(() => {
        loadLogs()
      }, 100)
    }
  }

  const getStatusColor = (status?: number) => {
    if (!status) return 'default'
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'processing'
    if (status >= 400 && status < 500) return 'warning'
    if (status >= 500) return 'error'
    return 'default'
  }

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'green'
      case 'POST': return 'blue'
      case 'PUT': return 'orange'
      case 'DELETE': return 'red'
      case 'PATCH': return 'purple'
      default: return 'default'
    }
  }

  const formatJson = (jsonString?: string) => {
    if (!jsonString) return null
    
    try {
      const parsed = JSON.parse(jsonString)
      return (
        <pre style={{ 
          fontSize: '12px', 
          margin: 0, 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#f5f5f5',
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      return (
        <pre style={{ 
          fontSize: '12px', 
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#f5f5f5',
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          {jsonString}
        </pre>
      )
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  // Фильтрация логов по поисковому запросу и времени
  const filteredLogs = logs.filter(log => {
    // Фильтр по тексту
    if (searchText) {
      const searchLower = searchText.toLowerCase()
      const textMatch = (
        log.path.toLowerCase().includes(searchLower) ||
        log.method.toLowerCase().includes(searchLower) ||
        log.mock_service_name?.toLowerCase().includes(searchLower) ||
        (log.response_status && log.response_status.toString().includes(searchText)) ||
        (log.body && log.body.toLowerCase().includes(searchLower)) ||
        (log.response_body && log.response_body.toLowerCase().includes(searchLower)) ||
        // Поиск по прокси информации
        (log.proxy_info?.target_url && log.proxy_info.target_url.toLowerCase().includes(searchLower)) ||
        (log.proxy_info?.proxy_error && log.proxy_info.proxy_error.toLowerCase().includes(searchLower)) ||
        (searchLower === 'прокси' && log.proxy_info) ||
        (searchLower === 'proxy' && log.proxy_info)
      )
      if (!textMatch) return false
    }
    
    // Фильтр по времени
    if (dateRange && dateRange[0] && dateRange[1]) {
      const logDate = new Date(log.timestamp)
      const startDate = dateRange[0].toDate()
      const endDate = dateRange[1].endOf('day').toDate() // Включаем конец дня
      
      if (logDate < startDate || logDate > endDate) {
        return false
      }
    }
    
    return true
  })

  return (
    <Card
      title="Логи запросов"
      extra={
        <Space wrap>
          <Input
            placeholder="Поиск в логах..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <DatePicker.RangePicker
            placeholder={['Дата от', 'Дата до']}
            value={dateRange}
            onChange={setDateRange}
            style={{ width: 240 }}
            allowClear
            showTime={false}
            format="DD.MM.YYYY"
          />
          <Select
            style={{ width: 250 }}
            placeholder="Все сервисы"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            value={selectedService}
            onChange={setSelectedService}
          >
            {services.map(service => (
              <Select.Option key={service.id} value={service.id}>
                {service.name}
              </Select.Option>
            ))}
          </Select>
          <Tooltip title={
            realtime 
              ? "Отключить режим реального времени для просмотра статичного списка логов"
              : "Включить режим реального времени для автоматического обновления логов"
          }>
            <Switch
              checked={realtime}
              onChange={handleRealtimeToggle}
              checkedChildren="Реальное время"
              unCheckedChildren="Статичный"
            />
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
            Обновить
          </Button>
          <Button icon={<DeleteOutlined />} onClick={clearLogs}>
            Очистить
          </Button>
        </Space>
      }
    >
      <List
        dataSource={filteredLogs}
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total, range) => {
            const hasFilters = searchText || (dateRange && dateRange[0] && dateRange[1])
            if (hasFilters) {
              let filterInfo = 'найденных'
              if (searchText && dateRange && dateRange[0] && dateRange[1]) {
                filterInfo = 'найденных по тексту и времени'
              } else if (searchText) {
                filterInfo = 'найденных по тексту'
              } else if (dateRange && dateRange[0] && dateRange[1]) {
                filterInfo = 'найденных за период'
              }
              return `${range[0]}-${range[1]} из ${total} ${filterInfo} (всего ${logs.length})`
            }
            return `${range[0]}-${range[1]} из ${total}`
          },
        }}
        renderItem={(log) => (
          <List.Item className={`log-entry ${getStatusColor(log.response_status)}`}>
            <div style={{ width: '100%' }}>
              {/* Заголовок лога */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Space>
                  <Tag color={getMethodColor(log.method)} className="method-tag">
                    {log.method}
                  </Tag>
                  <Text strong>{log.path}</Text>
                  {log.mock_service_name && (
                    <Tag color="blue">{log.mock_service_name}</Tag>
                  )}
                  {log.proxy_info && (
                    <Tag color="green" icon={<span>🔗</span>}>
                      Прокси
                    </Tag>
                  )}
                </Space>
                <Space>
                  <Tag color={getStatusColor(log.response_status)}>
                    {log.response_status || 'N/A'}
                  </Tag>
                  <Text type="secondary">
                    {new Date(log.timestamp).toLocaleString()}
                  </Text>
                  {log.processing_time && (
                    <Text type="secondary">
                      {log.processing_time.toFixed(2)}ms
                    </Text>
                  )}
                  {log.proxy_info && log.proxy_info.proxy_time && (
                    <Text type="secondary" style={{ color: '#52c41a' }}>
                      +{log.proxy_info.proxy_time}s
                    </Text>
                  )}
                </Space>
              </div>

              {/* Детали лога */}
              <Collapse ghost>
                <Panel header="Детали запроса" key="details">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Запрос */}
                    <div>
                      <h4>Запрос</h4>
                      {log.query_params && Object.keys(log.query_params).length > 0 && (
                        <div>
                          <Text strong>Query параметры:</Text>
                          <div className="json-container">
                            {formatJson(JSON.stringify(log.query_params))}
                          </div>
                        </div>
                      )}
                      
                      {log.headers && (
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Заголовки:</Text>
                          <div className="json-container">
                            {formatJson(JSON.stringify(log.headers))}
                          </div>
                        </div>
                      )}
                      
                      {log.body && (
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Тело запроса:</Text>
                          <div className="json-container">
                            {formatJson(log.body)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ответ */}
                    <div>
                      <h4>Ответ</h4>
                      {log.response_headers && (
                        <div>
                          <Text strong>Заголовки ответа:</Text>
                          <div className="json-container">
                            {formatJson(JSON.stringify(log.response_headers))}
                          </div>
                        </div>
                      )}
                      
                      {log.response_body && (
                        <div style={{ marginTop: 8 }}>
                          <Text strong>Тело ответа:</Text>
                          <div className="json-container">
                            {formatJson(log.response_body)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Информация о проксировании */}
                  {log.proxy_info && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                      <h4 style={{ color: '#1890ff' }}>
                        🔗 Информация о проксировании
                        {log.proxy_info.proxy_error && (
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            Ошибка
                          </Tag>
                        )}
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Целевой сервис */}
                        <div>
                          <Text strong>Целевой URL:</Text>
                          <div style={{ 
                            backgroundColor: '#f6f8fa', 
                            padding: '8px 12px', 
                            borderRadius: '4px', 
                            marginTop: '4px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            wordBreak: 'break-all'
                          }}>
                            {log.proxy_info.target_url}
                          </div>
                          
                          {log.proxy_info.proxy_time && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong>Время проксирования:</Text>
                              <Text style={{ marginLeft: 8, color: '#52c41a' }}>
                                {log.proxy_info.proxy_time} сек
                              </Text>
                            </div>
                          )}
                          
                          {log.proxy_info.proxy_error && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong style={{ color: '#ff4d4f' }}>Ошибка:</Text>
                              <div style={{ 
                                backgroundColor: '#fff2f0', 
                                padding: '8px 12px', 
                                borderRadius: '4px', 
                                marginTop: '4px',
                                border: '1px solid #ffccc7',
                                color: '#cf1322'
                              }}>
                                {log.proxy_info.proxy_error}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Заголовки проксирования */}
                        <div>
                          {log.proxy_info.proxy_headers && Object.keys(log.proxy_info.proxy_headers).length > 0 && (
                            <div>
                              <Text strong>Заголовки проксирования:</Text>
                              <div className="json-container">
                                {formatJson(JSON.stringify(log.proxy_info.proxy_headers))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Ответ внешнего сервиса */}
                      {log.proxy_info.proxy_response_status && (
                        <div style={{ marginTop: 16 }}>
                          <h5 style={{ color: '#52c41a' }}>📡 Ответ внешнего сервиса</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                              <Text strong>Статус:</Text>
                              <Tag 
                                color={getStatusColor(log.proxy_info.proxy_response_status)} 
                                style={{ marginLeft: 8 }}
                              >
                                {log.proxy_info.proxy_response_status}
                              </Tag>
                            </div>
                            
                            {log.proxy_info.proxy_response_headers && Object.keys(log.proxy_info.proxy_response_headers).length > 0 && (
                              <div>
                                <Text strong>Заголовки ответа:</Text>
                                <div className="json-container">
                                  {formatJson(JSON.stringify(log.proxy_info.proxy_response_headers))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {log.proxy_info.proxy_response_body && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong>Тело ответа:</Text>
                              <div className="json-container">
                                {formatJson(log.proxy_info.proxy_response_body)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Panel>
              </Collapse>
            </div>
          </List.Item>
        )}
      />
    </Card>
  )
}

export default LogsPage 