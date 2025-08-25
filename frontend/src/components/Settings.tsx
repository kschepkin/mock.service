import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Space, Typography, Alert, message, Divider } from 'antd'
import { SaveOutlined, ReloadOutlined, GlobalOutlined, ApiOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

interface ApiSettings {
  domain: string
  port?: string
  protocol: 'http' | 'https'
}

const Settings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [currentSettings, setCurrentSettings] = useState<ApiSettings>({
    domain: 'localhost',
    port: '8080',
    protocol: 'http'
  })

  // Загрузка настроек из localStorage при инициализации
  useEffect(() => {
    const savedSettings = localStorage.getItem('mockService_apiSettings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        setCurrentSettings(settings)
        form.setFieldsValue(settings)
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error)
      }
    }
  }, [form])

  const handleSave = async (values: ApiSettings) => {
    setLoading(true)
    try {
      // Сохраняем настройки в localStorage
      localStorage.setItem('mockService_apiSettings', JSON.stringify(values))
      setCurrentSettings(values)
      
      message.success('Настройки успешно сохранены!')
      
      // Перезагружаем страницу для применения новых настроек API
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      message.error('Ошибка сохранения настроек')
      console.error('Ошибка сохранения:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    const defaultSettings: ApiSettings = {
      domain: 'localhost',
      port: '8080',
      protocol: 'http'
    }
    
    form.setFieldsValue(defaultSettings)
    localStorage.removeItem('mockService_apiSettings')
    setCurrentSettings(defaultSettings)
    message.info('Настройки сброшены к значениям по умолчанию')
  }

  const getCurrentUrl = () => {
    const portPart = currentSettings.port ? `:${currentSettings.port}` : ''
    return `${currentSettings.protocol}://${currentSettings.domain}${portPart}`
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

      <Alert
        message="Внимание"
        description="После сохранения настроек страница будет перезагружена для применения новых параметров подключения к API."
        type="warning"
        showIcon
        style={{ marginTop: '24px' }}
      />
    </div>
  )
}

export default Settings