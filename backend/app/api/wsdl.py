from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from app.database import get_db
from app.services.wsdl_service import WSDLService, WSDLParseResult
from app.services.mock_service import MockServiceService
from app.schemas.mock_service import MockServiceCreate
from pydantic import BaseModel, Field, validator
import logging
import re

logger = logging.getLogger(__name__)

def clean_wsdl_url_for_proxy(wsdl_url: str) -> str:
    """
    Очищает WSDL URL от ?wsdl и .wsdl для использования как proxy URL
    
    Args:
        wsdl_url: Исходный WSDL URL
        
    Returns:
        str: Очищенный URL для проксирования
    """
    # Убираем ?wsdl из URL
    cleaned_url = re.sub(r'\?wsdl$', '', wsdl_url, flags=re.IGNORECASE)
    
    # Убираем .wsdl из URL
    cleaned_url = re.sub(r'\.wsdl$', '', cleaned_url, flags=re.IGNORECASE)
    
    return cleaned_url

router = APIRouter(prefix="/api/wsdl", tags=["WSDL"])

class WSDLParseRequest(BaseModel):
    wsdl_url: str = Field(..., description="URL WSDL документа")
    
    @validator('wsdl_url')
    def validate_wsdl_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL должен начинаться с http:// или https://')
        return v

class WSDLImportRequest(BaseModel):
    wsdl_url: str = Field(..., description="URL WSDL документа")
    base_path: str = Field(default="/soap", description="Базовый путь для эндпоинтов")
    service_prefix: str = Field(default="", description="Префикс для имен сервисов")
    
    @validator('wsdl_url')
    def validate_wsdl_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL должен начинаться с http:// или https://')
        return v
    
    @validator('base_path')
    def validate_base_path(cls, v):
        if not v.startswith('/'):
            return f'/{v}'
        return v

class WSDLOperation(BaseModel):
    name: str
    soap_action: str
    input_message: str
    output_message: str
    input_elements: List[Dict[str, Any]]
    output_elements: List[Dict[str, Any]]
    endpoint_url: str

class WSDLParseResponse(BaseModel):
    service_name: str
    target_namespace: str
    soap_address: str
    operations: List[WSDLOperation]
    errors: List[str]
    warnings: List[str]

class MockServicePreview(BaseModel):
    name: str
    path: str
    methods: List[str]
    operation_name: str
    soap_action: str
    sample_request: str
    sample_response: str
    proxy_url: str

@router.post("/parse", response_model=WSDLParseResponse)
async def parse_wsdl_url(request: WSDLParseRequest):
    """
    Парсит WSDL документ по URL и возвращает найденные операции
    """
    try:
        wsdl_service = WSDLService()
        
        logger.info(f"Начинаем парсинг WSDL: {request.wsdl_url}")
        result = await wsdl_service.parse_wsdl_from_url(request.wsdl_url)
        
        await wsdl_service.close()
        
        if result.errors:
            logger.error(f"Ошибки при парсинге WSDL: {result.errors}")
        
        return WSDLParseResponse(**result.to_dict())
        
    except Exception as e:
        logger.error(f"Ошибка при парсинге WSDL {request.wsdl_url}: {e}")
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга WSDL: {str(e)}")

@router.post("/preview", response_model=List[MockServicePreview])
async def preview_wsdl_import(request: WSDLImportRequest):
    """
    Предварительный просмотр mock сервисов которые будут созданы из WSDL
    """
    try:
        wsdl_service = WSDLService()
        
        logger.info(f"Предварительный просмотр импорта WSDL: {request.wsdl_url}")
        result = await wsdl_service.parse_wsdl_from_url(request.wsdl_url)
        
        if result.errors:
            raise HTTPException(status_code=400, detail=f"Ошибки парсинга WSDL: {', '.join(result.errors)}")
        
        previews = []
        
        for operation in result.operations:
            # Формируем путь для эндпоинта - для SOAP все запросы идут по одному эндпоинту
            if request.service_prefix:
                service_name = f"{request.service_prefix}_{operation.name}"
            else:
                service_name = f"{result.service_name}_{operation.name}"
            
            endpoint_path = request.base_path
            
            # Очищаем WSDL URL для отображения в preview
            proxy_url = clean_wsdl_url_for_proxy(request.wsdl_url)
            
            # Генерируем примеры
            sample_request = wsdl_service.generate_soap_envelope(operation)
            sample_response = wsdl_service.generate_soap_response(operation)
            
            preview = MockServicePreview(
                name=service_name,
                path=endpoint_path,
                methods=["POST"],  # SOAP всегда использует POST
                operation_name=operation.name,
                soap_action=operation.soap_action,
                sample_request=sample_request,
                sample_response=sample_response,
                proxy_url=proxy_url
            )
            
            previews.append(preview)
        
        await wsdl_service.close()
        
        logger.info(f"Создан предварительный просмотр для {len(previews)} операций")
        return previews
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании предварительного просмотра: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания предварительного просмотра: {str(e)}")

