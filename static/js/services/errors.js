// errors.js - Custom error classes for service layer

export class ServiceError extends Error {
    constructor(message, serviceId = null) {
        super(message);
        this.name = 'ServiceError';
        this.serviceId = serviceId;
    }
}

export class NetworkError extends Error {
    constructor(message, status = null) {
        super(message);
        this.name = 'NetworkError';
        this.status = status;
    }
}

export class TimeoutError extends Error {
    constructor(url, timeout = null) {
        super(`Request timed out: ${url}`);
        this.name = 'TimeoutError';
        this.url = url;
        this.timeout = timeout;
    }
}

export class CircuitOpenError extends Error {
    constructor(serviceId) {
        super(`Circuit breaker open for service: ${serviceId}`);
        this.name = 'CircuitOpenError';
        this.serviceId = serviceId;
    }
}
