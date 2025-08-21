import json
import yaml
import random
from typing import Dict, List, Any, Optional, Union
from faker import Faker
from jsonschema import validate, ValidationError
from openapi_spec_validator import validate_spec
from openapi_spec_validator.readers import read_from_filename
from pydantic import BaseModel

from ..schemas.mock_service import MockServiceCreate

fake = Faker()

class SwaggerEndpoint(BaseModel):
    path: str
    method: str
    summary: Optional[str] = None
    description: Optional[str] = None
    parameters: List[Dict[str, Any]] = []
    responses: Dict[str, Dict[str, Any]] = {}
    request_body: Optional[Dict[str, Any]] = None

class SwaggerImportResult(BaseModel):
    title: str
    version: str
    base_url: Optional[str] = None
    endpoints: List[SwaggerEndpoint]
    errors: List[str] = []
    warnings: List[str] = []

class SwaggerService:
    def __init__(self):
        self.fake = Faker()
    
    def parse_swagger_content(self, content: str, content_type: str = 'json') -> SwaggerImportResult:
        """Парсит содержимое Swagger файла"""
        try:
            # Проверяем, что контент не пустой
            if not content or not content.strip():
                return SwaggerImportResult(
                    title="Empty Content",
                    version="unknown",
                    endpoints=[],
                    errors=["Содержимое файла пустое"]
                )
            
            # Парсим содержимое
            if content_type.lower() in ['yaml', 'yml']:
                spec = yaml.safe_load(content)
            else:
                spec = json.loads(content)
            
            # Проверяем что получили объект
            if not isinstance(spec, dict):
                return SwaggerImportResult(
                    title="Invalid Format",
                    version="unknown",
                    endpoints=[],
                    errors=[f"Ожидался объект, получен {type(spec).__name__}"]
                )
            
            # Базовая проверка структуры OpenAPI/Swagger
            if 'openapi' not in spec and 'swagger' not in spec:
                return SwaggerImportResult(
                    title="Not OpenAPI/Swagger",
                    version="unknown",
                    endpoints=[],
                    errors=["Файл не содержит спецификацию OpenAPI или Swagger. Ожидается поле 'openapi' или 'swagger'."]
                )
            
            # Проверяем наличие paths
            if 'paths' not in spec or not spec['paths']:
                return SwaggerImportResult(
                    title="No Paths Found",
                    version="unknown",
                    endpoints=[],
                    errors=["Спецификация не содержит раздел 'paths' или он пустой."]
                )
            
            # Валидируем спецификацию (пропускаем для Swagger 2.0)
            if 'openapi' in spec:
                try:
                    validate_spec(spec)
                except Exception as e:
                    return SwaggerImportResult(
                        title="Invalid Specification",
                        version="unknown",
                        endpoints=[],
                        errors=[f"Ошибка валидации OpenAPI: {str(e)}"]
                    )
            # Для Swagger 2.0 валидация не нужна
            
            return self._extract_endpoints(spec)
            
        except yaml.YAMLError as e:
            return SwaggerImportResult(
                title="YAML Parse Error",
                version="unknown",
                endpoints=[],
                errors=[f"Ошибка парсинга YAML: {str(e)}. Проверьте синтаксис YAML и убедитесь, что файл не поврежден."]
            )
        except json.JSONDecodeError as e:
            return SwaggerImportResult(
                title="JSON Parse Error", 
                version="unknown",
                endpoints=[],
                errors=[f"Ошибка парсинга JSON: {str(e)}. Проверьте что файл содержит валидный JSON и не пустой."]
            )
        except Exception as e:
            return SwaggerImportResult(
                title="Unknown Error",
                version="unknown", 
                endpoints=[],
                errors=[f"Неизвестная ошибка: {str(e)}"]
            )
    
    def _extract_endpoints(self, spec: Dict[str, Any]) -> SwaggerImportResult:
        """Извлекает endpoints из OpenAPI спецификации"""
        info = spec.get('info', {})
        title = info.get('title', 'Imported API')
        version = info.get('version', '1.0.0')
        
        # Извлекаем базовый URL
        base_url = None
        servers = spec.get('servers', [])
        if servers:
            base_url = servers[0].get('url', '')
        
        endpoints = []
        errors = []
        warnings = []
        
        paths = spec.get('paths', {})
        
        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
                
            for method, operation in path_item.items():
                if method.startswith('x-') or method in ['parameters', 'summary', 'description']:
                    continue
                    
                if not isinstance(operation, dict):
                    continue
                
                try:
                    endpoint = self._parse_operation(path, method.upper(), operation, spec)
                    endpoints.append(endpoint)
                except Exception as e:
                    errors.append(f"Ошибка парсинга {method.upper()} {path}: {str(e)}")
        
        return SwaggerImportResult(
            title=title,
            version=version, 
            base_url=base_url,
            endpoints=endpoints,
            errors=errors,
            warnings=warnings
        )
    
    def _parse_operation(self, path: str, method: str, operation: Dict[str, Any], spec: Dict[str, Any]) -> SwaggerEndpoint:
        """Парсит отдельную операцию"""
        summary = operation.get('summary', '')
        description = operation.get('description', '')
        
        # Парсим параметры
        parameters = []
        if 'parameters' in operation:
            for param in operation['parameters']:
                parameters.append({
                    'name': param.get('name', ''),
                    'in': param.get('in', ''),
                    'required': param.get('required', False),
                    'type': self._get_param_type(param),
                    'description': param.get('description', '')
                })
        
        # Парсим ответы
        responses = {}
        if 'responses' in operation:
            for status, response in operation['responses'].items():
                responses[status] = {
                    'description': response.get('description', ''),
                    'schema': self._extract_schema_swagger(response, spec),
                    'example': self._generate_response_example_swagger(response, spec)
                }
        
        # Парсим request body (для Swagger 2.0 это может быть в parameters)
        request_body = None
        if 'requestBody' in operation:
            # OpenAPI 3.0+
            request_body = {
                'description': operation['requestBody'].get('description', ''),
                'required': operation['requestBody'].get('required', False),
                'schema': self._extract_request_body_schema(operation['requestBody'], spec)
            }
        else:
            # Swagger 2.0 - ищем body parameter
            for param in operation.get('parameters', []):
                if param.get('in') == 'body':
                    request_body = {
                        'description': param.get('description', ''),
                        'required': param.get('required', False),
                        'schema': param.get('schema')
                    }
                    break
        
        return SwaggerEndpoint(
            path=path,
            method=method,
            summary=summary,
            description=description,
            parameters=parameters,
            responses=responses,
            request_body=request_body
        )
    
    def _get_param_type(self, param: Dict[str, Any]) -> str:
        """Получает тип параметра (поддерживает Swagger 2.0 и OpenAPI 3.0+)"""
        if 'schema' in param:
            # OpenAPI 3.0+
            return param['schema'].get('type', 'string')
        elif 'type' in param:
            # Swagger 2.0
            return param.get('type', 'string')
        else:
            return 'string'
    
    def _extract_schema(self, response: Dict[str, Any], spec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Извлекает схему из ответа OpenAPI 3.0+"""
        content = response.get('content', {})
        
        # Ищем JSON content
        for content_type in ['application/json', '*/*']:
            if content_type in content:
                schema = content[content_type].get('schema')
                if schema:
                    return self._resolve_schema_refs(schema, spec)
        
        return None
    
    def _extract_schema_swagger(self, response: Dict[str, Any], spec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Извлекает схему из ответа Swagger 2.0"""
        # В Swagger 2.0 схема находится напрямую в response
        schema = response.get('schema')
        if schema:
            return self._resolve_schema_refs(schema, spec)
        return None
    
    def _extract_request_body_schema(self, request_body: Dict[str, Any], spec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Извлекает схему из request body"""
        content = request_body.get('content', {})
        
        for content_type in ['application/json', '*/*']:
            if content_type in content:
                schema = content[content_type].get('schema')
                if schema:
                    return self._resolve_schema_refs(schema, spec)
        
        return None
    
    def _resolve_schema_refs(self, schema: Dict[str, Any], spec: Dict[str, Any]) -> Dict[str, Any]:
        """Разрешает $ref ссылки в схемах (поддерживает Swagger 2.0 и OpenAPI 3.0+)"""
        if isinstance(schema, dict) and '$ref' in schema:
            ref_path = schema['$ref']
            if ref_path.startswith('#/'):
                # Локальная ссылка
                path_parts = ref_path[2:].split('/')
                resolved = spec
                for part in path_parts:
                    resolved = resolved.get(part, {})
                if resolved:
                    return self._resolve_schema_refs(resolved, spec)
                else:
                    # Не удалось разрешить ссылку, возвращаем как есть
                    return schema
        elif isinstance(schema, dict):
            # Рекурсивно обрабатываем вложенные объекты
            resolved = {}
            for key, value in schema.items():
                if isinstance(value, dict):
                    resolved[key] = self._resolve_schema_refs(value, spec)
                elif isinstance(value, list):
                    resolved[key] = [self._resolve_schema_refs(item, spec) if isinstance(item, dict) else item for item in value]
                else:
                    resolved[key] = value
            return resolved
        
        return schema
    
    def _generate_response_example(self, response: Dict[str, Any], spec: Dict[str, Any]) -> Any:
        """Генерирует пример ответа на основе схемы OpenAPI 3.0+"""
        schema = self._extract_schema(response, spec)
        if schema:
            return self._generate_data_from_schema(schema)
        return {}
    
    def _generate_response_example_swagger(self, response: Dict[str, Any], spec: Dict[str, Any]) -> Any:
        """Генерирует пример ответа на основе схемы Swagger 2.0"""
        schema = self._extract_schema_swagger(response, spec)
        if schema:
            return self._generate_data_from_schema(schema)
        return {}
    
    def _generate_data_from_schema(self, schema: Dict[str, Any]) -> Any:
        """Генерирует данные на основе JSON схемы"""
        if not isinstance(schema, dict):
            return None
            
        schema_type = schema.get('type')
        
        if schema_type == 'object':
            result = {}
            properties = schema.get('properties', {})
            required = schema.get('required', [])
            
            for prop_name, prop_schema in properties.items():
                # Генерируем обязательные поля и случайные опциональные
                if prop_name in required or random.random() > 0.3:
                    result[prop_name] = self._generate_data_from_schema(prop_schema)
            
            return result
            
        elif schema_type == 'array':
            items_schema = schema.get('items', {})
            # Генерируем от 1 до 3 элементов
            count = random.randint(1, 3)
            return [self._generate_data_from_schema(items_schema) for _ in range(count)]
            
        elif schema_type == 'string':
            format_type = schema.get('format')
            enum_values = schema.get('enum')
            
            if enum_values:
                return random.choice(enum_values)
            elif format_type == 'email':
                return self.fake.email()
            elif format_type == 'date':
                return self.fake.date().isoformat()
            elif format_type == 'date-time':
                return self.fake.date_time().isoformat()
            elif format_type == 'uuid':
                return str(self.fake.uuid4())
            else:
                return self.fake.word()
                
        elif schema_type == 'integer':
            minimum = schema.get('minimum', 1)
            maximum = schema.get('maximum', 1000)
            return random.randint(minimum, maximum)
            
        elif schema_type == 'number':
            minimum = schema.get('minimum', 1.0)
            maximum = schema.get('maximum', 1000.0)
            return round(random.uniform(minimum, maximum), 2)
            
        elif schema_type == 'boolean':
            return random.choice([True, False])
            
        else:
            # Для неизвестных типов
            return self.fake.word()
    
    def generate_mock_services(self, swagger_result: SwaggerImportResult, base_path: str = "/api") -> List[MockServiceCreate]:
        """Генерирует mock сервисы на основе Swagger endpoints"""
        mock_services = []
        
        for endpoint in swagger_result.endpoints:
            # Формируем полный путь
            full_path = base_path.rstrip('/') + endpoint.path
            
            # Создаем имя сервиса
            name = f"{endpoint.method} {endpoint.path}"
            if endpoint.summary:
                name = f"{endpoint.summary} ({endpoint.method})"
            
            # Создаем описание
            description = endpoint.description or f"Автоматически сгенерирован из Swagger для {endpoint.method} {endpoint.path}"
            
            # Генерируем статический ответ
            static_response = self._generate_static_response(endpoint)
            static_headers = {"Content-Type": "application/json"}
            
            # Создаем mock сервис
            mock_service = MockServiceCreate(
                name=name,
                description=description,
                path=full_path,
                methods=[endpoint.method],  # Используем массив методов
                strategy="static",
                static_response=static_response,
                static_headers=static_headers,
                static_delay=0.0
            )
            
            mock_services.append(mock_service)
        
        return mock_services
    
    def _generate_static_response(self, endpoint: SwaggerEndpoint) -> str:
        """Генерирует статический ответ для endpoint"""
        # Ищем успешный ответ (200, 201, etc.)
        success_responses = {k: v for k, v in endpoint.responses.items() 
                           if k.startswith('2')}
        
        if success_responses:
            # Берем первый успешный ответ
            status, response_data = next(iter(success_responses.items()))
            example = response_data.get('example')
            
            if example is not None:
                return json.dumps(example, indent=2, ensure_ascii=False)
        
        # Если нет примера, создаем базовый ответ
        return json.dumps({
            "message": "Успешный ответ",
            "data": {},
            "timestamp": "2024-01-01T00:00:00Z"
        }, indent=2, ensure_ascii=False) 