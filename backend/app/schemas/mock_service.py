from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from app.models.mock_service import ResponseStrategy, ServiceType


class ConditionalResponse(BaseModel):
    condition: str = Field(..., description="Условие на Python")
    response_type: str = Field(default="static", description="Тип ответа: static или proxy")
    response: Optional[str] = Field(None, description="Статический ответ (для response_type=static)")
    proxy_url: Optional[str] = Field(None, description="URL для проксирования (для response_type=proxy)")
    status_code: int = Field(default=200, ge=100, le=599)
    headers: Optional[Dict[str, str]] = None
    delay: float = Field(default=0.0, ge=0)
    
    @validator('response')
    def validate_static_response(cls, v, values):
        if values.get('response_type') == 'static' and not v:
            raise ValueError('Для статического ответа необходимо указать response')
        return v
    
    @validator('proxy_url')
    def validate_proxy_response(cls, v, values):
        if values.get('response_type') == 'proxy' and not v:
            raise ValueError('Для проксирования необходимо указать proxy_url')
        return v
    
    @validator('headers')
    def validate_proxy_headers(cls, v, values):
        if values.get('response_type') == 'proxy' and v:
            # Для проксирования заголовки игнорируются, но не вызываем ошибку
            # Просто логируем предупреждение
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Заголовки игнорируются в режиме проксирования")
        return v


class MockServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    path: str = Field(..., min_length=1, max_length=1000)
    methods: List[str] = Field(..., min_items=1)
    strategy: ResponseStrategy
    service_type: ServiceType = Field(default=ServiceType.REST, description="Тип сервиса: REST или SOAP")
    is_active: bool = True

    @validator('methods')
    def validate_methods(cls, v):
        allowed_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        for method in v:
            if method.upper() not in allowed_methods:
                raise ValueError(f'Недопустимый HTTP метод: {method}')
        return [method.upper() for method in v]

    @validator('path')
    def validate_path(cls, v):
        if not v.startswith('/'):
            return f'/{v}'
        return v


class MockServiceCreate(MockServiceBase):
    # Proxy настройки
    proxy_url: Optional[str] = None
    proxy_delay: float = Field(default=0.0, ge=0)
    
    # Static настройки
    static_response: Optional[str] = None
    static_status_code: int = Field(default=200, ge=100, le=599)
    static_headers: Optional[Dict[str, str]] = None
    static_delay: float = Field(default=0.0, ge=0)
    
    # Conditional настройки  
    condition_code: Optional[str] = None
    conditional_responses: Optional[List[ConditionalResponse]] = None
    conditional_delay: float = Field(default=0.0, ge=0)
    conditional_status_code: int = Field(default=200, ge=100, le=599)
    conditional_headers: Optional[Dict[str, str]] = None

    @validator('proxy_url')
    def validate_proxy_settings(cls, v, values):
        if values.get('strategy') == ResponseStrategy.PROXY and not v:
            raise ValueError('Для proxy стратегии необходимо указать proxy_url')
        return v

    @validator('static_response')
    def validate_static_settings(cls, v, values):
        if values.get('strategy') == ResponseStrategy.STATIC and not v:
            raise ValueError('Для static стратегии необходимо указать static_response')
        return v

    @validator('condition_code')
    def validate_conditional_settings(cls, v, values):
        if values.get('strategy') == ResponseStrategy.CONDITIONAL and not v:
            raise ValueError('Для conditional стратегии необходимо указать condition_code')
        return v


class MockServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    path: Optional[str] = Field(None, min_length=1, max_length=1000)
    methods: Optional[List[str]] = None
    strategy: Optional[ResponseStrategy] = None
    is_active: Optional[bool] = None
    
    # Proxy настройки
    proxy_url: Optional[str] = None
    proxy_delay: Optional[float] = Field(None, ge=0)
    
    # Static настройки
    static_response: Optional[str] = None
    static_status_code: Optional[int] = Field(None, ge=100, le=599)
    static_headers: Optional[Dict[str, str]] = None
    static_delay: Optional[float] = Field(None, ge=0)
    
    # Conditional настройки
    condition_code: Optional[str] = None
    conditional_responses: Optional[List[ConditionalResponse]] = None
    conditional_delay: Optional[float] = Field(None, ge=0)
    conditional_status_code: Optional[int] = Field(None, ge=100, le=599)
    conditional_headers: Optional[Dict[str, str]] = None

    @validator('methods')
    def validate_methods(cls, v):
        if v is None:
            return v
        allowed_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        for method in v:
            if method.upper() not in allowed_methods:
                raise ValueError(f'Недопустимый HTTP метод: {method}')
        return [method.upper() for method in v]

    @validator('path')
    def validate_path(cls, v):
        if v is None:
            return v
        if not v.startswith('/'):
            return f'/{v}'
        return v


class MockServiceResponse(MockServiceBase):
    id: int
    service_type: ServiceType
    proxy_url: Optional[str] = None
    proxy_delay: float
    static_response: Optional[str] = None
    static_status_code: int
    static_headers: Optional[Dict[str, str]] = None
    static_delay: float
    condition_code: Optional[str] = None
    conditional_responses: Optional[List[ConditionalResponse]] = None
    conditional_delay: float
    conditional_status_code: int
    conditional_headers: Optional[Dict[str, str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
 