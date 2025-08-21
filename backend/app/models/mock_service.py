from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base
from enum import Enum
from typing import List, Optional, Dict, Any


class ResponseStrategy(str, Enum):
    PROXY = "proxy"
    STATIC = "static" 
    CONDITIONAL = "conditional"


class ServiceType(str, Enum):
    REST = "rest"
    SOAP = "soap"


class MockService(Base):
    __tablename__ = "mock_services"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    path = Column(String(1000), nullable=False, index=True)
    methods = Column(JSON, nullable=False)  # List[str] - HTTP методы
    strategy = Column(String(50), nullable=False)  # ResponseStrategy
    service_type = Column(String(50), default="rest")  # ServiceType - тип сервиса (REST или SOAP)
    
    # Настройки proxy стратегии
    proxy_url = Column(String(1000), nullable=True)
    proxy_delay = Column(Float, default=0.0)  # задержка в секундах для proxy
    
    # Настройки static стратегии  
    static_response = Column(Text, nullable=True)
    static_status_code = Column(Integer, default=200)
    static_headers = Column(JSON, nullable=True)  # Dict[str, str]
    static_delay = Column(Float, default=0.0)  # задержка в секундах
    
    # Настройки conditional стратегии
    condition_code = Column(Text, nullable=True)  # Python код для условий
    conditional_responses = Column(JSON, nullable=True)  # List[ConditionalResponse]
    conditional_delay = Column(Float, default=0.0)
    conditional_status_code = Column(Integer, default=200)
    conditional_headers = Column(JSON, nullable=True)
    
    # Общие настройки
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "path": self.path,
            "methods": self.methods,
            "strategy": self.strategy,
            "service_type": self.service_type,
            "proxy_url": self.proxy_url,
            "proxy_delay": self.proxy_delay,
            "static_response": self.static_response,
            "static_status_code": self.static_status_code,
            "static_headers": self.static_headers,
            "static_delay": self.static_delay,
            "condition_code": self.condition_code,
            "conditional_responses": self.conditional_responses,
            "conditional_delay": self.conditional_delay,
            "conditional_status_code": self.conditional_status_code,
            "conditional_headers": self.conditional_headers,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
 