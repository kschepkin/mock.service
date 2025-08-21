import asyncio
import httpx
import json
from typing import Dict, Any, Tuple, Optional
from fastapi import Request, Response
from app.models.mock_service import MockService, ResponseStrategy
from app.schemas.mock_service import ConditionalResponse
import time
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class MockProcessor:
    """Процессор для обработки mock запросов"""
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def process_request(self, mock_service: MockService, request: Request, 
                            body_data = None, path_params: Dict[str, str] = None, body_bytes = None) -> Tuple[int, str, Dict[str, str], Optional[Dict[str, Any]]]:
        """
        Обработка запроса согласно настройкам mock сервиса
        
        Args:
            mock_service: Конфигурация mock сервиса
            request: HTTP запрос
            body_data: Тело запроса (строка или байты)
            path_params: Извлеченные параметры из пути
            body_bytes: Оригинальные байты тела запроса (для проксирования в условной стратегии)
        
        Returns:
            Tuple[int, str, Dict[str, str], Optional[Dict[str, Any]]]: (status_code, response_body, headers, proxy_info)
        """
        if path_params is None:
            path_params = {}
            
        start_time = time.time()
        
        try:
            if mock_service.strategy == ResponseStrategy.PROXY:
                return await self._process_proxy(mock_service, request, body_data, path_params)
            elif mock_service.strategy == ResponseStrategy.STATIC:
                return await self._process_static(mock_service, request)
            elif mock_service.strategy == ResponseStrategy.CONDITIONAL:
                # Для conditional всегда нужна строка для условий, а для проксирования — оригинальные байты
                if body_data is None:
                    body_str = None
                elif isinstance(body_data, str):
                    body_str = body_data
                elif isinstance(body_data, bytes):
                    body_str = body_data.decode('utf-8', errors='ignore')
                else:
                    body_str = str(body_data)
                return await self._process_conditional(mock_service, request, body_str, path_params, body_bytes)
            else:
                return 500, "Неизвестная стратегия", {}, None
                
        except Exception as e:
            logger.error(f"Ошибка при обработке запроса: {e}")
            return 500, f"Ошибка сервера: {str(e)}", {}, None
    
    async def _process_proxy(self, mock_service: MockService, request: Request, 
                           body_data = None, path_params: Dict[str, str] = None) -> Tuple[int, str, Dict[str, str], Dict[str, Any]]:
        """Обработка proxy стратегии с поддержкой path параметров"""
        if not mock_service.proxy_url:
            return 500, "Не указан proxy_url", {}, None
        
        # Применяем задержку если задана
        if mock_service.proxy_delay > 0:
            await asyncio.sleep(mock_service.proxy_delay)
        
        proxy_start_time = time.time()
        
        try:
            # Правильно обрабатываем тело запроса
            if body_data is not None:
                # Если body_data передан, проверяем тип
                if isinstance(body_data, str):
                    body = body_data.encode('utf-8')
                elif isinstance(body_data, bytes):
                    body = body_data
                else:
                    body = str(body_data).encode('utf-8')
            else:
                # Читаем сырые байты без декодирования
                body = await request.body()
            
            # Формируем URL для проксирования
            # По умолчанию НЕ добавляем путь из mock сервиса к URL проксирования
            # Исключение: если в proxy_url есть параметры, которые совпадают с path параметрами
            proxy_url = self._build_proxy_url(
                mock_service.proxy_url,
                mock_service.path,
                request.url.path,
                path_params or {},
                request.url.query
            )
            
            # Подготавливаем заголовки - проксируем ВСЕ заголовки без изменений
            headers = {}
            # Исключаем только заголовки, которые httpx установит автоматически
            excluded_headers = {
                'content-length',  # httpx сам вычислит корректную длину
                'host'             # httpx сам установит корректный host для целевого URL
            }
            
            for key, value in request.headers.items():
                if key.lower() not in excluded_headers:
                    headers[key] = value
            
            # НЕ модифицируем Host - пусть httpx сам устанавливает корректный
            # НЕ добавляем авторизацию из URL - может конфликтовать с существующей
            
            logger.info(f"Проксирование: {request.method} {proxy_url}")
            logger.debug(f"Заголовки отправки: {dict(headers)}")
            logger.debug(f"Path параметры: {path_params}")
            logger.debug(f"Размер тела: {len(body)} байт")
            logger.debug(f"Accept-Encoding в запросе: {headers.get('accept-encoding', 'не задан')}")
            
            # Выполняем запрос к внешнему сервису
            response = await self.http_client.request(
                method=request.method,
                url=proxy_url,
                headers=headers,
                content=body,
                follow_redirects=True,
                timeout=30.0
            )
            
            proxy_time = time.time() - proxy_start_time
            
            # Подготавливаем заголовки ответа - проксируем ВСЕ заголовки без изменений
            response_headers = {}
            # Исключаем только те заголовки, которые FastAPI должен контролировать сам
            excluded_response_headers = {
                'content-length',      # FastAPI автоматически вычислит корректную длину
                'transfer-encoding',   # FastAPI сам управляет кодировкой передачи
                'connection',          # FastAPI сам управляет соединением
                'content-encoding'     # httpx уже декодировал сжатый контент, убираем этот заголовок
            }
            
            for key, value in response.headers.items():
                if key.lower() not in excluded_response_headers:
                    response_headers[key] = value
            
            # Правильно обрабатываем тело ответа
            try:
                # httpx автоматически декодирует gzip/deflate, используем .text для текстового контента
                response_body = response.text
            except Exception as decode_error:
                logger.warning(f"Не удалось декодировать ответ как текст: {decode_error}")
                # Fallback - возвращаем как бинарные данные
                response_body = response.content.decode('utf-8', errors='ignore')
            
            logger.info(f"Ответ от целевого сервера: {response.status_code}")
            logger.debug(f"Заголовки ответа: {dict(response_headers)}")
            logger.debug(f"Content-Type: {response.headers.get('content-type', 'не задан')}")
            logger.debug(f"Исходный Content-Encoding: {response.headers.get('content-encoding', 'нет')}")
            
            # Собираем информацию о проксировании для логов
            proxy_info = {
                "target_url": str(proxy_url),
                "proxy_headers": dict(headers),
                "proxy_response_status": response.status_code,
                "proxy_response_headers": dict(response.headers),
                "proxy_response_body": response_body,
                "proxy_time": round(proxy_time, 3),
                "proxy_error": None
            }
            
            return response.status_code, response_body, response_headers, proxy_info
            
        except httpx.RequestError as e:
            proxy_time = time.time() - proxy_start_time
            error_msg = f"Ошибка соединения с внешним сервисом: {str(e)}"
            
            # Собираем информацию об ошибке проксирования
            proxy_info = {
                "target_url": str(proxy_url) if 'proxy_url' in locals() else mock_service.proxy_url,
                "proxy_headers": dict(headers) if 'headers' in locals() else {},
                "proxy_response_status": None,
                "proxy_response_headers": {},
                "proxy_response_body": "",
                "proxy_time": round(proxy_time, 3),
                "proxy_error": str(e)
            }
            
            logger.error(f"Ошибка proxy запроса: {e}")
            return 502, error_msg, {}, proxy_info
        except Exception as e:
            proxy_time = time.time() - proxy_start_time
            error_msg = f"Внутренняя ошибка proxy: {str(e)}"
            
            # Собираем информацию об ошибке проксирования
            proxy_info = {
                "target_url": str(proxy_url) if 'proxy_url' in locals() else mock_service.proxy_url,
                "proxy_headers": dict(headers) if 'headers' in locals() else {},
                "proxy_response_status": None,
                "proxy_response_headers": {},
                "proxy_response_body": "",
                "proxy_time": round(proxy_time, 3),
                "proxy_error": str(e)
            }
            
            logger.error(f"Общая ошибка proxy: {e}")
            return 500, error_msg, {}, proxy_info
    
    def _build_proxy_url(self, proxy_url: str, mock_path: str, request_path: str, 
                         path_params: Dict[str, str], query_string: str = None) -> str:
        """
        Строит URL для проксирования с поддержкой подстановки параметров:
        - Path параметры из URL (например, {id})
        - Переменные из Python скрипта в условном режиме
        - Query параметры из запроса
        
        Args:
            proxy_url: URL для проксирования
            mock_path: Путь mock сервиса
            request_path: Фактический путь запроса
            path_params: Извлеченные параметры из пути и переменные из Python скрипта
            query_string: Строка запроса
            
        Returns:
            str: Полный URL для проксирования с подставленными параметрами
        """
        try:
            # Проверяем, есть ли в proxy_url параметры для подстановки
            proxy_has_params = any(f"{{{param}}}" in proxy_url for param in path_params.keys())
            
            if proxy_has_params:
                # Если в proxy_url есть параметры, подставляем их значения
                target_url = proxy_url
                for param_name, param_value in path_params.items():
                    placeholder = f"{{{param_name}}}"
                    if placeholder in target_url:
                        target_url = target_url.replace(placeholder, str(param_value))
                        logger.debug(f"Подставляем параметр {param_name}={param_value}")
                
                logger.info(f"Проксирование с параметрами: {proxy_url} + {path_params} → {target_url}")
            else:
                # По умолчанию используем proxy_url как есть, без добавления пути
                target_url = proxy_url.rstrip('/')
                
                # Добавляем путь из запроса только если он отличается от пути mock сервиса
                # Это нужно для случаев, когда mock сервис настроен на конкретный путь
                if request_path != mock_path:
                    # Извлекаем часть пути, которая не совпадает с mock_path
                    additional_path = self._extract_additional_path(mock_path, request_path)
                    if additional_path:
                        target_url += additional_path
                
                logger.info(f"Проксирование без параметров: {proxy_url} → {target_url}")
            
            # Добавляем query параметры если есть
            if query_string:
                target_url += f"?{query_string}"
            
            return target_url
            
        except Exception as e:
            logger.error(f"Ошибка построения proxy URL: {e}")
            # В случае ошибки возвращаем proxy_url как есть
            return proxy_url + (f"?{query_string}" if query_string else "")
    
    def _extract_additional_path(self, mock_path: str, request_path: str) -> str:
        """
        Извлекает дополнительную часть пути из запроса, которая не покрывается mock_path
        
        Args:
            mock_path: Путь mock сервиса
            request_path: Фактический путь запроса
            
        Returns:
            str: Дополнительная часть пути или пустая строка
        """
        try:
            # Нормализуем пути
            mock_path = mock_path.rstrip('/')
            request_path = request_path.rstrip('/')
            
            # Если пути одинаковые, дополнительной части нет
            if mock_path == request_path:
                return ""
            
            # Если request_path начинается с mock_path, извлекаем остаток
            if request_path.startswith(mock_path):
                additional = request_path[len(mock_path):]
                return additional if additional.startswith('/') else f"/{additional}"
            
            # Если пути не совпадают, возвращаем весь request_path
            return request_path
            
        except Exception as e:
            logger.error(f"Ошибка извлечения дополнительного пути: {e}")
            return ""
    
    def _substitute_path_params(self, template_path: str, actual_path: str, path_params: Dict[str, str]) -> str:
        """
        Подставляет значения path параметров для создания целевого пути
        
        Args:
            template_path: Шаблон пути mock сервиса, например "/api/users/{id}"
            actual_path: Фактический путь запроса, например "/api/users/123"
            path_params: Извлеченные параметры, например {"id": "123"}
            
        Returns:
            str: Путь для проксирования
        """
        try:
            # Если нет параметров, возвращаем фактический путь
            if not path_params:
                return actual_path
            
            # Строим целевой путь, заменяя параметры в шаблоне на их значения
            target_path = template_path
            for param_name, param_value in path_params.items():
                target_path = target_path.replace(f"{{{param_name}}}", param_value)
            
            logger.info(f"Трансформация пути: {template_path} + {path_params} → {target_path}")
            return target_path
            
        except Exception as e:
            logger.error(f"Ошибка подстановки параметров пути: {e}")
            # В случае ошибки возвращаем фактический путь
            return actual_path
    
    async def _process_static(self, mock_service: MockService, request: Request) -> Tuple[int, str, Dict[str, str], None]:
        """Обработка статичной стратегии"""
        # Применяем задержку если задана
        if mock_service.static_delay > 0:
            await asyncio.sleep(mock_service.static_delay)
        
        # Подготавливаем заголовки
        headers = mock_service.static_headers or {}
        
        return (
            mock_service.static_status_code,
            mock_service.static_response or "",
            headers,
            None  # Нет информации о проксировании для статичных ответов
        )
    
    async def _process_conditional(self, mock_service: MockService, request: Request, 
                                 body_str: str = None, path_params: Dict[str, str] = None, body_bytes = None) -> Tuple[int, str, Dict[str, str], Optional[Dict[str, Any]]]:
        """Обработка условной стратегии с поддержкой path параметров"""
        logger.info(f"Начинаем обработку условной стратегии для сервиса {mock_service.id}")
        
        if path_params is None:
            path_params = {}
        
        # Применяем задержку если задана
        if mock_service.conditional_delay > 0:
            await asyncio.sleep(mock_service.conditional_delay)
        
        # Получаем данные запроса для выполнения условий
        request_data = await self._prepare_request_data(request, body_str)
        logger.info(f"Данные запроса подготовлены: {request_data}")
        logger.info(f"Path параметры: {path_params}")
        
        # Выполняем условный код если есть
        if mock_service.condition_code and mock_service.conditional_responses:
            logger.info(f"Код условий: {mock_service.condition_code}")
            logger.info(f"Количество вариантов ответов: {len(mock_service.conditional_responses) if mock_service.conditional_responses else 0}")
            
            try:
                # Создаем безопасное окружение для выполнения кода с основными встроенными функциями
                safe_builtins = {
                    'int': int,
                    'str': str,
                    'float': float,
                    'bool': bool,
                    'len': len,
                    'max': max,
                    'min': min,
                    'sum': sum,
                    'abs': abs,
                    'round': round,
                    'sorted': sorted,
                    'reversed': reversed,
                    'enumerate': enumerate,
                    'zip': zip,
                    'range': range,
                    'list': list,
                    'dict': dict,
                    'set': set,
                    'tuple': tuple,
                    'any': any,
                    'all': all,
                    'True': True,
                    'False': False,
                    'None': None,
                    # Добавляем JSON-совместимые булевы значения
                    'true': True,
                    'false': False,
                    'null': None,
                }
                
                context = {
                    'request': request_data,
                    'headers': request_data.get('headers', {}),
                    'query': request_data.get('query_params', {}),
                    'body': request_data.get('body', ''),
                    'method': request_data.get('method', ''),
                    'path': request_data.get('path', ''),
                    'path_params': path_params,  # Добавляем path параметры в контекст
                    'json': None
                }
                
                logger.info(f"Контекст создан: query={context['query']}, method={context['method']}, path={context['path']}, path_params={context['path_params']}")
                
                # Пытаемся распарсить JSON из body
                try:
                    if request_data.get('body'):
                        context['json'] = json.loads(request_data['body'])
                        logger.info(f"JSON распарсен: {context['json']}")
                except Exception as e:
                    logger.info(f"Не удалось распарсить JSON: {e}")
                    pass
                
                # Выполняем код условий с безопасными встроенными функциями
                logger.info("Выполняем код условий...")
                exec(mock_service.condition_code, {"__builtins__": safe_builtins}, context)
                logger.info(f"Код условий выполнен успешно. Обновленный контекст: {list(context.keys())}")
                
                # Ищем подходящий ответ
                logger.info("Проверяем варианты ответов...")
                for i, resp_data in enumerate(mock_service.conditional_responses):
                    logger.info(f"Проверяем вариант {i}: {resp_data}")
                    
                    # Проверяем что resp_data не None
                    if resp_data is None:
                        logger.error(f"Вариант ответа {i} равен None!")
                        continue
                        
                    try:
                        condition_text = resp_data.get('condition') if resp_data else None
                        if condition_text is None:
                            logger.error(f"Условие в варианте {i} равно None!")
                            continue
                            
                        logger.info(f"Выполняем условие: {condition_text}")
                        condition_result = eval(condition_text, {"__builtins__": safe_builtins}, context)
                        logger.info(f"Результат условия '{condition_text}': {condition_result}")
                        
                        if condition_result:
                            logger.info(f"Условие {i} сработало! Возвращаем ответ.")
                            # Применяем задержку если задана для этого ответа
                            if resp_data.get('delay', 0) > 0:
                                await asyncio.sleep(resp_data['delay'])
                            
                            # Безопасно получаем заголовки - если None, то пустой словарь
                            headers = resp_data.get('headers') or {}
                            
                            # Проверяем тип ответа
                            response_type = resp_data.get('response_type', 'static')
                            
                            if response_type == 'proxy':
                                # Проксируем запрос
                                proxy_url = resp_data.get('proxy_url')
                                if proxy_url:
                                    logger.info(f"Проксируем запрос на {proxy_url}")
                                    
                                    # Подготавливаем расширенные параметры для подстановки
                                    # Объединяем path_params с переменными из контекста выполнения
                                    extended_params = path_params.copy()
                                    
                                    # Добавляем переменные из контекста выполнения Python скрипта
                                    # Исключаем служебные переменные
                                    excluded_vars = {
                                        'request', 'headers', 'query', 'body', 'method', 'path', 'json',
                                        '__builtins__', '__name__', '__doc__', '__package__'
                                    }
                                    
                                    for var_name, var_value in context.items():
                                        if var_name not in excluded_vars and not var_name.startswith('_'):
                                            # Преобразуем значение в строку для подстановки
                                            if var_value is not None:
                                                extended_params[var_name] = str(var_value)
                                    
                                    logger.info(f"Расширенные параметры для подстановки: {extended_params}")
                                    
                                    return await self._proxy_conditional_request(
                                        proxy_url, request, body_bytes, extended_params
                                    )
                                else:
                                    logger.error("Не указан proxy_url для проксирования")
                                    return 500, "Ошибка конфигурации: не указан proxy_url", {}, None
                            else:
                                # Статический ответ
                                response_body = self._process_response_template(
                                    resp_data.get('response', ''), 
                                    context, 
                                    safe_builtins
                                )
                                
                                return (
                                    resp_data.get('status_code', 200),
                                    response_body,
                                    headers,
                                    None  # Нет информации о проксировании для статических ответов
                                )
                    except Exception as e:
                        logger.error(f"Ошибка при выполнении условия '{resp_data.get('condition') if resp_data else 'None'}': {e}")
                        continue
                
                # Если ни одно условие не сработало, возвращаем дефолтный ответ
                logger.info("Ни одно условие не сработало, возвращаем дефолтный ответ")
                return (
                    mock_service.conditional_status_code,
                    "Ни одно условие не выполнено",
                    mock_service.conditional_headers or {},
                    None  # Нет информации о проксировании для дефолтного ответа
                )
                
            except Exception as e:
                logger.error(f"Ошибка при выполнении условного кода: {e}")
                return 500, f"Ошибка выполнения условного кода: {str(e)}", {}, None
        
        # Если нет условий, возвращаем дефолтный ответ
        logger.info("Нет кода условий или вариантов ответов")
        return (
            mock_service.conditional_status_code,
            "Нет условий для обработки",
            mock_service.conditional_headers or {},
            None  # Нет информации о проксировании для дефолтного ответа
        )
    
    def _process_response_template(self, response_template: str, context: Dict[str, Any], safe_builtins: Dict[str, Any]) -> str:
        """
        Обрабатывает шаблон ответа, выполняя Python код если нужно
        
        Args:
            response_template: Шаблон ответа, возможно содержащий Python код
            context: Контекст выполнения с переменными
            safe_builtins: Безопасные встроенные функции
            
        Returns:
            str: Обработанный ответ
        """
        try:
            # Проверяем, содержит ли ответ Python выражения
            # Простая эвристика: если содержит переменные из контекста или операторы Python
            contains_python = any([
                var in response_template for var in context.keys()
                if var not in ['request', 'headers', 'query', 'body', 'method', 'path', 'json']
            ]) or any([
                op in response_template for op in [' + ', ' - ', ' * ', ' / ', 'str(', 'int(', 'float(']
            ])
            
            if contains_python:
                logger.info(f"Обнаружен Python код в ответе, выполняем: {response_template}")
                
                # Создаем локальную копию контекста для безопасности
                local_context = context.copy()
                
                # Проверяем, является ли ответ JSON-подобным
                if response_template.strip().startswith('{') and response_template.strip().endswith('}'):
                    # Для JSON используем специальную обработку
                    try:
                        # Выполняем как Python словарь
                        result_dict = eval(response_template, {"__builtins__": safe_builtins}, local_context)
                        # Конвертируем обратно в JSON
                        result = json.dumps(result_dict, ensure_ascii=False)
                    except Exception as json_error:
                        logger.error(f"Ошибка обработки JSON шаблона: {json_error}")
                        # Fallback: пытаемся заменить переменные напрямую
                        result = response_template
                        for var_name, var_value in local_context.items():
                            if var_name not in ['request', 'headers', 'query', 'body', 'method', 'path', 'json']:
                                result = result.replace(str(var_name), str(var_value))
                else:
                    # Для не-JSON ответов используем eval напрямую
                    result = eval(response_template, {"__builtins__": safe_builtins}, local_context)
                    if not isinstance(result, str):
                        result = str(result)
                
                logger.info(f"Результат выполнения шаблона: {result}")
                return result
            else:
                # Если нет Python кода, возвращаем как есть
                return response_template
                
        except Exception as e:
            logger.error(f"Ошибка обработки шаблона ответа: {e}")
            # В случае ошибки возвращаем исходный шаблон
            return response_template
    
    async def _prepare_request_data(self, request: Request, body_str: str = None) -> Dict[str, Any]:
        """Подготавливает данные запроса для использования в условиях"""
        # Используем переданное тело запроса или читаем если не передано
        if body_str is not None:
            body = body_str
        else:
            body_bytes = await request.body()
            body = body_bytes.decode('utf-8') if body_bytes else ''
        
        return {
            'method': request.method,
            'path': request.url.path,
            'query_params': dict(request.query_params),
            'headers': dict(request.headers),
            'body': body,
            'url': str(request.url)
        }
    
    async def _proxy_conditional_request(self, proxy_url: str, request: Request, 
                                       body_data = None, path_params: Dict[str, str] = None) -> Tuple[int, str, Dict[str, str], Dict[str, Any]]:
        """
        Проксирование запроса в условном ответе
        
        Args:
            proxy_url: URL для проксирования
            request: Исходный запрос
            body_data: Тело запроса
            path_params: Path параметры для подстановки
            
        Returns:
            Tuple[int, str, Dict[str, str], Dict[str, Any]]: (status_code, response_body, headers, proxy_info)
        """
        proxy_start_time = time.time()
        
        try:
            # Подготавливаем заголовки для проксирования - копируем ВСЕ заголовки из исходного запроса
            proxy_headers = {}
            
            # Исключаем только заголовки, которые httpx установит автоматически
            excluded_headers = {
                'content-length',  # httpx сам вычислит корректную длину
                'host'             # httpx сам установит корректный host для целевого URL
            }
            
            for key, value in request.headers.items():
                if key.lower() not in excluded_headers:
                    proxy_headers[key] = value
            
            # Подготавливаем URL для проксирования с подстановкой параметров
            # Используем тот же метод что и для обычного проксирования
            if path_params is None:
                path_params = {}
                
            target_url = self._build_proxy_url(
                proxy_url,
                request.url.path,  # Используем текущий путь как mock_path
                request.url.path,  # И как request_path
                path_params,
                request.url.query
            )
            
            logger.info(f"Проксируем условный запрос: {request.method} {target_url}")
            logger.debug(f"Исходный proxy_url: {proxy_url}")
            logger.debug(f"Path параметры: {path_params}")
            logger.debug(f"Заголовки для проксирования: {proxy_headers}")
            
            # Подготавливаем тело запроса
            if body_data is not None:
                if isinstance(body_data, str):
                    content = body_data.encode('utf-8')
                elif isinstance(body_data, bytes):
                    content = body_data
                else:
                    content = str(body_data).encode('utf-8')
            else:
                # Читаем сырые байты без декодирования
                content = await request.body()
            
            # Выполняем проксирование
            proxy_response = await self.http_client.request(
                method=request.method,
                url=target_url,
                headers=proxy_headers,
                content=content,
                follow_redirects=True,
                timeout=30.0
            )
            
            proxy_time = time.time() - proxy_start_time
            
            # Обрабатываем ответ аналогично обычному проксированию
            try:
                # httpx автоматически декодирует gzip/deflate, используем .text
                response_content = proxy_response.text
            except Exception as decode_error:
                logger.warning(f"Не удалось декодировать условный ответ как текст: {decode_error}")
                response_content = proxy_response.content.decode('utf-8', errors='ignore')
            
            # Подготавливаем заголовки ответа - проксируем ВСЕ заголовки без изменений
            response_headers = {}
            # Исключаем только те заголовки, которые FastAPI должен контролировать сам
            excluded_response_headers = {
                'content-length',      # FastAPI автоматически вычислит корректную длину
                'transfer-encoding',   # FastAPI сам управляет кодировкой передачи
                'connection',          # FastAPI сам управляет соединением
                'content-encoding'     # httpx уже декодировал сжатый контент, убираем этот заголовок
            }
            
            for key, value in proxy_response.headers.items():
                if key.lower() not in excluded_response_headers:
                    response_headers[key] = value
            
            logger.info(f"Условное проксирование выполнено: {proxy_response.status_code}")
            logger.debug(f"Исходный Content-Encoding: {proxy_response.headers.get('content-encoding', 'нет')}")
            
            # Собираем информацию о проксировании для логов
            proxy_info = {
                "target_url": str(target_url),
                "proxy_headers": dict(proxy_headers),
                "proxy_response_status": proxy_response.status_code,
                "proxy_response_headers": dict(proxy_response.headers),
                "proxy_response_body": response_content,
                "proxy_time": round(proxy_time, 3),
                "proxy_error": None
            }
            
            return (
                proxy_response.status_code,
                response_content,
                response_headers,
                proxy_info
            )
            
        except Exception as e:
            proxy_time = time.time() - proxy_start_time
            error_msg = f"Ошибка проксирования: {str(e)}"
            
            # Собираем информацию об ошибке проксирования
            proxy_info = {
                "target_url": str(target_url) if 'target_url' in locals() else proxy_url,
                "proxy_headers": dict(proxy_headers) if 'proxy_headers' in locals() else {},
                "proxy_response_status": None,
                "proxy_response_headers": {},
                "proxy_response_body": "",
                "proxy_time": round(proxy_time, 3),
                "proxy_error": str(e)
            }
            
            logger.error(f"Ошибка при условном проксировании на {proxy_url}: {e}")
            return 500, error_msg, {}, proxy_info

    async def close(self):
        """Закрытие HTTP клиента"""
        await self.http_client.aclose() 