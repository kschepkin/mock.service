from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.mock_service import MockServiceService
from app.services.mock_processor import MockProcessor
from app.services.file_logger import file_logger
from app.api.websocket import notify_new_log
from app.models.mock_service import ResponseStrategy
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
mock_processor = MockProcessor()


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def handle_mock_request(
    request: Request,
    path: str,
    db: AsyncSession = Depends(get_db)
):
    """Обработчик всех mock запросов"""
    start_time = time.time()
    
    # Добавляем слеш в начало пути если его нет
    if not path.startswith('/'):
        path = f'/{path}'
    
    # Читаем тело запроса один раз для использования в логах и обработке
    body_bytes = await request.body()
    body_str = body_bytes.decode('utf-8', errors='ignore') if body_bytes else ''
    
    service = MockServiceService(db)
    
    try:
        # Ищем подходящий mock сервис и извлекаем path параметры
        # Передаем тело запроса и заголовки для SOAP сервисов
        headers_dict = dict(request.headers)
        mock_service, path_params = await service.find_mock_service_by_path_and_method(path, request.method, body_str, headers_dict)
        
        if not mock_service:
            # Логируем неопознанный запрос в файл
            processing_time = time.time() - start_time
            log_entry = file_logger.log_request(
                mock_service_id=None,
                mock_service_name=None,
                path=path,
                method=request.method,
                headers=dict(request.headers),
                query_params=dict(request.query_params),
                body=body_str,
                response_status=404,
                response_body="Mock сервис не найден",
                response_headers={},
                processing_time=processing_time
            )
            
            # Уведомляем WebSocket клиентов
            await notify_new_log(log_entry)
            
            raise HTTPException(status_code=404, detail="Mock сервис не найден")
        
        # Обрабатываем запрос согласно настройкам mock сервиса
        # Для proxy передаем сырые байты, для других стратегий - строку
        if mock_service.strategy == ResponseStrategy.PROXY:
            status_code, response_body, response_headers, proxy_info = await mock_processor.process_request(
                mock_service, request, body_bytes, path_params
            )
        elif mock_service.strategy == ResponseStrategy.CONDITIONAL:
            status_code, response_body, response_headers, proxy_info = await mock_processor.process_request(
                mock_service, request, body_str, path_params, body_bytes
            )
        else:
            status_code, response_body, response_headers, proxy_info = await mock_processor.process_request(
                mock_service, request, body_str, path_params
            )
        
        # Логируем запрос в файл
        processing_time = time.time() - start_time
        log_entry = file_logger.log_request(
            mock_service_id=mock_service.id,
            mock_service_name=mock_service.name,
            path=path,
            method=request.method,
            headers=dict(request.headers),
            query_params=dict(request.query_params),
            body=body_str,
            response_status=status_code,
            response_body=response_body,
            response_headers=response_headers,
            processing_time=processing_time,
            proxy_info=proxy_info
        )
        
        # Уведомляем WebSocket клиентов
        await notify_new_log(log_entry)
        
        # Возвращаем ответ
        # Для proxy не устанавливаем media_type, чтобы не перезаписывать content-type
        if mock_service.strategy == ResponseStrategy.PROXY:
            return Response(
                content=response_body,
                status_code=status_code,
                headers=response_headers
            )
        else:
            # Для static и conditional можем установить дефолтный content-type
            return Response(
                content=response_body,
                status_code=status_code,
                headers=response_headers,
                media_type="application/json" if response_headers.get("content-type") is None else None
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обработке mock запроса: {e}")
        
        # Логируем ошибку в файл
        processing_time = time.time() - start_time
        log_entry = file_logger.log_request(
            mock_service_id=None,
            mock_service_name=None,
            path=path,
            method=request.method,
            headers=dict(request.headers),
            query_params=dict(request.query_params),
            body=body_str,
            response_status=500,
            response_body=f"Ошибка сервера: {str(e)}",
            response_headers={},
            processing_time=processing_time
        )
        
        # Уведомляем WebSocket клиентов
        await notify_new_log(log_entry)
        
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}") 