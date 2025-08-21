from fastapi import APIRouter, Request
import os

router = APIRouter(prefix="/api/server", tags=["server"])

@router.get("/info")
async def get_server_info(request: Request):
    """Получить информацию о сервере"""
    external_port = os.getenv("EXTERNAL_PORT", "8080")
    base_url = f"{request.url.scheme}://{request.url.hostname}"
    # Добавляем порт, если он не 80/443
    if external_port and external_port not in ["80", "443"]:
        base_url = f"{base_url}:{external_port}"

    return {
        "base_url": base_url,
        "mock_base_url": base_url,  # URL для mock эндпоинтов (тот же что и base_url)
        "api_base_url": f"{base_url}/api",  # URL для API эндпоинтов
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    } 