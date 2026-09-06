#!/bin/bash
# Copyright (C) 2025-2026 TESOBE GmbH
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
################################################################################
# OBP-Frontend security scan
#
# Runs a set of non-invasive static checks against the monorepo source and
# writes the full output to security-scan.log (overwritten each run).
#
# Covers (heuristic, grep-based):
#   1.  npm audit (dep vulnerabilities)
#   2.  Tracked secret / dotfiles that shouldn't be in git
#   3.  Hardcoded credential patterns
#   4.  Unsafe JS evaluation ({@html}, eval, new Function)
#   5.  Disabled TLS / cert verification
#   6.  Secrets in log statements
#   7.  Session cookie flags
#   8.  SSRF: user-controlled values flowing into server-side fetch/URL
#   9.  /backend/* routes that never reference locals.session (auth-missing)
#   10. Open redirects: redirect(3xx, ...) with dynamic destinations
#   11. Cookie sameSite:'none' checks (and secure pairing)
#   12. Hardcoded localhost / 127.0.0.1 URLs outside .env
#   13. Potential debug / admin / dev routes
#   14. Rate-limiting middleware presence
#
# Scope: apps/portal/src, apps/api-manager/src, packages/shared/src.
# Does NOT touch NGINX, Opey, running services, or deployment config.
#
# Usage:  ./check_security.sh
# Output: full results stream to stdout AND to ./security-scan.log (overwrite).
################################################################################

set -u

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO_ROOT/security-scan.log"

SCAN_PATHS=(
	"$REPO_ROOT/apps/portal/src"
	"$REPO_ROOT/apps/api-manager/src"
	"$REPO_ROOT/packages/shared/src"
)

# ANSI colors only when stdout is a TTY; log file gets plain text.
if [ -t 1 ]; then
	BOLD=$'\033[1m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
	BOLD=; RED=; YELLOW=; GREEN=; DIM=; RESET=
fi

section() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
hit()     { printf '%s!! %s%s\n' "$RED" "$1" "$RESET"; }
ok()      { printf '%s✓ %s%s\n' "$GREEN" "$1" "$RESET"; }
note()    { printf '%s  %s%s\n' "$DIM" "$1" "$RESET"; }

# Truncate long finding lists so the log stays readable.
# Args: max_lines, content (via stdin)
cap_output() {
	local max="$1"
	awk -v max="$max" 'NR<=max{print} END{if(NR>max)printf("  (…truncated: %d of %d lines shown)\n", max, NR)}'
}

