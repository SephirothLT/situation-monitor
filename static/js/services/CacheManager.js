// CacheManager.js - Two-tier caching with memory (L1) and localStorage (L2)

export class CacheManager {
    constructor(options = {}) {
        this.memoryCache = new Map();
        this.storagePrefix = options.prefix || 'sm_cache_';
        this.maxMemorySize = options.maxMemorySize || 100;
        this.debug = options.debug || false;
    }

    /**
     * Generate a cache key from URL and params
     */
    generateKey(url, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('&');
        return `${url}${sortedParams ? '?' + sortedParams : ''}`;
    }

    /**
     * Get from cache - checks memory first, then localStorage
     * Returns: { data, fromCache: 'memory'|'storage', isStale } or null
     */
    get(key) {
        // L1: Memory check
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            if (this.isValid(entry)) {
                this.log(`Cache HIT (memory): ${key.substring(0, 50)}...`);
                return { data: entry.data, fromCache: 'memory', isStale: this.isStale(entry) };
            }
            this.memoryCache.delete(key);
        }

        // L2: Storage check
        try {
            const stored = localStorage.getItem(this.storagePrefix + this.hashKey(key));
            if (stored) {
                const entry = JSON.parse(stored);
                if (this.isValid(entry)) {
                    // Promote to memory cache
                    this.setMemory(key, entry);
                    this.log(`Cache HIT (storage): ${key.substring(0, 50)}...`);
                    return { data: entry.data, fromCache: 'storage', isStale: this.isStale(entry) };
                }
                localStorage.removeItem(this.storagePrefix + this.hashKey(key));
            }
        } catch (e) {
            // Storage read error - continue without cache
            this.log(`Storage read error: ${e.message}`);
        }

        this.log(`Cache MISS: ${key.substring(0, 50)}...`);
        return null;
    }

    /**
     * Set in both caches
     */
    set(key, data, ttl, staleWhileRevalidate = true) {
        const now = Date.now();
        const entry = {
            data,
            timestamp: now,
            ttl,
            staleUntil: staleWhileRevalidate ? now + ttl * 2 : now + ttl
        };

        this.setMemory(key, entry);
        this.setStorage(key, entry);
        this.log(`Cache SET: ${key.substring(0, 50)}... (TTL: ${ttl / 1000}s)`);
    }

    /**
     * Memory cache with LRU eviction
     */
    setMemory(key, entry) {
        // LRU eviction - remove oldest entry if at capacity
        if (this.memoryCache.size >= this.maxMemorySize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(key, entry);
    }

    /**
     * Storage with error handling and quota management
     */
    setStorage(key, entry) {
        try {
            const serialized = JSON.stringify(entry);
            localStorage.setItem(this.storagePrefix + this.hashKey(key), serialized);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.pruneStorage();
                try {
                    localStorage.setItem(this.storagePrefix + this.hashKey(key), JSON.stringify(entry));
                } catch (e2) {
                    this.log(`Storage quota exceeded, could not save: ${key.substring(0, 30)}...`);
                }
            }
        }
    }

    /**
     * Check if entry is still valid (not beyond stale period)
     */
    isValid(entry) {
        return Date.now() < entry.staleUntil;
    }

    /**
     * Check if entry is stale (past TTL but still within stale period)
     */
    isStale(entry) {
        return Date.now() > entry.timestamp + entry.ttl;
    }

    /**
     * Hash long keys to fit in localStorage key limits
     */
    hashKey(key) {
        // Simple hash for shorter localStorage keys
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Remove oldest cache entries to free up space
     */
    pruneStorage() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.storagePrefix)) {
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    keys.push({ key, timestamp: entry.timestamp });
                } catch (e) {
                    // Invalid entry - remove it
                    localStorage.removeItem(key);
                }
            }
        }
        // Sort by timestamp (oldest first) and remove half
        keys.sort((a, b) => a.timestamp - b.timestamp);
        keys.slice(0, Math.ceil(keys.length / 2)).forEach(k => localStorage.removeItem(k.key));
        this.log(`Pruned ${Math.ceil(keys.length / 2)} old cache entries`);
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern) {
        let count = 0;

        // Clear from memory
        for (const [key] of this.memoryCache) {
            if (key.includes(pattern)) {
                this.memoryCache.delete(key);
                count++;
            }
        }

        // Clear from storage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.storagePrefix)) {
                localStorage.removeItem(key);
                count++;
            }
        }

        this.log(`Invalidated ${count} entries matching: ${pattern}`);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.memoryCache.clear();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.storagePrefix)) {
                localStorage.removeItem(key);
            }
        }
        this.log('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let storageCount = 0;
        let storageSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.storagePrefix)) {
                storageCount++;
                storageSize += (localStorage.getItem(key) || '').length;
            }
        }

        return {
            memoryEntries: this.memoryCache.size,
            storageEntries: storageCount,
            storageSizeKB: Math.round(storageSize / 1024 * 100) / 100
        };
    }

    /**
     * Debug logging
     */
    log(message) {
        if (this.debug) {
            console.log(`[CacheManager] ${message}`);
        }
    }
}

// Export singleton instance
export const cacheManager = new CacheManager({ prefix: 'sm_' });
