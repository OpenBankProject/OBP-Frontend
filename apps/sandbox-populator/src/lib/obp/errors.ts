export class OBPErrorBase extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OBPError';
		Object.setPrototypeOf(this, OBPErrorBase.prototype);
	}
}

export interface OBPRequestDetails {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: unknown;
}

export interface OBPResponseDetails {
	status: number;
	statusText: string;
	data: unknown;
}

export class OBPRequestError extends OBPErrorBase {
	code: string;
	message: string;
	obpErrorCode: string;
	request: OBPRequestDetails;
	response: OBPResponseDetails;

	constructor(
		code: number,
		message: string,
		request: OBPRequestDetails,
		response: OBPResponseDetails
	) {
		super(message);
		this.name = 'OBPRequestError';
		this.code = code.toString();
		this.message = message;
		this.request = request;
		this.response = response;
		Object.setPrototypeOf(this, OBPRequestError.prototype);
		this.obpErrorCode = this.getObpErrorCode();
	}

	getObpErrorCode(): string {
		const match = this.message.match(/OBP-\d+/);
		return match ? match[0] : 'UNKNOWN_ERROR';
	}

	/**
	 * Returns a sanitized version of request details (without Authorization header)
	 */
	getSanitizedRequest(): OBPRequestDetails {
		const sanitizedHeaders = { ...this.request.headers };
		if (sanitizedHeaders['Authorization']) {
			sanitizedHeaders['Authorization'] = 'Bearer [REDACTED]';
		}
		return {
			...this.request,
			headers: sanitizedHeaders
		};
	}

	/**
	 * Returns error details suitable for serialization (e.g., for form actions)
	 */
	toJSON() {
		return {
			code: this.code,
			message: this.message,
			obpErrorCode: this.obpErrorCode,
			request: this.getSanitizedRequest(),
			response: this.response
		};
	}
}
