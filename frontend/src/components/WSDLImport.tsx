import React, { useState, useEffect } from 'react'
import { 
  Card, Input, Button, Steps, notification, Alert, Table, 
  Typography, Space, Tag, Divider, Collapse, Row, Col,
  Select, Tooltip, Spin, Badge
} from 'antd'
import { 
  CloudDownloadOutlined, FileSearchOutlined, ImportOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined,
  InfoCircleOutlined, CopyOutlined, GlobalOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import MonacoEditor from '@monaco-editor/react'
import { WSDLApiInstance, WSDLParseResult, MockServicePreview, WSDLImportResult, WSDLTestUrl } from '@/api/wsdlApi'
import { useServerInfo } from '@/contexts/ServerContext'
import { copyWithNotification } from '@/utils/clipboard'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse
const { Step } = Steps
const { Option } = Select

interface WSDLImportProps {
  onImportComplete?: () => void
}

const WSDLImport: React.FC<WSDLImportProps> = ({ onImportComplete }) => {
  const navigate = useNavigate()
  const { serverInfo } = useServerInfo()

  // Основное состояние
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Шаг 1: Ввод URL и парсинг
  const [wsdlUrl, setWsdlUrl] = useState('')
  const [parseResult, setParseResult] = useState<WSDLParseResult | null>(null)
  const [testUrls, setTestUrls] = useState<WSDLTestUrl[]>([])

  // Шаг 2: Настройки импорта и предварительный просмотр
  const [basePath, setBasePath] = useState('/soap')
  const [servicePrefix, setServicePrefix] = useState('')
  const [previewData, setPreviewData] = useState<MockServicePreview[]>([])

  // Шаг 3: Результаты импорта
  const [importResults, setImportResults] = useState<WSDLImportResult[]>([])

  useEffect(() => {
    loadTestUrls()
  }, [])

  const loadTestUrls = async () => {
    try {
      const data = await WSDLApiInstance.getTestUrls()
      setTestUrls(data.test_urls)
    } catch (error) {
      console.error('Ошибка загрузки тестовых URLs:', error)
    }
  }

  const parseWSDL = async () => {
    if (!wsdlUrl.trim()) {
      notification.error({
        message: 'Ошибка',
        description: 'Введите URL WSDL документа'
      })
      return
    }

    setLoading(true)
    try {
      const result = await WSDLApiInstance.parseWSDL(wsdlUrl)
      setParseResult(result)

      if (result.errors.length > 0) {
        notification.warning({
          message: 'Парсинг завершен с ошибками',
          description: `Найдено ${result.operations.length} операций, но есть ${result.errors.length} ошибок`,
          duration: 8
        })
      } else {
        notification.success({
          message: 'WSDL успешно распарсен',
          description: `Найдено ${result.operations.length} SOAP операций`
        })
      }

      if (result.operations.length > 0) {
        setCurrentStep(1)
      }
    } catch (error: any) {
      notification.error({
        message: 'Ошибка парсинга WSDL',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const previewImport = async () => {
    if (!parseResult) return

    setLoading(true)
    try {
      const preview = await WSDLApiInstance.previewImport({
        wsdl_url: wsdlUrl,
        base_path: basePath,
        service_prefix: servicePrefix
      })

      setPreviewData(preview)
      setCurrentStep(2)

      notification.success({
        message: 'Предварительный просмотр готов',
        description: `Будет создано ${preview.length} mock сервисов`
      })
    } catch (error: any) {
      notification.error({
        message: 'Ошибка предварительного просмотра',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const importServices = async () => {
    if (!parseResult) return

    setLoading(true)
    try {
      const results = await WSDLApiInstance.importWSDL({
        wsdl_url: wsdlUrl,
        base_path: basePath,
        service_prefix: servicePrefix
      })

      setImportResults(results)

      const successCount = results.filter(r => r.status === 'created').length
      const failedCount = results.filter(r => r.status === 'failed').length

      if (failedCount === 0) {
        notification.success({
          message: 'Импорт завершен успешно',
          description: `Создано ${successCount} mock сервисов`
        })
      } else {
        notification.warning({
          message: 'Импорт завершен частично',
          description: `Создано: ${successCount}, ошибок: ${failedCount}`
        })
      }

      setCurrentStep(3)

      if (onImportComplete) {
        onImportComplete()
      }
    } catch (error: any) {
      notification.error({
        message: 'Ошибка импорта',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const resetImport = () => {
    setCurrentStep(0)
    setWsdlUrl('')
    setParseResult(null)
    setPreviewData([])
    setImportResults([])
    setBasePath('/soap')
    setServicePrefix('')
  }

  const getFullUrl = (path: string) => {
    if (!serverInfo?.base_url) return path
    return `${serverInfo.base_url}${path}`
  }

  const copyToClipboard = (text: string) => {
    copyWithNotification(text, 'URL скопирован в буфер обмена')
  }

  const operationsColumns = [
    {
      title: 'Операция',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space direction="vertical" size="small">
          <Text strong>{name}</Text>
          {record.soap_action && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              SOAPAction: {record.soap_action}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Входные параметры',
      dataIndex: 'input_elements',
      key: 'input_elements',
      render: (elements: any[]) => (
        <Space wrap>
          {elements.length > 0 ? elements.map((elem, i) => (
            <Tag key={i} color="blue" style={{ fontSize: '11px' }}>
              {elem.name}: {elem.type}
            </Tag>
          )) : <Text type="secondary">Нет</Text>}
        </Space>
      )
    },
    {
      title: 'Выходные параметры',
      dataIndex: 'output_elements',
      key: 'output_elements',
      render: (elements: any[]) => (
        <Space wrap>
          {elements.length > 0 ? elements.map((elem, i) => (
            <Tag key={i} color="green" style={{ fontSize: '11px' }}>
              {elem.name}: {elem.type}
            </Tag>
          )) : <Text type="secondary">Нет</Text>}
        </Space>
      )
    }
  ]

  const previewColumns = [
    {
      title: 'Mock Сервис',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: MockServicePreview) => (
        <Space direction="vertical" size="small">
          <Text strong>{name}</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text code style={{ fontSize: '12px' }}>{getFullUrl(record.path)}</Text>
            <Button 
              type="text" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(getFullUrl(record.path))}
            />
          </div>
          <Space size="small">
            {record.methods.map(method => (
              <Tag key={method} color="blue">{method}</Tag>
            ))}
          </Space>
        </Space>
      )
    },
    {
      title: 'SOAP Операция',
      dataIndex: 'operation_name',
      key: 'operation_name',
      render: (name: string, record: MockServicePreview) => (
        <Space direction="vertical" size="small">
          <Text>{name}</Text>
          {record.soap_action && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.soap_action}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Проксирование',
      key: 'proxy',
      render: (record: MockServicePreview) => (
        <Space direction="vertical" size="small">
          <Tag color="green">Проксирование</Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.proxy_url}
          </Text>
        </Space>
      )
    },
    {
      title: 'Примеры',
      key: 'examples',
      render: (record: MockServicePreview) => (
        <Collapse ghost size="small">
          <Panel header="Показать примеры" key="examples">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Запрос:</Text>
                <div style={{ marginTop: 4 }}>
                  <MonacoEditor
                    height="150px"
                    language="xml"
                    theme="vs"
                    value={record.sample_request}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
              <div>
                <Text strong>Ответ:</Text>
                <div style={{ marginTop: 4 }}>
                  <MonacoEditor
                    height="150px"
                    language="xml"
                    theme="vs"
                    value={record.sample_response}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
            </Space>
          </Panel>
        </Collapse>
      )
    }
  ]

  const resultColumns = [
    {
      title: 'Операция',
      dataIndex: 'operation_name',
      key: 'operation_name'
    },
    {
      title: 'Mock Сервис',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: WSDLImportResult) => (
        record.status === 'created' && record.path ? (
          <Space direction="vertical" size="small">
            <Text>{name}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text code style={{ fontSize: '12px' }}>{getFullUrl(record.path!)}</Text>
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(getFullUrl(record.path!))}
              />
            </div>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
      )
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: WSDLImportResult) => (
        <Space direction="vertical" size="small">
          <Badge 
            status={status === 'created' ? 'success' : 'error'}
            text={status === 'created' ? 'Создан' : 'Ошибка'}
          />
          {record.error && (
            <Text type="danger" style={{ fontSize: '12px' }}>
              {record.error}
            </Text>
          )}
        </Space>
      )
    }
  ]

  const steps = [
    {
      title: 'Парсинг WSDL',
      description: 'Введите URL и распарсите WSDL документ',
      icon: <FileSearchOutlined />
    },
    {
      title: 'Настройки',
      description: 'Настройте параметры импорта',
      icon: <InfoCircleOutlined />
    },
    {
      title: 'Предварительный просмотр',
      description: 'Просмотрите создаваемые сервисы',
      icon: <CheckCircleOutlined />
    },
    {
      title: 'Импорт',
      description: 'Импорт завершен',
      icon: <ImportOutlined />
    }
  ]

  return (
    <Card title="🌐 Импорт WSDL" style={{ margin: '24px' }}>
      <Steps current={currentStep} style={{ marginBottom: 32 }}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} icon={step.icon} />
        ))}
      </Steps>

      {/* Шаг 0: Ввод URL и парсинг */}
      {currentStep === 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="📋 URL WSDL документа">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                placeholder="https://example.com/service.wsdl"
                value={wsdlUrl}
                onChange={(e) => setWsdlUrl(e.target.value)}
                prefix={<GlobalOutlined />}
                size="large"
              />
              
              <Button 
                type="primary" 
                icon={<CloudDownloadOutlined />}
                onClick={parseWSDL}
                loading={loading}
                size="large"
              >
                Парсить WSDL
              </Button>
            </Space>
          </Card>

          {testUrls.length > 0 && (
            <Card title="🧪 Тестовые WSDL URLs" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {testUrls.map((testUrl, index) => (
                  <Card key={index} size="small" style={{ backgroundColor: '#f9f9f9' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                        <Text strong>{testUrl.name}</Text>
                        <Button 
                          size="small" 
                          type="link"
                          onClick={() => setWsdlUrl(testUrl.url)}
                        >
                          Использовать
                        </Button>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {testUrl.description}
                      </Text>
                      <Text code style={{ fontSize: '11px' }}>{testUrl.url}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          )}

          {parseResult && (
            <Card title="📊 Результат парсинга">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small">
                      <Text strong>Сервис:</Text>
                      <br />
                      <Text>{parseResult.service_name}</Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Text strong>Namespace:</Text>
                      <br />
                      <Text style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {parseResult.target_namespace}
                      </Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Text strong>Операций:</Text>
                      <br />
                      <Text>{parseResult.operations.length}</Text>
                    </Card>
                  </Col>
                </Row>

                {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                  <Alert
                    type={parseResult.errors.length > 0 ? 'error' : 'warning'}
                    message={`${parseResult.errors.length} ошибок, ${parseResult.warnings.length} предупреждений`}
                    description={
                      <Collapse ghost>
                        <Panel header="Показать детали" key="errors">
                          {parseResult.errors.map((error, i) => (
                            <div key={i} style={{ color: 'red', fontSize: '12px' }}>
                              ❌ {error}
                            </div>
                          ))}
                          {parseResult.warnings.map((warning, i) => (
                            <div key={i} style={{ color: 'orange', fontSize: '12px' }}>
                              ⚠️ {warning}
                            </div>
                          ))}
                        </Panel>
                      </Collapse>
                    }
                    showIcon
                  />
                )}

                <Table
                  dataSource={parseResult.operations}
                  columns={operationsColumns}
                  rowKey="name"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />

                {parseResult.operations.length > 0 && (
                  <Button type="primary" onClick={() => setCurrentStep(1)}>
                    Настроить импорт
                  </Button>
                )}
              </Space>
            </Card>
          )}
        </Space>
      )}

      {/* Шаг 1: Настройки импорта */}
      {currentStep === 1 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="⚙️ Настройки импорта">
            <Row gutter={16}>
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>Базовый путь:</Text>
                  <Input
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    placeholder="/soap"
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Путь для SOAP эндпоинта (все операции используют один путь)
                  </Text>
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>Префикс сервисов:</Text>
                  <Input
                    value={servicePrefix}
                    onChange={(e) => setServicePrefix(e.target.value)}
                    placeholder="MyAPI_"
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Префикс для имен mock сервисов (необязательно)
                  </Text>
                </Space>
              </Col>
            </Row>

            <Divider />

            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                Назад
              </Button>
              <Button 
                type="primary" 
                onClick={previewImport}
                loading={loading}
              >
                Предварительный просмотр
              </Button>
            </Space>
          </Card>
        </Space>
      )}

      {/* Шаг 2: Предварительный просмотр */}
      {currentStep === 2 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="👀 Предварительный просмотр">
            <Alert
              message={`Будет создано ${previewData.length} mock сервисов с проксированием`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={previewData}
              columns={previewColumns}
              rowKey="name"
              pagination={{ pageSize: 5 }}
              size="small"
            />

            <Divider />

            <Space>
              <Button onClick={() => setCurrentStep(1)}>
                Назад
              </Button>
              <Button 
                type="primary" 
                icon={<ImportOutlined />}
                onClick={importServices}
                loading={loading}
              >
                Импортировать
              </Button>
            </Space>
          </Card>
        </Space>
      )}

      {/* Шаг 3: Результаты импорта */}
      {currentStep === 3 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="Результаты импорта">
            <Alert
              message={`Импорт завершен: ${importResults.filter(r => r.status === 'created').length} успешно, ${importResults.filter(r => r.status === 'failed').length} ошибок`}
              type={importResults.some(r => r.status === 'failed') ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={importResults}
              columns={resultColumns}
              rowKey="operation_name"
              pagination={{ pageSize: 10 }}
              size="small"
            />

            <Divider />

            <Space>
              <Button onClick={() => navigate('/services')}>
                Перейти к сервисам
              </Button>
              <Button onClick={resetImport}>
                Импортировать еще
              </Button>
            </Space>
          </Card>
        </Space>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
        </div>
      )}
    </Card>
  )
}

export default WSDLImport 