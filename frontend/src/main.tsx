import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { ApiConfig } from './utils/apiConfig'
import 'antd/dist/reset.css'

// Инициализация API конфигурации перед запуском приложения
ApiConfig.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConfigProvider locale={ruRU}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>,
  )
}) 