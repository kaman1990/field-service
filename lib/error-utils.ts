/**
 * Check if an error is network/offline related
 * These errors should be suppressed since attachments are queued and will upload when back online
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const lowerMessage = errorMessage.toLowerCase();
  
  // Check for common network/offline error indicators
  const networkErrorPatterns = [
    'network',
    'fetch',
    'failed to fetch',
    'offline',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'econnreset',
    'econnaborted',
    'etimedout',
    'networkerror',
    'network request failed',
    'networkerror when attempting to fetch',
  ];
  
  return networkErrorPatterns.some(pattern => lowerMessage.includes(pattern));
}

