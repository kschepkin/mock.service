import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Space, Typography, Alert, message, Divider, Spin } from 'antd'
import { SaveOutlined, ReloadOutlined, GlobalOutlined, ApiOutlined } from '@ant-design/icons'
import { ApiConfig, ApiSettings } from '../utils/apiConfig'
import { ConfigManager } from '../utils/configManager'
import { useServerInfo } from '../contexts/ServerContext'

const { Title, Text, Paragraph } = Typography

const Settings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [currentSettings, setCurrentSettings] = useState<ApiSettings>({
    domain: 'localhost',
    port: '8080',
    protocol: 'http'
  })
  const { updateApiSettings } = useServerInfo()

  // Загрузка настроек при инициализации
  useEffect(() => {
    loadSettings()
  }, [form])

  const loadSettings = async () => {
    setInitialLoading(true)
    try {
      // Принудительно перезагружаем настройки из файла
      ApiConfig.clearCache()
      await ApiConfig.initialize()
      const settings = ApiConfig.getSettings()
      setCurrentSettings(settings)
      form.setFieldsValue(settings)
      
      // Обновляем настройки API в контексте
      updateApiSettings()
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error)
      message.error('Ошибка загрузки настроек')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSave = async (values: ApiSettings) => {
    setLoading(true)
    try {
      await ApiConfig.saveSettings(values)
      setCurrentSettings(values)
      
      // Обновляем настройки API в контексте
      updateApiSettings()
      
      message.success('Настройки успешно сохранены и применены!')
      
    } catch (error: any) {
      message.error(error.message || 'Ошибка сохранения настроек')
      console.error('Ошибка сохранения:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const defaultSettings = await ApiConfig.resetSettings()
      form.setFieldsValue(defaultSettings)
      setCurrentSettings(defaultSettings)
      
      // Обновляем настройки API в контексте
      updateApiSettings()
      
      message.info('Настройки сброшены к значениям по умолчанию и применены')
    } catch (error: any) {
      message.error(error.message || 'Ошибка сброса настроек')
      console.error('Ошибка сброса:', error)
    } finally {
      setLoading(false)
    }
  }


  const getCurrentUrl = () => {
    const portPart = currentSettings.port ? `:${currentSettings.port}` : ''
    return `${currentSettings.protocol}://${currentSettings.domain}${portPart}`
  }

  if (initialLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: '#666' }}>
          Загрузка настроек...
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <ApiOutlined style={{ marginRight: '12px', color: '#25606f' }} />
          Настройки API
        </Title>
        <Paragraph type="secondary">
          Настройте адрес сервера API для подключения к удаленным инстансам Mock Service
        </Paragraph>
      </div>

      <Card 
        title={
          <Space>
            <GlobalOutlined />
            <span>Конфигурация сервера</span>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Alert
          message="Текущий API URL"
          description={
            <Text code copyable style={{ fontSize: '16px' }}>
              {getCurrentUrl()}
            </Text>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={currentSettings}
        >
          <Form.Item
            label="Протокол"
            name="protocol"
            rules={[{ required: true, message: 'Выберите протокол' }]}
          >
            <Input
              placeholder="http или https"
              addonBefore="Протокол:"
            />
          </Form.Item>

          <Form.Item
            label="Домен/IP-адрес"
            name="domain"
            rules={[
              { required: true, message: 'Введите домен или IP-адрес' },
              { 
                pattern: /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^localhost$/,
                message: 'Введите корректный домен или IP-адрес'
              }
            ]}
          >
            <Input
              placeholder="localhost, 192.168.1.100, или example.com"
              addonBefore="Домен:"
            />
          </Form.Item>

          <Form.Item
            label="Порт (необязательно)"
            name="port"
            rules={[
              { 
                pattern: /^[0-9]*$/,
                message: 'Порт должен быть числом'
              },
              {
                validator: (_, value) => {
                  if (!value || value === '') {
                    return Promise.resolve()
                  }
                  const port = parseInt(value)
                  if (port >= 1 && port <= 65535) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Порт должен быть от 1 до 65535'))
                }
              }
            ]}
          >
            <Input
              placeholder="Оставьте пустым для стандартного порта (80/443)"
              addonBefore="Порт:"
            />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<SaveOutlined />}
              >
                Сохранить настройки
              </Button>
              <Button 
                onClick={handleReset}
                loading={loading}
                icon={<ReloadOutlined />}
              >
                Сбросить к умолчанию
              </Button>
            </Space>
          </Form.Item>
          
        </Form>
      </Card>

      <Card title="Примеры использования" size="small">
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Локальная разработка:</Text>
          <br />
          <Text code>http://localhost:8080</Text>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Удаленный сервер с портом:</Text>
          <br />
          <Text code>http://212.109.220.102:8080</Text>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Удаленный сервер без порта:</Text>
          <br />
          <Text code>https://api.example.com</Text>
        </div>
        
        <div>
          <Text strong>HTTPS с нестандартным портом:</Text>
          <br />
          <Text code>https://api.example.com:8443</Text>
        </div>
      </Card>

    </div>
  )
}

export default Settings