@router.post("/import", response_model=List[Dict[str, Any]])
async def import_wsdl_services(request: WSDLImportRequest, db: AsyncSession = Depends(get_db)):
    """
    Импортирует SOAP операции из WSDL как mock сервисы
    """
    try:
        wsdl_service = WSDLService()
        mock_service_service = MockServiceService(db)
        
        logger.info(f"Начинаем импорт WSDL: {request.wsdl_url}")
        result = await wsdl_service.parse_wsdl_from_url(request.wsdl_url)
        
        if result.errors:
            raise HTTPException(status_code=400, detail=f"Ошибки парсинга WSDL: {', '.join(result.errors)}")
        
        imported_services = []
        
        for operation in result.operations:
            try:
                # Формируем имя сервиса
                if request.service_prefix:
                    service_name = f"{request.service_prefix}_{operation.name}"
                else:
                    service_name = f"{result.service_name}_{operation.name}"
                
                # Формируем путь эндпоинта - для SOAP все запросы идут по одному эндпоинту
                endpoint_path = request.base_path
                
                # Очищаем WSDL URL для использования как proxy URL
                proxy_url = clean_wsdl_url_for_proxy(request.wsdl_url)
                
                # Создаем mock сервис с проксированием
                mock_data = MockServiceCreate(
                    name=service_name,
                    path=endpoint_path,
                    methods=["POST"],
                    strategy="proxy",
                    service_type="soap",  # Устанавливаем тип сервиса как SOAP
                    proxy_url=proxy_url,  # Используем очищенный URL для проксирования
                    proxy_delay=0.0,
                    is_active=True
                )
                
                # Сохраняем в БД
                mock_service = await mock_service_service.create_mock_service(mock_data)
                
                imported_services.append({
                    "id": mock_service.id,
                    "name": mock_service.name,
                    "path": mock_service.path,
                    "operation_name": operation.name,
                    "soap_action": operation.soap_action,
                    "status": "created"
                })
                
                logger.info(f"Создан mock сервис для операции {operation.name}: {mock_service.id}")
                
            except Exception as e:
                error_msg = f"Ошибка создания сервиса для операции {operation.name}: {str(e)}"
                logger.error(error_msg)
                
                imported_services.append({
                    "operation_name": operation.name,
                    "soap_action": operation.soap_action,
                    "status": "failed",
                    "error": error_msg
                })
        
        await wsdl_service.close()
        
        success_count = len([s for s in imported_services if s.get("status") == "created"])
        logger.info(f"Импорт завершен: {success_count}/{len(result.operations)} операций")
        
        return imported_services
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка импорта WSDL: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка импорта WSDL: {str(e)}")

@router.get("/test-urls")
async def get_test_wsdl_urls():
    """
    Возвращает список тестовых WSDL URLs для демонстрации
    """
    return {
        "test_urls": [
            {
                "name": "Calculator Service",
                "url": "http://www.dneonline.com/calculator.asmx?WSDL",
                "description": "Простой калькулятор с базовыми операциями"
            },
            {
                "name": "Temperature Converter",
                "url": "https://www.w3schools.com/xml/tempconvert.asmx?WSDL",
                "description": "Конвертер температуры между Celsius и Fahrenheit"
            },
            {
                "name": "Number Conversion",
                "url": "https://www.dataaccess.com/webservicesserver/numberconversion.wso?WSDL",
                "description": "Конвертация чисел в слова"
            }
        ],
        "note": "Эти URL могут быть недоступны в зависимости от состояния внешних сервисов"
    } 