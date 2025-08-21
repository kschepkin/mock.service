from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Tuple
import re
from app.models.mock_service import MockService, ServiceType
from app.schemas.mock_service import MockServiceCreate, MockServiceUpdate
from app.utils.path_parser import path_parser
from app.utils.soap_parser import SOAPParser


class MockServiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_mock_service(self, mock_data: MockServiceCreate) -> MockService:
        """Создать новый mock сервис"""
        # Валидируем шаблон пути
        is_valid, error_message = path_parser.validate_path_pattern(mock_data.path)
        if not is_valid:
            raise ValueError(f"Некорректный шаблон пути: {error_message}")
        
        mock_service = MockService(
            name=mock_data.name,
            path=mock_data.path,
            methods=mock_data.methods,
            strategy=mock_data.strategy,
            service_type=mock_data.service_type,
            proxy_url=mock_data.proxy_url,
            proxy_delay=mock_data.proxy_delay,
            static_response=mock_data.static_response,
            static_status_code=mock_data.static_status_code,
            static_headers=mock_data.static_headers,
            static_delay=mock_data.static_delay,
            condition_code=mock_data.condition_code,
            conditional_responses=[resp.dict() for resp in mock_data.conditional_responses] if mock_data.conditional_responses else None,
            conditional_delay=mock_data.conditional_delay,
            conditional_status_code=mock_data.conditional_status_code,
            conditional_headers=mock_data.conditional_headers,
            is_active=mock_data.is_active
        )
        
        self.db.add(mock_service)
        await self.db.commit()
        await self.db.refresh(mock_service)
        return mock_service

    async def get_mock_service(self, service_id: int) -> Optional[MockService]:
        """Получить mock сервис по ID"""
        result = await self.db.execute(
            select(MockService).where(MockService.id == service_id)
        )
        return result.scalar_one_or_none()

    async def get_mock_services(self, skip: int = 0, limit: int = 1000) -> List[MockService]:
        """Получить список всех mock сервисов"""
        result = await self.db.execute(
            select(MockService).offset(skip).limit(limit)
        )
        return result.scalars().all()

    async def get_active_mock_services(self) -> List[MockService]:
        """Получить список активных mock сервисов"""
        result = await self.db.execute(
            select(MockService).where(MockService.is_active == True)
        )
        return result.scalars().all()

    async def find_mock_service_by_path_and_method(self, path: str, method: str, body: str = None, headers: Dict[str, str] = None) -> Tuple[Optional[MockService], Dict[str, str]]:
        """
        Найти mock сервис по пути и методу с поддержкой параметризованных путей и SOAP методов
        
        Args:
            path: Путь запроса
            method: HTTP метод
            body: Тело запроса (для SOAP)
            headers: HTTP заголовки (для SOAP)
            
        Returns:
            Tuple[Optional[MockService], Dict[str, str]]: (сервис, извлеченные параметры)
        """
        result = await self.db.execute(
            select(MockService).where(MockService.is_active == True)
        )
        services = result.scalars().all()
        
        # Переменные для fallback варианта (SOAP сервисы без определенного метода)
        fallback_service = None
        fallback_params = {}
        
        # Ищем сервис, который поддерживает данный метод и путь
        for service in services:
            # Проверяем метод
            if method.upper() not in [m.upper() for m in service.methods]:
                continue
            
            # Проверяем путь с поддержкой параметров
            path_params = path_parser.extract_parameters(service.path, path)
            if path_params is None:
                continue
            
            # Для SOAP сервисов дополнительно проверяем метод в заголовках HTTP
            if service.service_type == ServiceType.SOAP and headers:
                soap_method = SOAPParser.extract_soap_method(headers, body)
                if soap_method:
                    # Проверяем соответствие SOAP метода с именем сервиса (улучшенная логика)
                    if self._matches_soap_service(service.name, soap_method):
                        return service, path_params
                    else:
                        # Если SOAP метод найден, но не соответствует имени сервиса, 
                        # продолжаем поиск (не строгая проверка)
                        continue
                else:
                    # Если SOAP метод не найден, возвращаем сервис (fallback)
                    # но только если нет других подходящих SOAP сервисов
                    # Сохраняем как fallback вариант
                    fallback_service = service
                    fallback_params = path_params
            
            # Для REST сервисов возвращаем сервис
            elif service.service_type == ServiceType.REST:
                return service, path_params
        
        # Если точное соответствие не найдено, возвращаем fallback вариант для SOAP
        if fallback_service:
            return fallback_service, fallback_params
        
        return None, {}
    
    def _matches_soap_service(self, service_name: str, soap_method: str) -> bool:
        """
        Проверяет соответствие SOAP метода имени сервиса
        Используется улучшенная логика сопоставления
        
        Args:
            service_name: Имя mock сервиса
            soap_method: Имя SOAP метода из запроса
            
        Returns:
            bool: True если метод соответствует сервису
        """
        if not service_name or not soap_method:
            return False
        
        service_name_lower = service_name.lower().strip()
        soap_method_lower = soap_method.lower().strip()
        
        # Простое вхождение метода в имя сервиса
        if soap_method_lower in service_name_lower:
            return True
        
        # Проверяем паттерны именования:
        # 1. ServiceName_MethodName
        if service_name_lower.endswith(f"_{soap_method_lower}"):
            return True
        
        # 2. MethodName_ServiceName  
        if service_name_lower.startswith(f"{soap_method_lower}_"):
            return True
        
        # 3. ServiceName.MethodName (с точкой)
        if service_name_lower.endswith(f".{soap_method_lower}"):
            return True
        
        # 4. MethodName.ServiceName
        if service_name_lower.startswith(f"{soap_method_lower}."):
            return True
        
        # 5. ServiceNameMethodName (без разделителей)
        if service_name_lower.endswith(soap_method_lower):
            return True
        
        if service_name_lower.startswith(soap_method_lower):
            return True
        
        # 6. Обратная проверка - имя сервиса содержится в методе
        if service_name_lower in soap_method_lower:
            return True
        
        # 7. Проверяем части имени (разделенные по _ или .)
        service_parts = re.split(r'[._-]', service_name_lower)
        soap_parts = re.split(r'[._-]', soap_method_lower)
        
        # Ищем пересечения в частях
        for service_part in service_parts:
            if service_part and len(service_part) > 2:  # Игнорируем слишком короткие части
                for soap_part in soap_parts:
                    if soap_part and len(soap_part) > 2:
                        if service_part == soap_part or service_part in soap_part or soap_part in service_part:
                            return True
        
        return False

    async def update_mock_service(self, service_id: int, mock_data: MockServiceUpdate) -> Optional[MockService]:
        """Обновить mock сервис"""
        # Получаем существующий сервис
        mock_service = await self.get_mock_service(service_id)
        if not mock_service:
            return None

        # Обновляем только переданные поля
        update_data = {}
        for field, value in mock_data.dict(exclude_unset=True).items():
            # Валидируем путь если он изменяется
            if field == 'path' and value is not None:
                is_valid, error_message = path_parser.validate_path_pattern(value)
                if not is_valid:
                    raise ValueError(f"Некорректный шаблон пути: {error_message}")
            
            if field == 'conditional_responses' and value is not None:
                # Проверяем тип данных - если это уже список словарей, оставляем как есть
                # Если это список Pydantic объектов, конвертируем в словари
                if isinstance(value, list) and len(value) > 0:
                    if hasattr(value[0], 'dict'):
                        # Это Pydantic объекты
                        update_data[field] = [resp.dict() for resp in value]
                    else:
                        # Это уже словари
                        update_data[field] = value
                else:
                    update_data[field] = value
            else:
                update_data[field] = value

        if update_data:
            await self.db.execute(
                update(MockService)
                .where(MockService.id == service_id)
                .values(**update_data)
            )
            await self.db.commit()
            
            # Получаем обновленный объект
            await self.db.refresh(mock_service)

        return mock_service

    async def delete_mock_service(self, service_id: int) -> bool:
        """Удалить mock сервис"""
        result = await self.db.execute(
            delete(MockService).where(MockService.id == service_id)
        )
        await self.db.commit()
        return result.rowcount > 0

    def get_path_parameters(self, path_pattern: str) -> List[str]:
        """Получить список параметров из шаблона пути"""
        return path_parser.extract_parameter_names(path_pattern)

 