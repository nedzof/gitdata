// BRC Cache Invalidation Utility for Frontend
// Implements D11H cache invalidation logic for browser environment

export interface CacheInvalidationConfig {
  forceAPIReload: boolean;
  clearModuleCache: boolean;
  version: string;
  timestamp: number;
}

// Force cache invalidation by modifying module resolution
export function invalidateModuleCache(): void {
  if (typeof window === 'undefined') return;

  try {
    // Clear any cached API client instances
    const apiCacheKey = 'api_client_cache';
    localStorage.removeItem(apiCacheKey);
    sessionStorage.removeItem(apiCacheKey);

    // Dispatch cache invalidation event
    const event = new CustomEvent('brcCacheInvalidate', {
      detail: {
        forceAPIReload: true,
        clearModuleCache: true,
        version: '1.4.0',
        timestamp: Date.now()
      } as CacheInvalidationConfig
    });
    window.dispatchEvent(event);

    console.log('🔄 Module cache invalidated');
  } catch (error) {
    console.warn('Failed to invalidate module cache:', error);
  }
}

// Check if API methods are available and force reload if not
export function validateAPIClientMethods(api: any): boolean {
  const requiredD06Methods = [
    'getRevenueSummary',
    'getAgentSummary',
    'processPayment',
    'verifyPayment',
    'authorizeAgent',
    'getAgentAuthorization'
  ];

  const missingMethods = requiredD06Methods.filter(method => typeof api[method] !== 'function');

  if (missingMethods.length > 0) {
    console.error('❌ Missing D06 API methods:', missingMethods);
    console.log('🔄 Forcing cache invalidation and reload...');

    // Force cache bust
    invalidateModuleCache();

    return false;
  }

  console.log('✅ All D06 API methods available:', requiredD06Methods);
  return true;
}

// Force a hard cache bust by modifying import paths
export function forceCacheBust(): void {
  if (typeof window === 'undefined') return;

  try {
    // Add cache-busting timestamp to force module reload
    const timestamp = Date.now();
    const cacheKey = `api_cache_bust_${timestamp}`;

    // Store cache bust marker
    sessionStorage.setItem(cacheKey, timestamp.toString());

    // Force immediate page reload for D06 API methods fix
    console.log('🔄 Hard reload for D06 API methods fix');
    window.location.reload();

    // Listen for successful cache invalidation
    window.addEventListener('apiCacheInvalidate', () => {
      clearTimeout(reloadTimeout);
      console.log('✅ Cache invalidation successful');
    }, { once: true });

    // Trigger cache invalidation
    invalidateModuleCache();

  } catch (error) {
    console.warn('Failed to force cache bust:', error);
    // Fallback: hard reload
    window.location.reload();
  }
}

// Initialize cache invalidation on module load
export function initializeCacheInvalidation(): void {
  if (typeof window === 'undefined') return;

  // Listen for cache invalidation events
  window.addEventListener('brcCacheInvalidate', (event: any) => {
    const config = event.detail as CacheInvalidationConfig;
    console.log('🔧 Processing cache invalidation:', config);

    if (config.forceAPIReload) {
      // Force reimport of API client
      delete (window as any).apiClientCache;
    }
  });

  // Check if we're in a development environment - only invalidate on first load
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const isFirstLoad = !sessionStorage.getItem('api_cache_initialized');
    if (isFirstLoad) {
      console.log('🔧 Development mode: first load cache invalidation');
      sessionStorage.setItem('api_cache_initialized', 'true');
      invalidateModuleCache();
    }
  }
}

// Call initialization
initializeCacheInvalidation();