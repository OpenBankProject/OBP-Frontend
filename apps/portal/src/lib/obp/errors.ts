export class OBPErrorBase extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OBPError';
        Object.setPrototypeOf(this, OBPErrorBase.prototype);
    }
}

export class OBPRateLimitError extends OBPErrorBase {
    retryAfterSeconds?: number;

    constructor(message: string, retryAfterSeconds?: number) {
        super(message);
        this.name = 'OBPRateLimitError';
        this.retryAfterSeconds = retryAfterSeconds;
        Object.setPrototypeOf(this, OBPRateLimitError.prototype);
    }
}

export class OBPTimeoutError extends OBPErrorBase {
    constructor(url: string, timeoutMs: number) {
        super(`Request to ${url} timed out after ${timeoutMs}ms`);
        this.name = 'OBPTimeoutError';
        Object.setPrototypeOf(this, OBPTimeoutError.prototype);
    }
}

export class OBPRequestError extends OBPErrorBase {
    code: string
    message: string;
    obpErrorCode: string;

    constructor(code: number, message: string) {
        super(message);
        this.name = 'OBPRequestError';
        this.code = code.toString();
        this.message = message;
        Object.setPrototypeOf(this, OBPRequestError.prototype);
        this.obpErrorCode = this.getObpErrorCode();
    }

    getObpErrorCode(): string {
        const match = this.message.match(/OBP-\d+/);
        return match ? match[0] : 'UNKNOWN_ERROR';
    }
}