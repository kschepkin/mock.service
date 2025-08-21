import re
from typing import Dict, Optional, List, Tuple


class PathParser:
    """Утилита для работы с параметризованными путями"""
    
    @staticmethod
    def extract_parameters(path_pattern: str, actual_path: str) -> Optional[Dict[str, str]]:
        """
        Извлекает параметры из пути по шаблону
        
        Args:
            path_pattern: Шаблон пути, например "/api/users/{id}/posts/{post_id}" или "/users{*}"
            actual_path: Фактический путь, например "/api/users/123/posts/456" или "/users/account/settings"
        
        Returns:
            Dict[str, str]: Словарь параметров {"id": "123", "post_id": "456"} или {"*": "/account/settings"} или None если не совпадает
        """
        # Обрабатываем wildcard параметр отдельно
        if path_pattern.endswith('{*}'):
            base_path = path_pattern[:-3]  # Убираем {*}
            if actual_path.startswith(base_path):
                # Возвращаем захваченную часть
                captured = actual_path[len(base_path):]
                return {"*": captured}
            return None
        
        # Преобразуем шаблон в регулярное выражение для обычных параметров
        pattern = PathParser._pattern_to_regex(path_pattern)
        
        if not pattern:
            # Если нет параметров, сравниваем напрямую
            return {} if path_pattern == actual_path else None
        
        match = re.match(pattern, actual_path)
        if match:
            return match.groupdict()
        
        return None
    
    @staticmethod
    def _pattern_to_regex(path_pattern: str) -> str:
        """
        Преобразует шаблон пути в регулярное выражение
        
        Args:
            path_pattern: "/api/users/{id}/posts/{post_id}" или "/users{*}"
        
        Returns:
            str: "^/api/users/(?P<id>[^/]+)/posts/(?P<post_id>[^/]+)$" или "^/users.*$"
        """
        # Экранируем специальные символы регулярных выражений кроме {и}
        escaped = re.escape(path_pattern)
        
        # Обрабатываем wildcard параметр {*} - он должен захватывать всё до конца
        if '\\{\\*\\}' in escaped:
            # Заменяем {*} на .* (любые символы)
            pattern = escaped.replace('\\{\\*\\}', '.*')
        else:
            # Заменяем обычные параметры
            # \\{id\\} -> (?P<id>[^/]+)
            pattern = re.sub(r'\\{([^}]+)\\}', r'(?P<\1>[^/]+)', escaped)
        
        # Добавляем якоря начала и конца строки
        return f"^{pattern}$"
    
    @staticmethod
    def extract_parameter_names(path_pattern: str) -> List[str]:
        """
        Извлекает имена параметров из шаблона пути
        
        Args:
            path_pattern: "/api/users/{id}/posts/{post_id}"
        
        Returns:
            List[str]: ["id", "post_id"]
        """
        return re.findall(r'{([^}]+)}', path_pattern)
    
    @staticmethod
    def validate_path_pattern(path_pattern: str) -> Tuple[bool, str]:
        """
        Валидирует шаблон пути
        
        Args:
            path_pattern: Шаблон пути для проверки
        
        Returns:
            Tuple[bool, str]: (валиден ли шаблон, сообщение об ошибке)
        """
        if not path_pattern:
            return False, "Путь не может быть пустым"
        
        if not path_pattern.startswith('/'):
            return False, "Путь должен начинаться с /"
        
        # Проверяем корректность параметров
        try:
            params = PathParser.extract_parameter_names(path_pattern)
            
            # Проверяем что нет дублирующихся параметров
            if len(params) != len(set(params)):
                return False, "Имена параметров должны быть уникальными"
            
            # Проверяем что параметры не пустые
            for param in params:
                if not param.strip():
                    return False, "Имя параметра не может быть пустым"
                
                # Разрешаем wildcard параметр
                if param == '*':
                    # Проверяем что wildcard в конце пути
                    if not path_pattern.endswith('{*}'):
                        return False, "Wildcard параметр {*} должен быть в конце пути"
                    continue
                
                # Проверяем что имя параметра корректно (буквы, цифры, подчеркивания)
                if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', param):
                    return False, f"Некорректное имя параметра: {param}"
            
            # Пытаемся создать регулярное выражение
            PathParser._pattern_to_regex(path_pattern)
            
            return True, "OK"
        
        except Exception as e:
            return False, f"Ошибка в шаблоне пути: {str(e)}"
    
    @staticmethod
    def paths_match(path_pattern: str, actual_path: str) -> bool:
        """
        Проверяет, соответствует ли фактический путь шаблону
        
        Args:
            path_pattern: Шаблон пути
            actual_path: Фактический путь
        
        Returns:
            bool: True если пути совпадают
        """
        return PathParser.extract_parameters(path_pattern, actual_path) is not None


# Экземпляр для удобства использования
path_parser = PathParser() 