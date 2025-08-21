import React from 'react'
import { Typography, Divider, Tag, Card, Space, Alert, Collapse } from 'antd'
import { InfoCircleOutlined, CodeOutlined, BulbOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

interface HelpContentProps {
  type: 'pathPattern' | 'conditional' | 'strategy' | 'headers'
  pathParams?: string[]
}

const HelpContent: React.FC<HelpContentProps> = ({ type, pathParams = [] }) => {
  const renderPathPatternHelp = () => (
    <div>
      <Alert
        message="Как создавать паттерны путей"
        description="Используйте фигурные скобки {} для создания параметров пути"
        type="info"
        icon={<BulbOutlined />}
        style={{ marginBottom: 16 }}
      />
      
      <Title level={5}>📋 Примеры паттернов:</Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        {[
          { pattern: "/", description: "Корневой путь сущности" },
          { pattern: "/{id}", description: "Элемент по ID" },
          { pattern: "/{user_id}/posts", description: "Вложенный ресурс" },
          { pattern: "/{user_id}/posts/{post_id}", description: "Двойная вложенность" },
          { pattern: "/search", description: "Статичный путь" },
          { pattern: "/files/{filename}.{ext}", description: "Файлы с расширением" }
        ].map(({ pattern, description }, i) => (
          <Card key={i} size="small" style={{ backgroundColor: '#f9f9f9' }}>
            <Space>
              <Tag color="blue" style={{ fontFamily: 'monospace' }}>{pattern}</Tag>
              <Text type="secondary">{description}</Text>
            </Space>
          </Card>
        ))}
      </Space>

      {pathParams.length > 0 && (
        <>
          <Divider />
          <Title level={5}>🎯 Найденные параметры:</Title>
          <Space wrap>
            {pathParams.map(param => (
              <Tag key={param} color="green" icon={<CodeOutlined />}>
                {param}
              </Tag>
            ))}
          </Space>
                     <Paragraph type="secondary" style={{ marginTop: 8 }}>
             Эти параметры будут доступны в условном коде как <Text code>path_params.get('param_name')</Text>
           </Paragraph>
        </>
      )}

      <Divider />
      <Title level={5}>⚠️ Правила:</Title>
      <ul>
        <li>Путь должен начинаться с <Text code>/</Text></li>
        <li>Имена параметров должны быть уникальными</li>
        <li>Используйте только латинские буквы, цифры и _</li>
        <li>Первый символ имени - буква или _</li>
      </ul>
    </div>
  )

  const renderConditionalHelp = () => (
    <div>
      <Alert
        message="Условные ответы на Python"
        description="Пишите Python код для определения ответа на основе данных запроса"
        type="info"
        icon={<CodeOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Title level={5}>📝 Доступные переменные:</Title>
      <Collapse ghost>
        <Panel header="🔍 Основные переменные" key="variables">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small">
              <Text code>request</Text> — полный объект запроса
            </Card>
            <Card size="small">
              <Text code>headers</Text> — заголовки запроса (dict)
            </Card>
            <Card size="small">
              <Text code>query</Text> — query параметры (dict)
            </Card>
            <Card size="small">
              <Text code>body</Text> — тело запроса (string)
            </Card>
            <Card size="small">
              <Text code>method</Text> — HTTP метод (string)
            </Card>
            <Card size="small">
              <Text code>path</Text> — полный путь запроса (string)
            </Card>
            <Card size="small">
              <Text code>path_params</Text> — параметры из пути (dict)
            </Card>
            <Card size="small">
              <Text code>json</Text> — распарсенный JSON из body (при наличии)
            </Card>
          </Space>
        </Panel>
      </Collapse>

      <Title level={5}>💡 Примеры кода:</Title>
      <Collapse>
        <Panel header="По ID пользователя" key="user-id">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Извлекаем ID пользователя
user_id = int(path_params.get('id', 0))

# Проверяем роль из заголовков
role = headers.get('X-User-Role', 'user')`}
            </pre>
            <Text strong>Условия:</Text>
                         <ul>
               <li><Text code>user_id == 1</Text> → Admin пользователь</li>
               <li><Text code>user_id &gt; 0 and role == 'admin'</Text> → Админ доступ</li>
               <li><Text code>user_id &gt; 0</Text> → Обычный пользователь</li>
             </ul>
          </Card>
        </Panel>

        <Panel header="Query параметры" key="query">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Извлекаем параметры поиска
category = query.get('category', '')
limit = int(query.get('limit', 10))
search = query.get('q', '')

# Проверяем авторизацию
is_authenticated = 'Authorization' in headers`}
            </pre>
            <Text strong>Условия:</Text>
                         <ul>
               <li><Text code>category == 'premium' and is_authenticated</Text> → Премиум контент</li>
               <li><Text code>limit &gt; 100</Text> → Ошибка лимита</li>
               <li><Text code>search != ''</Text> → Результаты поиска</li>
             </ul>
          </Card>
        </Panel>

        <Panel header="JSON данные" key="json">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Работа с JSON данными
if json:
    email = json.get('email', '')
    age = json.get('age', 0)
    is_valid_email = '@' in email
else:
    email = ''
    age = 0
    is_valid_email = False`}
            </pre>
            <Text strong>Условия:</Text>
                         <ul>
               <li><Text code>not is_valid_email</Text> → Ошибка валидации</li>
               <li><Text code>age &lt; 18</Text> → Несовершеннолетний</li>
               <li><Text code>email.endswith('@admin.com')</Text> → Админ домен</li>
             </ul>
          </Card>
        </Panel>
        
        <Panel header="🧼 SOAP данные" key="soap">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Парсинг SOAP XML
import re

# Извлечение значений из SOAP body
user_id = ""
operation = ""

if body:
    user_id_match = re.search(r'<userId>([^<]+)</userId>', body)
    if user_id_match:
        user_id = user_id_match.group(1)

# SOAPAction из заголовков
soap_action = headers.get('soapaction', '').strip('"')
operation = soap_action.lower()`}
            </pre>
            <Text strong>Условия:</Text>
            <ul>
              <li><Text code>user_id == ""</Text> → SOAP Fault</li>
              <li><Text code>operation == "getuserinfo"</Text> → Информация о пользователе</li>
              <li><Text code>user_id == "admin"</Text> → Админ данные</li>
            </ul>
          </Card>
        </Panel>

        <Panel header="🔐 Авторизация и роли" key="auth">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Проверка токенов и ролей
auth_token = headers.get('authorization', '')
api_key = headers.get('x-api-key', '')
user_role = headers.get('x-user-role', 'guest')

# Определение прав доступа
is_admin = user_role == 'admin'
has_api_key = api_key == 'valid-api-key'
is_authenticated = auth_token.startswith('Bearer ')`}
            </pre>
            <Text strong>Условия:</Text>
            <ul>
              <li><Text code>not is_authenticated</Text> → Ошибка 401</li>
              <li><Text code>is_admin</Text> → Полный доступ</li>
              <li><Text code>has_api_key</Text> → API доступ</li>
            </ul>
          </Card>
        </Panel>

        <Panel header="📊 Валидация и лимиты" key="validation">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Валидация входных данных
limit = int(query.get('limit', 10))
search_query = query.get('q', '')

if json:
    amount = json.get('amount', 0)
    email = json.get('email', '')
    username = json.get('username', '')
    
    # Проверки
    is_valid_email = '@' in email and '.' in email
    is_valid_username = len(username) >= 3
    is_valid_amount = amount > 0`}
            </pre>
            <Text strong>Условия:</Text>
            <ul>
              <li><Text code>limit &gt; 100</Text> → Превышен лимит</li>
              <li><Text code>len(search_query) &lt; 3</Text> → Слишком короткий поиск</li>
              <li><Text code>not is_valid_email</Text> → Неверный email</li>
              <li><Text code>amount &gt; 10000</Text> → Крупная сумма</li>
            </ul>
          </Card>
        </Panel>

        <Panel header="⏰ Временные условия" key="time">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Работа со временем
import datetime

now = datetime.datetime.now()
current_hour = now.hour
current_weekday = now.weekday()  # 0=понедельник

# Временные проверки
is_business_hours = 9 <= current_hour <= 17
is_weekend = current_weekday >= 5
is_night_time = current_hour >= 22 or current_hour <= 6`}
            </pre>
            <Text strong>Условия:</Text>
            <ul>
              <li><Text code>not is_business_hours</Text> → Не рабочие часы</li>
              <li><Text code>is_weekend</Text> → Выходные</li>
              <li><Text code>is_night_time</Text> → Ночное время</li>
            </ul>
          </Card>
        </Panel>

        <Panel header="📋 Form данные" key="form">
          <Card>
            <pre style={{ backgroundColor: '#f6f8fa', padding: '12px', borderRadius: '6px' }}>
{`# Парсинг form-data
form_data = {}
if 'application/x-www-form-urlencoded' in headers.get('content-type', ''):
    import urllib.parse
    form_data = urllib.parse.parse_qs(body)
    
    # Извлечение полей
    username = form_data.get('username', [''])[0]
    password = form_data.get('password', [''])[0]
    remember_me = 'remember' in form_data`}
            </pre>
            <Text strong>Условия:</Text>
            <ul>
              <li><Text code>{'username == ""'}</Text> → Отсутствует логин</li>
              <li><Text code>{'len(password) < 6'}</Text> → Короткий пароль</li>
              <li><Text code>remember_me</Text> → Запомнить пользователя</li>
            </ul>
          </Card>
        </Panel>
      </Collapse>
    </div>
  )

  const renderStrategyHelp = () => (
    <div>
      <Title level={5}>🎯 Стратегии ответа:</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space>
            <CodeOutlined style={{ color: '#52c41a' }} />
            <Text strong>Статичный ответ</Text>
          </Space>
          <Paragraph>
            Возвращает фиксированный ответ для всех запросов.
            Идеально для заглушек и тестирования.
          </Paragraph>
          <Text type="secondary">Подходит для: прототипирование, демо, простые заглушки</Text>
        </Card>

        <Card>
          <Space>
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
            <Text strong>Проксирование</Text>
          </Space>
          <Paragraph>
            Перенаправляет запрос на реальный сервер.
            Все параметры и данные передаются как есть.
          </Paragraph>
          <Text type="secondary">Подходит для: интеграция с существующими API, кэширование</Text>
        </Card>

        <Card>
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <Text strong>Условный ответ</Text>
          </Space>
          <Paragraph>
            Динамический выбор ответа на основе Python кода.
            Анализирует данные запроса и возвращает подходящий ответ.
          </Paragraph>
          <Text type="secondary">Подходит для: сложная логика, A/B тесты, симуляция поведения</Text>
        </Card>
      </Space>
    </div>
  )

  const renderHeadersHelp = () => (
    <div>
      <Title level={5}>📋 HTTP заголовки в JSON формате</Title>
      
      <Alert
        message="Формат заголовков"
        description="Введите заголовки в формате JSON объекта"
        type="info"
        style={{ marginBottom: 16 }}
      />

      <Title level={5}>💡 Примеры:</Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card size="small" title="Основные заголовки">
          <pre style={{ backgroundColor: '#f6f8fa', padding: '8px', borderRadius: '4px', margin: 0 }}>
{`{
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
  "X-API-Version": "v2"
}`}
          </pre>
        </Card>

        <Card size="small" title="CORS заголовки">
          <pre style={{ backgroundColor: '#f6f8fa', padding: '8px', borderRadius: '4px', margin: 0 }}>
{`{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}`}
          </pre>
        </Card>

        <Card size="small" title="Безопасность">
          <pre style={{ backgroundColor: '#f6f8fa', padding: '8px', borderRadius: '4px', margin: 0 }}>
{`{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block"
}`}
          </pre>
        </Card>
      </Space>
    </div>
  )

  const content = {
    pathPattern: renderPathPatternHelp,
    conditional: renderConditionalHelp,
    strategy: renderStrategyHelp,
    headers: renderHeadersHelp
  }

  return content[type]()
}

export default HelpContent 