const SECRET_BODY_FIELDS = ['refresh_token', 'code', 'client_secret', 'password', 'access_token', 'id_token'];

// Renders a URL-encoded OAuth request body for logging with secret fields redacted,
// since these bodies carry refresh tokens / auth codes / client secrets verbatim.
export function redactUrlEncodedBody(body: URLSearchParams): string {
	const redacted = new URLSearchParams(body);
	for (const field of SECRET_BODY_FIELDS) {
		if (redacted.has(field)) {
			redacted.set(field, '[redacted]');
		}
	}
	return redacted.toString();
}
