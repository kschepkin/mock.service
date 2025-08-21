from pydantic import BaseModel
from typing import Optional

class SwaggerContentRequest(BaseModel):
    content: str
    content_type: str = "json"

class SwaggerImportRequest(BaseModel):
    content: str
    content_type: str = "json"
    base_path: str = "/api" 