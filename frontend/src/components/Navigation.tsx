import React from 'react'
import { Layout, Menu, Typography, Space, Badge, Tooltip } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useServerInfo } from '../contexts/ServerContext'
import {
  ApiOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  PlusOutlined,
  DashboardOutlined,
  SettingOutlined,
  RocketOutlined,
  GlobalOutlined,
  BookOutlined
} from '@ant-design/icons'

const { Sider } = Layout
const { Title, Text } = Typography

const Navigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { serverInfo } = useServerInfo()

  const menuItems = [
    {
      key: '/services',
      icon: <DashboardOutlined />,
      label: (
        <Space>
          <span>Мои сервисы</span>
          <Badge count={0} showZero={false} />
        </Space>
      ),
    },
    {
      key: '/services/new',
      icon: <PlusOutlined />,
      label: (
        <Space>
          <span>Создать сервис</span>
          <RocketOutlined style={{ fontSize: '12px', opacity: 0.6 }} />
        </Space>
      ),
    },
    {
      key: '/swagger-import',
      icon: <ApiOutlined />,
      label: (
        <Space>
          <span>Импорт Swagger</span>
          <Badge count="NEW" style={{ backgroundColor: '#3a7a8a', fontSize: '10px' }} />
        </Space>
      ),
    },
    {
      key: '/wsdl-import',
      icon: <GlobalOutlined />,
      label: (
        <Space>
          <span>Импорт WSDL</span>
          <Badge count="SOAP" style={{ backgroundColor: '#25606f', fontSize: '10px' }} />
        </Space>
      ),
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: (
        <Space>
          <span>Логи запросов</span>
          <Badge dot status="processing" />
        </Space>
      ),
    },
    {
      key: 'swagger-docs',
      icon: <BookOutlined />,
      label: (
        <Space>
          <span>Документация</span>
          <Badge count="Swagger" style={{ backgroundColor: '#52c41a', fontSize: '9px' }} />
        </Space>
      ),
    },
  ]

  const bottomMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      disabled: true,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'swagger-docs') {
      // Открываем Swagger документацию в новой вкладке
      const baseUrl = serverInfo?.base_url || 'http://0.0.0.0:8080'
      window.open(`${baseUrl}/docs`, '_blank')
    } else {
      navigate(key)
    }
  }

  return (
    <Sider 
      width={280} 
      style={{
        background: 'linear-gradient(135deg, #1a4a57 0%, #25606f 50%, #0f3940 100%)',
        boxShadow: '4px 0 20px rgba(37, 96, 111, 0.2)',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Логотип и заголовок */}
      <div style={{ 
        height: 80, 
        margin: '20px 24px', 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '16px',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onClick={() => navigate('/services')}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(58, 122, 138, 0.25)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      >
        <Space direction="vertical" align="center" size={4}>
          <ApiOutlined style={{ 
            fontSize: '24px', 
            color: 'white',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }} />
          <Title level={4} style={{ 
            color: 'white', 
            margin: 0, 
            fontSize: '16px',
            fontWeight: 600,
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            Mock Service
          </Title>
        </Space>
      </div>

      {/* Основное меню */}
      <div style={{ padding: '0 16px' }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
          }}
          className="custom-menu"
        />
      </div>

      {/* Статистика */}
      <div style={{
        margin: '24px 24px 16px 24px',
        padding: '16px',
        background: 'rgba(58, 122, 138, 0.15)',
        borderRadius: '12px',
        border: '1px solid rgba(58, 122, 138, 0.2)',
      }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {serverInfo && (
            <Text style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '200px',
              display: 'block',
              textAlign: 'center'
            }}>
              API {serverInfo.base_url.replace('http://', '').replace('https://', '')}
            </Text>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            
          </div>
        </Space>
      </div>

      {/* Нижнее меню */}
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '16px', 
        right: '16px' 
      }}>
        <Menu
          mode="inline"
          items={bottomMenuItems}
          style={{
            background: 'transparent',
            border: 'none',
          }}
          className="custom-menu"
        />
        
        {/* Версия и информация о команде */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          padding: '8px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '11px'
        }}>
          <div style={{ marginBottom: '4px' }}>
            v1.0.0
          </div>
          <div style={{ 
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(58, 122, 138, 0.25)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
          onClick={() => window.open('https://save-link.ru', '_blank')}
          >
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              fontSize: '10px',
              fontWeight: 600,
              marginBottom: '2px'
            }}>
              Разработано командой
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              fontSize: '12px',
              fontWeight: 700,
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              SaveLink
            </div>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              fontSize: '9px',
              marginTop: '2px'
            }}>
              save-link.ru
            </div>
          </div>
        </div>
      </div>


    </Sider>
  )
}

export default Navigation 