run_scan() {
	echo "OBP-Frontend security scan — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
	echo "Repo: $REPO_ROOT"
	echo "Paths: ${SCAN_PATHS[*]}"

	############################################################################
	section "1. npm audit (all workspaces, level=low)"
	if command -v npm >/dev/null 2>&1; then
		cd "$REPO_ROOT"
		npm audit --workspaces --audit-level=low 2>&1 | tail -25 || true
	else
		hit "npm not found — skipping"
	fi

	############################################################################
	section "2. Tracked secret / dotfiles"
	cd "$REPO_ROOT"
	tracked=$(git ls-files | grep -E '(^|/)\.env($|\.|/)|(^|/)\.env\.local$|(^|/)credentials\.json$|(^|/)id_rsa$|(^|/)\.npmrc$' \
		| grep -vE '\.env\.example$|\.env\.test\.example$' || true)
	if [ -n "$tracked" ]; then
		hit "Tracked files that may hold secrets (review):"
		printf '%s\n' "$tracked" | sed 's/^/  /'
	else
		ok "No tracked secret/dotfiles."
	fi

	############################################################################
	section "3. Hardcoded credential patterns"
	pat='(sk-ant-api[a-zA-Z0-9_-]+|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(password|secret|apiKey|api_key|accessKey|bearer_token)\s*[:=]\s*["'"'"'][A-Za-z0-9+/=_-]{12,}["'"'"'])'
	hits=$(grep -rInE --include='*.ts' --include='*.svelte' --include='*.js' --include='*.json' "$pat" "${SCAN_PATHS[@]}" 2>/dev/null \
		| grep -vE '\.env\.example|test/|__tests__|fixture' || true)
	if [ -n "$hits" ]; then
		hit "Possible hardcoded credentials (review each — docs often show fake creds):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 40
	else
		ok "No obvious hardcoded credentials."
	fi

	############################################################################
	section "4. Unsafe eval / new Function / {@html}"
	hits=$(grep -rInE --include='*.ts' --include='*.svelte' --include='*.js' \
		'(^|[^a-zA-Z_\.])eval\s*\(|new\s+Function\s*\(|\{@html\s' "${SCAN_PATHS[@]}" 2>/dev/null \
		| grep -vE '//.*eval|^\s*\*' || true)
	if [ -n "$hits" ]; then
		hit "Dynamic code / HTML rendering (only risky if input is untrusted):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 30
	else
		ok "None found."
	fi

	############################################################################
	section "5. Disabled TLS / cert verification"
	hits=$(grep -rInE --include='*.ts' --include='*.js' \
		'rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|strictSSL\s*:\s*false|insecure\s*:\s*true' \
		"${SCAN_PATHS[@]}" 2>/dev/null || true)
	if [ -n "$hits" ]; then
		hit "TLS verification disabled somewhere:"
		printf '%s\n' "$hits" | sed 's/^/  /'
	else
		ok "No TLS-bypass patterns."
	fi

	############################################################################
	section "6. Tokens / secrets in log statements"
	hits=$(grep -rInE --include='*.ts' --include='*.svelte' --include='*.js' \
		'(console\.(log|debug|info|warn|error)|logger\.(log|debug|info|warn|error))\s*\([^)]*(access_?token|refresh_?token|client_?secret|password|bearer|session_?secret|api_?key)' \
		"${SCAN_PATHS[@]}" 2>/dev/null | grep -vE 'test/|__tests__|\.test\.' || true)
	if [ -n "$hits" ]; then
		hit "Log statements that may leak secrets (review — booleans/lengths are usually fine):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 30
	else
		ok "No secret-looking log statements."
	fi

	############################################################################
	section "7. Session cookie flags"
	hits=$(grep -rIn --include='*.ts' -E 'sveltekitSessionHandle|cookie:\s*\{' "${SCAN_PATHS[@]}" 2>/dev/null || true)
	if [ -n "$hits" ]; then
		printf '%s\n' "$hits" | sed 's/^/  /'
		note "Want: httpOnly:true, secure:true (prod), sameSite:'lax' or 'strict'."
	else
		note "No sveltekit-sessions config found — check where session plumbing lives."
	fi

	############################################################################
	section "8. SSRF: user-controlled values flowing into server-side fetch"
	# Heuristic: fetch() / axios() / http.get() with a template-literal URL that
	# contains ${params.X} / ${event.params.X} / ${url.searchParams...} / ${body...}.
	# Limits to *.server.ts and +server.ts files where SSRF actually matters.
	hits=$(grep -rInE --include='+server.ts' --include='*.server.ts' \
		'(fetch|axios|got|http\.(get|post|request))\s*\(\s*`[^`]*\$\{(params|event\.params|url|body|request|searchParams|locals\.params|query|data\.)' \
		"${SCAN_PATHS[@]}" 2>/dev/null || true)
	if [ -n "$hits" ]; then
		hit "Potential SSRF (server fetch with user-controlled URL — verify the base host is fixed/whitelisted):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 30
	else
		ok "No user-controlled URLs flowing into server fetch (by grep)."
	fi
	note "Also inspect apps/*/src/routes/proxy/**/+server.ts manually — path is by design user-controlled; check it's joined against a fixed base URL and stripped of '..' / leading '/'."

	############################################################################
	section "9. /backend/* routes with no session check"
	# Server routes under /backend/ that don't reference locals.session/.user
	# may be unintentionally unauthenticated. (Some are intentionally public —
	# e.g. /backend/status, /backend/health — flag but note.)
	missing=""
	for root in "$REPO_ROOT/apps/portal/src/routes/backend" "$REPO_ROOT/apps/api-manager/src/routes/backend"; do
		[ -d "$root" ] || continue
		while IFS= read -r f; do
			# Recognises: direct locals.session/.user access, getSession() calls,
			# or the checkAPIAuth/requireAPIAuth helpers (api-manager convention).
			if ! grep -qE 'locals\.session|locals\.user|getSession|checkAPIAuth|requireAPIAuth' "$f"; then
				missing="$missing"$'\n'"$f"
			fi
		done < <(find "$root" -name '+server.ts' -type f)
	done
	missing="$(printf '%s\n' "$missing" | grep -v '^$' || true)"
	if [ -n "$missing" ]; then
		hit "No session/user reference in these /backend/ routes (some may be public by design):"
		printf '%s\n' "$missing" | sed 's/^/  /' | cap_output 40
		note "Intentional public routes are fine here: /backend/status, /backend/version, /backend/health."
	else
		ok "Every /backend/ route references locals.session or locals.user."
	fi

	############################################################################
	section "10. Open redirects (redirect to dynamic destinations)"
	# Flag redirect(3xx, var) where var contains / is built from user input.
	hits=$(grep -rInE --include='*.ts' --include='*.svelte' \
		'redirect\s*\(\s*3[0-9]{2}\s*,\s*[^"'"'"']' \
		"${SCAN_PATHS[@]}" 2>/dev/null \
		| grep -vE "redirect\(\s*3[0-9]{2}\s*,\s*['\"]/" || true)
	if [ -n "$hits" ]; then
		hit "Dynamic redirect destinations (verify the URL is on an allow-list, esp. login/OAuth callbacks):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 30
	else
		ok "No obviously-dynamic redirects."
	fi

	############################################################################
	section "11. Cookie sameSite:'none' check"
	hits=$(grep -rInE --include='*.ts' "sameSite\s*:\s*['\"]none['\"]" "${SCAN_PATHS[@]}" 2>/dev/null || true)
	if [ -n "$hits" ]; then
		hit "Cookies with sameSite:'none' (must also have secure:true, and cross-site use is legitimate):"
		printf '%s\n' "$hits" | sed 's/^/  /'
	else
		ok "No sameSite:'none' cookies."
	fi

	############################################################################
	section "12. Hardcoded localhost / 127.0.0.1 URLs in code"
	# Excludes .env files, docs, and test fixtures — keeps only code.
	hits=$(grep -rInE --include='*.ts' --include='*.svelte' --include='*.js' \
		'https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)[:/]' \
		"${SCAN_PATHS[@]}" 2>/dev/null \
		| grep -vE 'test/|__tests__|\.test\.|\.example|docs/|\.md:' || true)
	if [ -n "$hits" ]; then
		hit "Hardcoded dev URLs in code (should come from env or config):"
		printf '%s\n' "$hits" | sed 's/^/  /' | cap_output 30
	else
		ok "No hardcoded dev URLs in source."
	fi

	############################################################################
	section "13. Potential debug / admin / dev routes"
	debug_routes=$(find "$REPO_ROOT/apps/portal/src/routes" "$REPO_ROOT/apps/api-manager/src/routes" \
		-type d \( -iname 'debug' -o -iname 'admin' -o -iname 'dev' -o -iname '_dev' -o -iname '__debug__' \) 2>/dev/null || true)
	if [ -n "$debug_routes" ]; then
		hit "Routes with debug/admin/dev-ish names (confirm auth required):"
		printf '%s\n' "$debug_routes" | sed 's/^/  /'
	else
		ok "No debug/admin/dev routes."
	fi

	############################################################################
	section "14. Rate-limiting middleware presence"
	# Only match actual library imports — NOT OBP's rateLimitPerSecond / per_day_call_limit
	# data fields, which are API-product rate-limit settings, not app middleware.
	rl_hits=$(grep -rInE --include='*.ts' \
		"from\s+['\"](express-rate-limit|sveltekit-rate-limiter|@upstash/ratelimit|rate-limiter-flexible|slowdown)['\"]" \
		"${SCAN_PATHS[@]}" 2>/dev/null || true)
	if [ -n "$rl_hits" ]; then
		ok "Rate-limiting references found:"
		printf '%s\n' "$rl_hits" | sed 's/^/  /' | cap_output 20
	else
		hit "No rate-limiting detected on the SvelteKit apps."
		note "Sensitive routes to consider: /login/*, /register, /forgot-password, /reset-password, /consumers/register, /backend/opey/*."
		note "Opey itself has SlowAPI rate limits; the monorepo frontend does not."
	fi

	############################################################################
	section "Done"
	echo "Findings above are heuristic — review each before acting."
	echo "Not covered: NGINX, Opey backend, k8s config, application-layer auth logic,"
	echo "IDOR checks, race conditions, live-service testing."
}

# Stream to stdout + overwrite the log file.
run_scan 2>&1 | tee "$LOG"
echo
echo "Full results written to: $LOG"
