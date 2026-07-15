// A same-page-origin relative path is safe to redirect to; protocol-relative
// (`//host`) and backslash (`/\host`) values are browser-resolved as absolute
// URLs to a different host and must be rejected.
export function isSafeRelativeRedirect(path: string | null | undefined): path is string {
	if (!path) return false;
	return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}
