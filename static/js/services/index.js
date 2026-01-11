// index.js - Barrel export for service layer

export { serviceClient, ServiceClient } from './ServiceClient.js';
export { cacheManager, CacheManager } from './CacheManager.js';
export { circuitBreakerRegistry, CircuitBreakerRegistry, CircuitBreakerStates } from './CircuitBreaker.js';
export { requestDeduplicator, RequestDeduplicator } from './RequestDeduplicator.js';
export { ServiceRegistry, SERVICE_CONFIG } from './ServiceRegistry.js';
export { ServiceError, NetworkError, TimeoutError, CircuitOpenError } from './errors.js';
