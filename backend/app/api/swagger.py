from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.swagger_service import SwaggerService, SwaggerImportResult
from ..services.mock_service import MockServiceService
from ..schemas.mock_service import MockServiceCreate, MockServiceResponse
from ..schemas.swagger import SwaggerContentRequest, SwaggerImportRequest

router = APIRouter(prefix="/api/swagger", tags=["swagger"])

swagger_service = SwaggerService()

@router.post("/parse", response_model=SwaggerImportResult)
async def parse_swagger_file(
    file: UploadFile = File(...),
    content_type: Optional[str] = None
):
    """Парсит загруженный Swagger/OpenAPI файл"""
    try:
        # Читаем содержимое файла
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Определяем тип контента
        if content_type is None:
            if file.filename and (file.filename.endswith('.yaml') or file.filename.endswith('.yml')):
                content_type = 'yaml'
            else:
                content_type = 'json'
        
        # Парсим файл
        result = swagger_service.parse_swagger_content(content_str, content_type)
        
        return result
        
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать файл. Убедитесь, что файл в кодировке UTF-8"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка обработки файла: {str(e)}"
        )

@router.post("/parse-content", response_model=SwaggerImportResult)
async def parse_swagger_content(request: SwaggerContentRequest):
    """Парсит Swagger/OpenAPI контент из строки"""
    try:
        result = swagger_service.parse_swagger_content(request.content, request.content_type)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка парсинга контента: {str(e)}"
        )

@router.post("/import", response_model=List[MockServiceResponse])
async def import_swagger_as_mocks(
    file: UploadFile = File(...),
    base_path: str = "/api",
    content_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Импортирует Swagger файл и создает mock сервисы"""
    try:
        # Парсим файл
        content = await file.read()
        content_str = content.decode('utf-8')
        
        if content_type is None:
            if file.filename and (file.filename.endswith('.yaml') or file.filename.endswith('.yml')):
                content_type = 'yaml'
            else:
                content_type = 'json'
        
        # Парсим Swagger
        swagger_result = swagger_service.parse_swagger_content(content_str, content_type)
        
        if swagger_result.errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Ошибки в Swagger файле",
                    "errors": swagger_result.errors
                }
            )
        
        # Генерируем mock сервисы
        mock_services_data = swagger_service.generate_mock_services(swagger_result, base_path)
        
        # Сохраняем в базу данных
        mock_service_service = MockServiceService(db)
        created_services = []
        
        for mock_data in mock_services_data:
            try:
                created_service = await mock_service_service.create_mock_service(mock_data)
                created_services.append(created_service)
            except Exception as e:
                # Если сервис уже существует или другая ошибка, пропускаем
                print(f"Ошибка создания сервиса {mock_data.name}: {str(e)}")
                continue
        
        return created_services
        
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать файл. Убедитесь, что файл в кодировке UTF-8"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка импорта: {str(e)}"
        )

@router.post("/import-content", response_model=List[MockServiceResponse])
async def import_swagger_content_as_mocks(
    request: SwaggerImportRequest,
    db: AsyncSession = Depends(get_db)
):
    """Импортирует Swagger контент и создает mock сервисы"""
    try:
        # Парсим Swagger
        swagger_result = swagger_service.parse_swagger_content(request.content, request.content_type)
        
        if swagger_result.errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Ошибки в Swagger контенте",
                    "errors": swagger_result.errors
                }
            )
        
        # Генерируем mock сервисы
        mock_services_data = swagger_service.generate_mock_services(swagger_result, request.base_path)
        
        # Сохраняем в базу данных
        mock_service_service = MockServiceService(db)
        created_services = []
        
        for mock_data in mock_services_data:
            try:
                created_service = await mock_service_service.create_mock_service(mock_data)
                created_services.append(created_service)
            except Exception as e:
                # Если сервис уже существует или другая ошибка, пропускаем
                print(f"Ошибка создания сервиса {mock_data.name}: {str(e)}")
                continue
        
        return created_services
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка импорта: {str(e)}"
        )

@router.post("/preview", response_model=List[MockServiceCreate])
async def preview_swagger_import(
    file: UploadFile = File(...),
    base_path: str = "/api",
    content_type: Optional[str] = None
):
    """Предварительный просмотр mock сервисов из Swagger файла"""
    try:
        # Парсим файл
        content = await file.read()
        content_str = content.decode('utf-8')
        
        if content_type is None:
            if file.filename and (file.filename.endswith('.yaml') or file.filename.endswith('.yml')):
                content_type = 'yaml'
            else:
                content_type = 'json'
        
        # Парсим Swagger
        swagger_result = swagger_service.parse_swagger_content(content_str, content_type)
        
        if swagger_result.errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Ошибки в Swagger файле",
                    "errors": swagger_result.errors
                }
            )
        
        # Генерируем mock сервисы без сохранения
        mock_services_data = swagger_service.generate_mock_services(swagger_result, base_path)
        
        return mock_services_data
        
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать файл. Убедитесь, что файл в кодировке UTF-8"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка предварительного просмотра: {str(e)}"
        )

@router.post("/preview-content", response_model=List[MockServiceCreate])
async def preview_swagger_content_import(request: SwaggerImportRequest):
    """Предварительный просмотр mock сервисов из Swagger контента"""
    try:
        # Парсим Swagger
        swagger_result = swagger_service.parse_swagger_content(request.content, request.content_type)
        
        if swagger_result.errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Ошибки в Swagger контенте",
                    "errors": swagger_result.errors
                }
            )
        
        # Генерируем mock сервисы без сохранения
        mock_services_data = swagger_service.generate_mock_services(swagger_result, request.base_path)
        
        return mock_services_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка предварительного просмотра: {str(e)}"
        ) 