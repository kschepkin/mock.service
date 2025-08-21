import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServerInfo } from '../contexts/ServerContext'
import {
  Card,
  Upload,
  Button,
  Input,
  Radio,
  Alert,
  Table,
  Tag,
  Space,
  notification,
  Modal,
  Tabs,
  Typography,
  Divider,
  Badge,
  Tooltip
} from 'antd'
import {
  UploadOutlined,
  EyeOutlined,
  ImportOutlined,
  FileTextOutlined,
  CodeOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import Editor from '@monaco-editor/react'

import { SwaggerAPI, SwaggerImportResult, MockServicePreview } from '../api/swaggerApi'

const { Text, Title, Paragraph } = Typography
const { TabPane } = Tabs

interface SwaggerImportProps {
  onImportComplete?: () => void
}

const methodColors = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
  HEAD: 'cyan',
  OPTIONS: 'magenta'
}

const SwaggerImport: React.FC<SwaggerImportProps> = ({ onImportComplete }) => {
  const navigate = useNavigate()
  const { serverInfo } = useServerInfo()
  const [importType, setImportType] = useState<'file' | 'content'>('file')
  const [contentType, setContentType] = useState<'json' | 'yaml'>('json')
  const [basePath, setBasePath] = useState('/api')
  const [swaggerContent, setSwaggerContent] = useState('')
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  
  const [parseResult, setParseResult] = useState<SwaggerImportResult | null>(null)
  const [previewData, setPreviewData] = useState<MockServicePreview[]>([])
  const [loading, setLoading] = useState(false)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  
  const handleFileUpload = (file: any) => {
    console.log('DEBUG: File uploaded:', file.name, file.size, file.type)
    
    // Проверяем размер файла
    if (file.size === 0) {
      notification.error({
        message: 'Пустой файл',
        description: 'Выбранный файл пустой. Пожалуйста, выберите файл с содержимым.'
      })
      return false
    }
    
    // Проверяем размер файла (максимум 10MB)
    if (file.size > 10 * 1024 * 1024) {
      notification.error({
        message: 'Файл слишком большой',
        description: 'Размер файла не должен превышать 10MB.'
      })
      return false
    }
    
    setUploadedFile(file)
    return false // Предотвращаем автоматическую загрузку
  }

  const parseSwagger = async () => {
    console.log('DEBUG: parseSwagger called')
    console.log('DEBUG: importType:', importType)
    console.log('DEBUG: uploadedFile:', uploadedFile)
    console.log('DEBUG: uploadedFile?.originFileObj:', uploadedFile?.originFileObj)
    console.log('DEBUG: swaggerContent length:', swaggerContent.length)
    
    setLoading(true)
    try {
      let result: SwaggerImportResult

      if (importType === 'file' && uploadedFile) {
        console.log('DEBUG: Parsing file:', uploadedFile.name, uploadedFile.size)
        // Используем сам uploadedFile, а не originFileObj для нашего API
        const fileToSend = uploadedFile.originFileObj || uploadedFile
        console.log('DEBUG: fileToSend:', fileToSend)
        result = await SwaggerAPI.parseSwaggerFile(
          fileToSend as File,
          contentType
        )
      } else if (importType === 'content' && swaggerContent.trim()) {
        console.log('DEBUG: Parsing content, length:', swaggerContent.length)
        result = await SwaggerAPI.parseSwaggerContent(swaggerContent, contentType)
      } else {
        console.log('DEBUG: Neither condition met - showing error')
        notification.error({
          message: 'Ошибка',
          description: 'Выберите файл или введите содержимое Swagger'
        })
        setLoading(false)
        return
      }

      setParseResult(result)

      if (result.errors.length > 0) {
        notification.error({
          message: 'Ошибки при парсинге',
          description: (
            <div>
              <p>Найдено {result.errors.length} ошибок:</p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.errors.slice(0, 3).map((error, i) => (
                  <li key={i} style={{ fontSize: '12px' }}>{error}</li>
                ))}
                {result.errors.length > 3 && (
                  <li style={{ fontSize: '12px' }}>... и ещё {result.errors.length - 3} ошибок</li>
                )}
              </ul>
            </div>
          ),
          duration: 10
        })
      } else {
        notification.success({
          message: 'Успех',
          description: `Найдено ${result.endpoints.length} эндпоинтов`
        })
      }
    } catch (error: any) {
      notification.error({
        message: 'Ошибка парсинга',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const previewImport = async () => {
    if (!parseResult || parseResult.endpoints.length === 0) {
      notification.error({
        message: 'Ошибка',
        description: 'Сначала успешно парсите Swagger файл с эндпоинтами'
      })
      return
    }

    setLoading(true)
    try {
      let preview: MockServicePreview[]

      if (importType === 'file' && uploadedFile) {
        const fileToSend = uploadedFile.originFileObj || uploadedFile
        preview = await SwaggerAPI.previewSwaggerImport(
          fileToSend as File,
          basePath,
          contentType
        )
      } else {
        preview = await SwaggerAPI.previewSwaggerContentImport(
          swaggerContent,
          basePath,
          contentType
        )
      }

      setPreviewData(preview)
      setPreviewModalVisible(true)
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
    if (!parseResult || parseResult.endpoints.length === 0) {
      notification.error({
        message: 'Ошибка',
        description: 'Сначала успешно парсите Swagger файл с эндпоинтами'
      })
      return
    }

    setLoading(true)
    try {
      let importedServices: any[]

      if (importType === 'file' && uploadedFile) {
        const fileToSend = uploadedFile.originFileObj || uploadedFile
        importedServices = await SwaggerAPI.importSwaggerFile(
          fileToSend as File,
          basePath,
          contentType
        )
      } else {
        importedServices = await SwaggerAPI.importSwaggerContent(
          swaggerContent,
          basePath,
          contentType
        )
      }

      notification.success({
        message: 'Импорт завершен',
        description: `Создано ${importedServices.length} mock сервисов`
      })

      // Сбрасываем состояние
      setParseResult(null)
      setPreviewData([])
      setUploadedFile(null)
      setSwaggerContent('')
      setPreviewModalVisible(false)

      // Перенаправляем на список сервисов
      setTimeout(() => {
        navigate('/services')
      }, 1500)
    } catch (error: any) {
      notification.error({
        message: 'Ошибка импорта',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const endpointsColumns = [
    {
      title: 'Метод',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => (
        <Tag color={methodColors[method as keyof typeof methodColors] || 'default'}>
          {method}
        </Tag>
      )
    },
    {
      title: 'Путь',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => (
        <Text code>
          {serverInfo ? `${serverInfo.mock_base_url}${basePath.replace(/\/$/, '')}${path}` : `${basePath}${path}`}
        </Text>
      )
    },
    {
      title: 'Описание',
      dataIndex: 'summary',
      key: 'summary',
      render: (summary: string, record: any) => summary || record.description || '—'
    },
    {
      title: 'Параметры',
      dataIndex: 'parameters',
      key: 'parameters',
      render: (params: any[]) => (
        <Badge count={params?.length || 0} showZero color="blue" />
      )
    },
    {
      title: 'Ответы',
      dataIndex: 'responses',
      key: 'responses',
      render: (responses: any) => (
        <Badge count={Object.keys(responses || {}).length} showZero color="green" />
      )
    }
  ]

  const previewColumns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      width: 300
    },
    {
      title: 'Метод',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => (
        <Tag color={methodColors[method as keyof typeof methodColors] || 'default'}>
          {method}
        </Tag>
      )
    },
    {
      title: 'Путь',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => (
        <Text code>
          {serverInfo ? `${serverInfo.mock_base_url}${path}` : path}
        </Text>
      )
    },
    {
      title: 'Стратегия',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (strategy: string) => (
        <Tag color="cyan">{strategy}</Tag>
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ApiOutlined /> Импорт Swagger/OpenAPI
      </Title>
      <Paragraph>
        Импортируйте Swagger/OpenAPI спецификацию для автоматического создания mock сервисов.
        Поддерживаются форматы JSON и YAML.
      </Paragraph>
      
      <Alert
        message="Поддерживаемые форматы"
        description={
          <div>
            <Text>• <Text strong>Swagger 2.0</Text> в формате JSON или YAML (полная поддержка)</Text><br/>
            <Text>• <Text strong>OpenAPI 3.0+</Text> в формате JSON или YAML</Text><br/>
            <Text>• Файл должен содержать валидную спецификацию с разделом <Text code>paths</Text></Text><br/>
            <Text>• Автоматическое определение формата и версии</Text><br/>
            <Text>• Поддержка <Text code>$ref</Text> ссылок и <Text code>definitions</Text></Text>
          </div>
        }
        type="success"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Настройки импорта */}
          <div>
            <Title level={4}>Настройки импорта</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Тип импорта:</Text>
                <Radio.Group
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  style={{ marginLeft: '12px' }}
                >
                  <Radio value="file">
                    <FileTextOutlined /> Загрузить файл
                  </Radio>
                  <Radio value="content">
                    <CodeOutlined /> Вставить содержимое
                  </Radio>
                </Radio.Group>
              </div>

              <div>
                <Text strong>Формат:</Text>
                <Radio.Group
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  style={{ marginLeft: '12px' }}
                >
                  <Radio value="json">JSON</Radio>
                  <Radio value="yaml">YAML</Radio>
                </Radio.Group>
              </div>

              <div>
                <Text strong>Базовый путь:</Text>
                <Input
                  value={basePath}
                  onChange={(e) => setBasePath(e.target.value)}
                  placeholder="/api"
                  style={{ width: '200px', marginLeft: '12px' }}
                />
                <Tooltip title="Базовый путь будет добавлен к каждому endpoint'у">
                  <ExclamationCircleOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                </Tooltip>
              </div>
            </Space>
          </div>

          <Divider />

          {/* Загрузка файла или ввод содержимого */}
          {importType === 'file' ? (
            <div>
              <Title level={4}>Загрузка файла</Title>
              <Upload
                beforeUpload={handleFileUpload}
                showUploadList={false}
                accept=".json,.yaml,.yml"
              >
                <Button icon={<UploadOutlined />} size="large">
                  Выбрать Swagger файл
                </Button>
              </Upload>
              {uploadedFile && (
                <div style={{ marginTop: '12px' }}>
                  <Text>Выбран файл: </Text>
                  <Text code>{uploadedFile.name}</Text>
                  <div style={{ marginTop: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Размер: {(uploadedFile.size || 0)} байт
                    </Text>
                    {uploadedFile.name && (
                      <Text type="secondary" style={{ fontSize: '12px', marginLeft: '12px' }}>
                        Тип: {uploadedFile.name.endsWith('.yaml') || uploadedFile.name.endsWith('.yml') ? 'YAML' : 'JSON'}
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Title level={4}>Содержимое Swagger</Title>
              <Editor
                height="300px"
                language={contentType === 'json' ? 'json' : 'yaml'}
                value={swaggerContent}
                onChange={(value) => setSwaggerContent(value || '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on'
                }}
              />
            </div>
          )}

          {/* Кнопки действий */}
          <Space>
            <Button
              type="primary"
              icon={<CodeOutlined />}
              onClick={parseSwagger}
              loading={loading}
              disabled={!uploadedFile && !swaggerContent.trim()}
            >
              Парсить Swagger
            </Button>
            
            {parseResult && parseResult.errors.length === 0 && (
              <>
                <Button
                  icon={<EyeOutlined />}
                  onClick={previewImport}
                  loading={loading}
                >
                  Предварительный просмотр
                </Button>
                
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  onClick={importServices}
                  loading={loading}
                  style={{ backgroundColor: '#52c41a' }}
                >
                  Импортировать
                </Button>
              </>
            )}
          </Space>

          {/* Результаты парсинга */}
          {parseResult && (
            <div>
              <Divider />
              <Title level={4}>Результаты парсинга</Title>
              
              {parseResult.errors.length > 0 && (
                <Alert
                  type="error"
                  message="Ошибки парсинга"
                  description={
                    <ul style={{ margin: 0 }}>
                      {parseResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginBottom: '16px' }}
                />
              )}

              {parseResult.warnings.length > 0 && (
                <Alert
                  type="warning"
                  message="Предупреждения"
                  description={
                    <ul style={{ margin: 0 }}>
                      {parseResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginBottom: '16px' }}
                />
              )}

              {parseResult.errors.length === 0 && (
                <Alert
                  type="success"
                  message={
                    <Space>
                      <CheckCircleOutlined />
                      <span>
                        <strong>{parseResult.title}</strong> v{parseResult.version}
                      </span>
                    </Space>
                  }
                  description={`Найдено ${parseResult.endpoints.length} эндпоинтов`}
                  style={{ marginBottom: '16px' }}
                />
              )}

              {parseResult.endpoints.length > 0 && (
                <Table
                  dataSource={parseResult.endpoints}
                  columns={endpointsColumns}
                  rowKey={(record) => `${record.method}-${record.path}`}
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              )}
            </div>
          )}
        </Space>
      </Card>

      {/* Модал предварительного просмотра */}
      <Modal
        title="Предварительный просмотр импорта"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalVisible(false)}>
            Отмена
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<ImportOutlined />}
            onClick={importServices}
            loading={loading}
          >
            Импортировать ({previewData.length} сервисов)
          </Button>
        ]}
      >
        <Table
          dataSource={previewData}
          columns={previewColumns}
          rowKey={(record) => `${record.method}-${record.path}`}
          pagination={{ pageSize: 8 }}
          size="small"
          expandable={{
            expandedRowRender: (record) => (
              <div>
                <Text strong>Описание:</Text>
                <Paragraph style={{ marginBottom: '12px' }}>
                  {record.description}
                </Paragraph>
                <Text strong>Статический ответ:</Text>
                <Editor
                  height="200px"
                  language="json"
                  value={record.static_response}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12
                  }}
                />
              </div>
            ),
            rowExpandable: () => true
          }}
        />
      </Modal>
    </div>
  )
}

export default SwaggerImport 