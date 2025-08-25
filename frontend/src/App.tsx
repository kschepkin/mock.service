import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout, ConfigProvider, theme } from 'antd'
import Navigation from '@/components/Navigation'
import MockServiceList from '@/components/MockServiceList'
import MockServiceForm from '@/components/MockServiceForm'
import LogsPage from '@/components/LogsPage'
import SwaggerImport from '@/components/SwaggerImport'
import WSDLImport from '@/components/WSDLImport'
import Settings from '@/components/Settings'
import { ServerProvider } from '@/contexts/ServerContext'
import './App.css'

const { Content } = Layout

function App() {
  return (
    <ServerProvider>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#25606f',
            colorSuccess: '#3a7a8a',
            colorInfo: '#25606f',
            colorWarning: '#ff9800',
            colorError: '#f44336',
            borderRadius: 8,
            wireframe: false,
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorBorder: '#d4e8eb',
            colorText: '#2d2d2d',
            colorTextSecondary: '#666666',
          },
          components: {
            Layout: {
              bodyBg: '#f0f7f8',
              siderBg: 'linear-gradient(135deg, #1a4a57 0%, #25606f 50%, #0f3940 100%)',
            },
            Menu: {
              itemBg: 'transparent',
              itemSelectedBg: 'rgba(58, 122, 138, 0.2)',
              itemHoverBg: 'rgba(255, 255, 255, 0.1)',
              itemColor: 'rgba(255, 255, 255, 0.9)',
              itemSelectedColor: '#ffffff',
              itemHoverColor: '#ffffff',
            },
            Button: {
              colorPrimary: '#25606f',
              colorPrimaryHover: '#3a7a8a',
              colorPrimaryActive: '#1a4a57',
            },
            Card: {
              colorBgContainer: '#ffffff',
              colorBorderSecondary: '#d4e8eb',
            },
            Input: {
              colorBorder: '#d4e8eb',
            },
            Table: {
              colorBgContainer: '#ffffff',
              colorBorderSecondary: '#d4e8eb',
            },
            Tag: {
              colorPrimary: '#25606f',
              colorSuccess: '#3a7a8a',
            },
            Badge: {
              colorPrimary: '#25606f',
              colorSuccess: '#3a7a8a',
            },
            Steps: {
              colorPrimary: '#25606f',
              colorPrimaryBorder: '#3a7a8a',
            },
          },
        }}
      >
      <Layout style={{ minHeight: '100vh' }} className="app-layout">
        <Navigation />
        <Layout className="main-layout">
          <Content className="main-content">
            <div className="content-wrapper">
              <Routes>
                <Route path="/" element={<MockServiceList />} />
                <Route path="/services" element={<MockServiceList />} />
                <Route path="/services/new" element={<MockServiceForm />} />
                <Route path="/services/:id/edit" element={<MockServiceForm />} />
                <Route path="/swagger-import" element={<SwaggerImport />} />
                <Route path="/wsdl-import" element={<WSDLImport />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/logs/:serviceId" element={<LogsPage />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
    </ServerProvider>
  )
}

export default App 