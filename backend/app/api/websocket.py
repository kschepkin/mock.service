from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.mock_service import MockServiceService
from app.services.file_logger import RequestLogEntry
import json
import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

# Хранилище активных WebSocket соединений
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.service_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, service_id: int = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if service_id:
            if service_id not in self.service_connections:
                self.service_connections[service_id] = []
            self.service_connections[service_id].append(websocket)

    def disconnect(self, websocket: WebSocket, service_id: int = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if service_id and service_id in self.service_connections:
            if websocket in self.service_connections[service_id]:
                self.service_connections[service_id].remove(websocket)
            
            # Удаляем пустые списки
            if not self.service_connections[service_id]:
                del self.service_connections[service_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Ошибка отправки сообщения WebSocket: {e}")

    async def broadcast_to_all(self, message: str):
        """Отправить сообщение всем подключенным клиентам"""
        if self.active_connections:
            # Создаем задачи для всех соединений
            tasks = []
            for connection in self.active_connections[:]:  # Копируем список для безопасности
                tasks.append(self.send_personal_message(message, connection))
            
            # Выполняем все отправки параллельно
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_service(self, service_id: int, message: str):
        """Отправить сообщение всем подписчикам конкретного сервиса"""
        if service_id in self.service_connections:
            connections = self.service_connections[service_id][:]  # Копируем для безопасности
            tasks = []
            for connection in connections:
                tasks.append(self.send_personal_message(message, connection))
            
            # Выполняем все отправки параллельно
            await asyncio.gather(*tasks, return_exceptions=True)


manager = ConnectionManager()


@router.websocket("/ws/logs")
async def websocket_logs_all(websocket: WebSocket):
    """WebSocket для получения всех логов в реальном времени"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Ждем сообщения от клиента (например, ping)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Ошибка WebSocket: {e}")
        manager.disconnect(websocket)


@router.websocket("/ws/logs/{service_id}")
async def websocket_logs_service(websocket: WebSocket, service_id: int):
    """WebSocket для получения логов конкретного сервиса в реальном времени"""
    await manager.connect(websocket, service_id)
    
    try:
        while True:
            # Ждем сообщения от клиента (например, ping)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, service_id)
    except Exception as e:
        logger.error(f"Ошибка WebSocket для сервиса {service_id}: {e}")
        manager.disconnect(websocket, service_id)


async def broadcast_log_message(log_data: Dict[str, Any]):
    """Отправить лог всем подключенным клиентам"""
    message = json.dumps({
        "type": "log",
        "data": log_data,
        "timestamp": datetime.now().isoformat()
    })
    
    # Отправляем всем
    await manager.broadcast_to_all(message)
    
    # Отправляем подписчикам конкретного сервиса
    if log_data.get("mock_service_id"):
        await manager.broadcast_to_service(log_data["mock_service_id"], message)


# Функция для отправки уведомлений о новых логах
# Эта функция будет вызываться из file_logger
async def notify_new_log(log_entry: RequestLogEntry):
    """Уведомить WebSocket клиентов о новом логе"""
    try:
        # Конвертируем RequestLogEntry в dict для совместимости
        log_data = log_entry.to_dict()
        
        await broadcast_log_message(log_data)
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления о новом логе: {e}")


# Экспортируем функцию уведомлений для использования в других модулях
__all__ = ['router', 'notify_new_log'] 