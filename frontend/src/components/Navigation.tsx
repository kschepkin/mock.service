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
  const { serverInfo, currentApiUrl } = useServerInfo()

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
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
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
        height: '100vh',
        overflow: 'hidden'
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
      <div style={{ 
        padding: '0 16px',
        height: 'calc(100vh - 380px)', // Учитываем высоту хедера, статистики и нижнего меню
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
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
        margin: '24px 20px 16px 20px',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%'
        }}>
          {/* Иконка подключения */}
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: serverInfo ? '#52c41a' : '#ff4d4f',
            boxShadow: serverInfo 
              ? '0 0 6px rgba(82, 196, 26, 0.6)' 
              : '0 0 6px rgba(255, 77, 79, 0.6)',
            flexShrink: 0
          }} />
          
          {/* API URL */}
          <Text style={{ 
            color: serverInfo ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)', 
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            textAlign: 'center',
            letterSpacing: '0.3px'
          }}>
            {serverInfo 
              ? serverInfo.base_url.replace('http://', '').replace('https://', '')
              : currentApiUrl.replace('http://', '').replace('https://', '')
            }
          </Text>
          
          {/* Статус индикатор */}
          <div style={{
            fontSize: '8px',
            color: serverInfo ? 'rgba(82, 196, 26, 0.9)' : 'rgba(255, 77, 79, 0.9)',
            fontWeight: 500,
            flexShrink: 0
          }}>
            ●
          </div>
        </div>
      </div>

      {/* Нижнее меню */}
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '16px', 
        right: '16px',
        zIndex: 10
      }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={bottomMenuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
          }}
          className="custom-menu"
        />
        
        {/* GitHub ссылка */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          padding: '8px',
        }}>
          <a 
            href="https://github.com/kschepkin/mock.service" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              fontSize: '11px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(58, 122, 138, 0.25)'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
        </div>
      </div>


    </Sider>
  )
}

export default Navigation 