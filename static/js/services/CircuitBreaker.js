// CircuitBreaker.js - Circuit breaker pattern for failing services

const STATES = {
    CLOSED: 'CLOSED',     // Normal operation - requests flow through
    OPEN: 'OPEN',         // Blocking requests - service is failing
    HALF_OPEN: 'HALF_OPEN' // Testing recovery - allowing limited requests
};

export class CircuitBreaker {
    constructor(serviceId, options = {}) {
        this.serviceId = serviceId;
        this.failureThreshold = options.failureThreshold || 3;
        this.resetTimeout = options.resetTimeout || 30000;
        this.halfOpenMaxRequests = options.halfOpenMaxRequests || 1;

        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.halfOpenRequests = 0;
    }

    /**
     * Check if a request can proceed
     */
    canRequest() {
        switch (this.state) {
            case STATES.CLOSED:
                return true;

            case STATES.OPEN:
                // Check if reset timeout has passed
                if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
                    this.state = STATES.HALF_OPEN;
                    this.halfOpenRequests = 0;
                    console.log(`[CircuitBreaker] ${this.serviceId}: OPEN -> HALF_OPEN (testing recovery)`);
                    return true;
                }
                return false;

            case STATES.HALF_OPEN:
                return this.halfOpenRequests < this.halfOpenMaxRequests;

            default:
                return false;
        }
    }

    /**
     * Record a successful request
     */
    recordSuccess() {
        this.successes++;

        if (this.state === STATES.HALF_OPEN) {
            // Recovery confirmed - close the circuit
            this.state = STATES.CLOSED;
            console.log(`[CircuitBreaker] ${this.serviceId}: HALF_OPEN -> CLOSED (recovered)`);
        }

        this.failures = 0;
        this.halfOpenRequests = 0;
    }

    /**
     * Record a failed request
     */
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === STATES.HALF_OPEN) {
            // Recovery failed - reopen the circuit
            this.state = STATES.OPEN;
            console.warn(`[CircuitBreaker] ${this.serviceId}: HALF_OPEN -> OPEN (recovery failed)`);
        } else if (this.failures >= this.failureThreshold) {
            // Threshold reached - open the circuit
            this.state = STATES.OPEN;
            console.warn(`[CircuitBreaker] ${this.serviceId}: CLOSED -> OPEN (${this.failures} failures)`);
        }
    }

    /**
     * Track a half-open request
     */
    trackHalfOpenRequest() {
        if (this.state === STATES.HALF_OPEN) {
            this.halfOpenRequests++;
        }
    }

    /**
     * Get current state information
     */
    getState() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailure: this.lastFailureTime,
            canRequest: this.canRequest(),
            timeSinceLastFailure: this.lastFailureTime
                ? Date.now() - this.lastFailureTime
                : null,
            timeUntilRetry: this.state === STATES.OPEN
                ? Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime))
                : 0
        };
    }

    /**
     * Force reset the circuit breaker
     */
    reset() {
        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.halfOpenRequests = 0;
        console.log(`[CircuitBreaker] ${this.serviceId}: Reset to CLOSED`);
    }
}

/**
 * Registry to manage circuit breakers for multiple services
 */
export class CircuitBreakerRegistry {
    constructor() {
        this.breakers = new Map();
    }

    /**
     * Get or create a circuit breaker for a service
     */
    get(serviceId, options = {}) {
        if (!this.breakers.has(serviceId)) {
            this.breakers.set(serviceId, new CircuitBreaker(serviceId, options));
        }
        return this.breakers.get(serviceId);
    }

    /**
     * Get status of all circuit breakers
     */
    getStatus() {
        const status = {};
        for (const [id, breaker] of this.breakers) {
            status[id] = breaker.getState();
        }
        return status;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }

    /**
     * Get count of open circuits
     */
    getOpenCount() {
        let count = 0;
        for (const breaker of this.breakers.values()) {
            if (breaker.state === STATES.OPEN) count++;
        }
        return count;
    }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Export states for external use
export { STATES as CircuitBreakerStates };
