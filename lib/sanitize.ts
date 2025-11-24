/**
 * Input sanitization utilities to prevent XSS attacks
 */

/**
 * Sanitize a string by removing potentially dangerous characters
 * This is a basic implementation - for production, consider using a library like DOMPurify
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Basic email validation and sanitization
  const trimmed = email.trim().toLowerCase();
  
  // Remove any HTML tags
  const sanitized = sanitizeString(trimmed);
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize text input for forms
 */
export function sanitizeTextInput(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  let sanitized = sanitizeString(input);
  
  // Apply max length if specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim();
  
  // Remove javascript: and data: protocols
  if (trimmed.toLowerCase().startsWith('javascript:') || 
      trimmed.toLowerCase().startsWith('data:')) {
    return '';
  }
  
  // Only allow http, https protocols
  if (!trimmed.match(/^https?:\/\//i)) {
    return '';
  }
  
  return trimmed;
}

