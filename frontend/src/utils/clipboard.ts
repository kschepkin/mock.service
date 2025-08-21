/**
 * Утилита для копирования текста в буфер обмена
 * Поддерживает fallback для HTTP соединений
 */

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Пробуем современный API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    
    // Fallback для HTTP или старых браузеров
    return fallbackCopyToClipboard(text)
  } catch (error) {
    console.warn('Clipboard API failed, trying fallback:', error)
    return fallbackCopyToClipboard(text)
  }
}

const fallbackCopyToClipboard = (text: string): boolean => {
  try {
    // Создаем временный textarea
    const textArea = document.createElement('textarea')
    textArea.value = text
    
    // Делаем textarea невидимым
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.style.opacity = '0'
    
    document.body.appendChild(textArea)
    
    // Выделяем и копируем
    textArea.focus()
    textArea.select()
    
    const successful = document.execCommand('copy')
    
    // Удаляем временный элемент
    document.body.removeChild(textArea)
    
    return successful
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error)
    return false
  }
}

/**
 * Копирует текст с уведомлением о результате
 */
export const copyWithNotification = async (
  text: string, 
  successMessage: string = 'Скопировано в буфер обмена',
  errorMessage: string = 'Не удалось скопировать'
): Promise<void> => {
  const { notification } = await import('antd')
  
  const success = await copyToClipboard(text)
  
  if (success) {
    notification.success({
      message: successMessage,
      duration: 2
    })
  } else {
    notification.error({
      message: errorMessage,
      description: 'Попробуйте выделить и скопировать текст вручную',
      duration: 4
    })
  }
} 