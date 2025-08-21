import json
import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
import glob
import re


@dataclass
class RequestLogEntry:
    """Структура лога запроса"""
    id: str
    mock_service_id: Optional[int]
    mock_service_name: Optional[str]
    path: str
    method: str
    headers: Dict[str, Any]
    query_params: Dict[str, Any]
    body: str
    response_status: Optional[int]
    response_body: str
    response_headers: Dict[str, str]
    processing_time: float
    timestamp: str
    # Дополнительная информация для проксирования
    proxy_info: Optional[Dict[str, Any]] = None  # Информация о проксировании

    def to_dict(self):
        return asdict(self)


def parse_size(size_str: str) -> int:
    """Парсинг размера из строки типа '10MB', '1GB'"""
    size_str = size_str.upper().strip()
    if size_str.endswith('KB'):
        return int(size_str[:-2]) * 1024
    elif size_str.endswith('MB'):
        return int(size_str[:-2]) * 1024 * 1024
    elif size_str.endswith('GB'):
        return int(size_str[:-2]) * 1024 * 1024 * 1024
    else:
        return int(size_str)  # Считаем байтами


class FileLogger:
    """Файловый логгер с ротацией для запросов к mock сервисам"""
    
    def __init__(self, logs_dir: str = None, max_bytes: int = None, backup_count: int = None, 
                 rotation_time: str = None):
        """
        Инициализация файлового логгера
        
        Args:
            logs_dir: Директория для файлов логов
            max_bytes: Максимальный размер файла лога
            backup_count: Количество архивных файлов
            rotation_time: Интервал ротации по времени (1d, 12h, 1w)
        """
        # Получаем настройки из переменных окружения
        self.logs_dir = logs_dir or os.getenv("LOG_DIR", "logs")
        
        # Парсим размер лога
        max_size_env = os.getenv("LOG_MAX_SIZE", "50MB")
        self.max_bytes = max_bytes or parse_size(max_size_env)
        
        self.backup_count = backup_count or int(os.getenv("LOG_BACKUP_COUNT", "10"))
        self.rotation_time = rotation_time or os.getenv("LOG_ROTATION_TIME", None)
        
        # Создаем директорию если не существует
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Настраиваем ротирующий файловый обработчик
        log_file_path = os.path.join(self.logs_dir, "requests.log")
        self._setup_logger(log_file_path)
        
    def _setup_logger(self, log_file_path: str):
        """Настройка логгера с ротацией"""
        self.logger = logging.getLogger("mock_requests")
        self.logger.setLevel(logging.INFO)
        
        # Убираем существующие обработчики чтобы избежать дублирования
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        
        # Выбираем тип ротации
        if self.rotation_time:
            # Ротация по времени
            when = 'midnight'
            interval = 1
            
            if self.rotation_time.endswith('d'):
                when = 'midnight'
                interval = int(self.rotation_time[:-1])
            elif self.rotation_time.endswith('h'):
                when = 'H'
                interval = int(self.rotation_time[:-1])
            elif self.rotation_time.endswith('w'):
                when = 'W0'  # Monday
                interval = int(self.rotation_time[:-1])
            
            handler = TimedRotatingFileHandler(
                log_file_path,
                when=when,
                interval=interval,
                backupCount=self.backup_count,
                encoding='utf-8'
            )
        else:
            # Ротация по размеру (по умолчанию)
            handler = RotatingFileHandler(
                log_file_path,
                maxBytes=self.max_bytes,
                backupCount=self.backup_count,
                encoding='utf-8'
            )
        
        # Формат: только JSON без дополнительной информации
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        
        self.logger.addHandler(handler)
        self.logger.propagate = False  # Не передавать в родительские логгеры
    
    def log_request(self, mock_service_id: Optional[int], mock_service_name: Optional[str],
                   path: str, method: str, headers: Dict[str, Any], query_params: Dict[str, Any],
                   body: str, response_status: int, response_body: str, 
                   response_headers: Dict[str, str], processing_time: float,
                   proxy_info: Optional[Dict[str, Any]] = None) -> RequestLogEntry:
        """
        Логирование запроса в файл
        
        Args:
            proxy_info: Дополнительная информация о проксировании (для proxy запросов)
                {
                    "target_url": "https://api.example.com/endpoint",
                    "proxy_headers": {"header": "value"},
                    "proxy_response_status": 200,
                    "proxy_response_headers": {"header": "value"},
                    "proxy_response_body": "response content",
                    "proxy_time": 0.5,
                    "proxy_error": "error message if any"
                }
        
        Returns:
            RequestLogEntry: Объект с данными лога
        """
        # Генерируем уникальный ID для лога
        log_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        log_entry = RequestLogEntry(
            id=log_id,
            mock_service_id=mock_service_id,
            mock_service_name=mock_service_name,
            path=path,
            method=method,
            headers=headers,
            query_params=query_params,
            body=body,
            response_status=response_status,
            response_body=response_body,
            response_headers=response_headers,
            processing_time=processing_time,
            timestamp=datetime.now().isoformat(),
            proxy_info=proxy_info
        )
        
        # Записываем в файл как JSON строку
        self.logger.info(json.dumps(log_entry.to_dict(), ensure_ascii=False))
        
        return log_entry
    
    def get_logs(self, service_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[RequestLogEntry]:
        """
        Получение логов из файлов
        
        Args:
            service_id: ID mock сервиса для фильтрации (если None - все логи)
            skip: Количество записей для пропуска
            limit: Максимальное количество записей
            
        Returns:
            List[RequestLogEntry]: Список логов
        """
        logs = []
        
        # Получаем все файлы логов (основной + архивные)
        log_files = self._get_log_files()
        
        # Читаем логи из всех файлов
        for log_file in log_files:
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            log_data = json.loads(line)
                            log_entry = RequestLogEntry(**log_data)
                            
                            # Фильтрация по service_id
                            if service_id is None or log_entry.mock_service_id == service_id:
                                logs.append(log_entry)
                        except (json.JSONDecodeError, TypeError) as e:
                            # Пропускаем некорректные строки
                            continue
            except (IOError, OSError):
                # Пропускаем файлы которые не удается прочитать
                continue
        
        # Сортируем по времени (новые сначала)
        logs.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Применяем пагинацию
        return logs[skip:skip + limit]
    
    def _get_log_files(self) -> List[str]:
        """Получение списка всех файлов логов (основной + архивные)"""
        log_files = []
        
        # Основной файл
        main_log_file = os.path.join(self.logs_dir, "requests.log")
        if os.path.exists(main_log_file):
            log_files.append(main_log_file)
        
        # Архивные файлы (requests.log.1, requests.log.2, ...)
        for i in range(1, self.backup_count + 1):
            archive_file = f"{main_log_file}.{i}"
            if os.path.exists(archive_file):
                log_files.append(archive_file)
        
        return log_files
    
    def get_log_files_info(self) -> List[Dict[str, Any]]:
        """Получение информации о файлах логов"""
        files_info = []
        
        for log_file in self._get_log_files():
            try:
                stat = os.stat(log_file)
                files_info.append({
                    "file": os.path.basename(log_file),
                    "size_bytes": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "max_size_mb": round(self.max_bytes / (1024 * 1024), 2),
                    "backup_count": self.backup_count,
                    "rotation_type": "time" if self.rotation_time else "size"
                })
            except (IOError, OSError):
                continue
        
        return files_info


# Глобальный экземпляр логгера
file_logger = FileLogger() 