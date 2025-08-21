from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.database import get_db
from app.services.mock_service import MockServiceService
from app.services.file_logger import file_logger, RequestLogEntry
from app.schemas.mock_service import (
    MockServiceCreate, MockServiceUpdate, MockServiceResponse
)
import os
import shutil
import glob
import time

router = APIRouter(prefix="/api/mock-services", tags=["Mock Services"])


@router.post("/", response_model=MockServiceResponse)
async def create_mock_service(
    mock_data: MockServiceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Создать новый mock сервис"""
    service = MockServiceService(db)
    
    try:
        mock_service = await service.create_mock_service(mock_data)
        return mock_service
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[MockServiceResponse])
async def get_mock_services(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех mock сервисов"""
    service = MockServiceService(db)
    mock_services = await service.get_mock_services(skip=skip, limit=limit)
    return mock_services


@router.get("/{service_id}", response_model=MockServiceResponse)
async def get_mock_service(
    service_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить mock сервис по ID"""
    service = MockServiceService(db)
    mock_service = await service.get_mock_service(service_id)
    
    if not mock_service:
        raise HTTPException(status_code=404, detail="Mock сервис не найден")
    
    return mock_service


@router.put("/{service_id}", response_model=MockServiceResponse)
async def update_mock_service(
    service_id: int,
    mock_data: MockServiceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновить mock сервис"""
    service = MockServiceService(db)
    
    mock_service = await service.update_mock_service(service_id, mock_data)
    if not mock_service:
        raise HTTPException(status_code=404, detail="Mock сервис не найден")
    
    return mock_service


@router.delete("/{service_id}")
async def delete_mock_service(
    service_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Удалить mock сервис"""
    service = MockServiceService(db)
    
    success = await service.delete_mock_service(service_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mock сервис не найден")
    
    return {"message": "Mock сервис успешно удален"}


@router.get("/{service_id}/logs", response_model=List[dict])
async def get_service_logs(
    service_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """Получить логи запросов для конкретного mock сервиса"""
    service = MockServiceService(db)
    
    # Проверяем, существует ли сервис
    mock_service = await service.get_mock_service(service_id)
    if not mock_service:
        raise HTTPException(status_code=404, detail="Mock сервис не найден")
    
    # Получаем логи из файлов
    logs = file_logger.get_logs(service_id=service_id, skip=skip, limit=limit)
    
    # Конвертируем в словари для совместимости с frontend
    return [log.to_dict() for log in logs]


@router.get("/logs/all", response_model=List[dict])
async def get_all_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Получить все логи запросов"""
    # Получаем логи из файлов
    logs = file_logger.get_logs(skip=skip, limit=limit)
    
    # Конвертируем в словари для совместимости с frontend
    return [log.to_dict() for log in logs]


@router.get("/logs/files/info")
async def get_log_files_info():
    """Получить информацию о файлах логов"""
    return {
        "files": file_logger.get_log_files_info(),
        "total_files": len(file_logger._get_log_files())
    }


@router.get("/system/disk-usage")
async def get_disk_usage():
    """Получить информацию об использовании дискового пространства"""
    
    def get_directory_size(path):
        """Получить размер директории в байтах"""
        if not os.path.exists(path):
            return 0
        total = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total += os.path.getsize(filepath)
        return total
    
    def format_bytes(bytes_value):
        """Форматирование байтов в читаемый вид"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f} TB"
    
    # Получаем информацию о свободном месте
    logs_dir = os.getenv("LOG_DIR", "logs")
    data_dir = "data"
    
    # Размер директорий
    logs_size = get_directory_size(logs_dir)
    data_size = get_directory_size(data_dir)
    
    # Свободное место на диске
    try:
        disk_usage = shutil.disk_usage(".")
        free_space = disk_usage.free
        total_space = disk_usage.total
        used_space = disk_usage.used
    except:
        free_space = total_space = used_space = 0
    
    # Docker логи (примерная оценка)
    docker_logs_estimate = 0
    try:
        # Пытаемся найти Docker логи контейнеров
        docker_log_paths = [
            "/var/lib/docker/containers/*/mock-service-backend*-json.log*",
            "/var/lib/docker/containers/*/mock-service-frontend*-json.log*"
        ]
        for pattern in docker_log_paths:
            for log_file in glob.glob(pattern):
                if os.path.exists(log_file):
                    docker_logs_estimate += os.path.getsize(log_file)
    except:
        pass
    
    return {
        "disk_usage": {
            "total": total_space,
            "used": used_space,
            "free": free_space,
            "total_formatted": format_bytes(total_space),
            "used_formatted": format_bytes(used_space),
            "free_formatted": format_bytes(free_space),
            "usage_percentage": round((used_space / total_space * 100), 1) if total_space > 0 else 0
        },
        "application_usage": {
            "logs_size": logs_size,
            "logs_formatted": format_bytes(logs_size),
            "data_size": data_size,
            "data_formatted": format_bytes(data_size),
            "docker_logs_estimate": docker_logs_estimate,
            "docker_logs_formatted": format_bytes(docker_logs_estimate),
            "total_app_size": logs_size + data_size + docker_logs_estimate,
            "total_app_formatted": format_bytes(logs_size + data_size + docker_logs_estimate)
        },
        "log_settings": {
            "max_file_size": os.getenv("LOG_MAX_SIZE", "50MB"),
            "backup_count": int(os.getenv("LOG_BACKUP_COUNT", "10")),
            "log_dir": logs_dir,
            "rotation_type": "time" if os.getenv("LOG_ROTATION_TIME") else "size"
        },
        "warnings": []
    }


@router.post("/logs/cleanup")
async def cleanup_old_logs():
    """Принудительная очистка старых логов"""
    
    logs_dir = os.getenv("LOG_DIR", "logs")
    if not os.path.exists(logs_dir):
        return {"message": "Директория логов не найдена", "cleaned_files": 0}
    
    cleaned_files = 0
    cleaned_size = 0
    
    # Очищаем логи старше 30 дней
    cutoff_time = time.time() - (30 * 24 * 60 * 60)  # 30 дней
    
    for log_file in glob.glob(os.path.join(logs_dir, "*.log.*")):
        try:
            if os.path.getmtime(log_file) < cutoff_time:
                size = os.path.getsize(log_file)
                os.remove(log_file)
                cleaned_files += 1
                cleaned_size += size
        except OSError:
            continue
    
    return {
        "message": f"Очищено {cleaned_files} старых файлов логов",
        "cleaned_files": cleaned_files,
        "cleaned_size_mb": round(cleaned_size / (1024 * 1024), 2)
    } 