// ServiceRegistry.js - Service configurations for all external APIs

const SERVICE_CONFIG = {
    GDELT: {
        id: 'gdelt',
        baseUrl: 'https://api.gdeltproject.org',
        timeout: 15000,
        retries: 1,
        cache: {
            ttl: 3 * 60 * 1000,          // 3 minutes (real-time news)
            staleWhileRevalidate: true
        },
        circuitBreaker: {
            failureThreshold: 2,
            resetTimeout: 60000           // 1 minute
        }
    },

    COINGECKO: {
        id: 'coingecko',
        baseUrl: 'https://api.coingecko.com',
        timeout: 10000,
        retries: 2,
        cache: {
            ttl: 60 * 1000,              // 1 minute (crypto volatility)
            staleWhileRevalidate: false
        },
        circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 120000          // 2 minutes (API can be flaky)
        }
    },

    FRED: {
        id: 'fred',
        baseUrl: 'https://fred.stlouisfed.org',
        timeout: 10000,
        retries: 2,
        cache: {
            ttl: 60 * 60 * 1000,         // 1 hour (weekly data)
            staleWhileRevalidate: true
        },
        circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 60000
        }
    },

    USGS: {
        id: 'usgs',
        baseUrl: 'https://earthquake.usgs.gov',
        timeout: 10000,
        retries: 2,
        cache: {
            ttl: 5 * 60 * 1000,          // 5 minutes
            staleWhileRevalidate: true
        },
        circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 60000
        }
    },

    CORS_PROXY: {
        id: 'cors_proxy',
        baseUrl: null,                    // Uses proxy URLs from list
        proxies: [
            'https://situation-monitor-proxy.seanthielen-e.workers.dev/?url=',
            'https://api.allorigins.win/raw?url='
        ],
        timeout: 12000,
        retries: 1,                       // Already has proxy fallback
        cache: {
            ttl: 5 * 60 * 1000,
            staleWhileRevalidate: true
        },
        circuitBreaker: {
            failureThreshold: 5,
            resetTimeout: 120000
        }
    }
};

export class ServiceRegistry {
    /**
     * Get configuration for a service
     */
    static get(serviceId) {
        return SERVICE_CONFIG[serviceId] || null;
    }

    /**
     * Get all service IDs
     */
    static getServiceIds() {
        return Object.keys(SERVICE_CONFIG);
    }

    /**
     * Get all service configurations
     */
    static getAll() {
        return { ...SERVICE_CONFIG };
    }

    /**
     * Check if a service is registered
     */
    static has(serviceId) {
        return Object.hasOwn(SERVICE_CONFIG, serviceId);
    }

    /**
     * Get CORS proxies list
     */
    static getCorsProxies() {
        return SERVICE_CONFIG.CORS_PROXY.proxies;
    }
}

export { SERVICE_CONFIG };
