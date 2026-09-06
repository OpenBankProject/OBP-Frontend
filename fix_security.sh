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
# OBP-Frontend security auto-fix
#
# Applies non-breaking fixes to dep vulnerabilities via `npm audit fix`.
# Output streams to stdout AND is written to ./security-fix.log (overwritten).
#
# DOES NOT run `npm audit fix --force` — that can introduce breaking major
# version bumps. Review the remaining findings and run --force manually if you
# want to take that risk.
#
# Usage: ./fix_security.sh
#
# Side effects:
#   - Modifies package-lock.json (possibly package.json too).
#   - May install/remove node_modules/* directories.
#   - Safe to re-run; `npm audit fix` is idempotent.
################################################################################

set -u

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO_ROOT/security-fix.log"

if [ -t 1 ]; then
	BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
	BOLD=; RED=; GREEN=; DIM=; RESET=
fi

section() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
note()    { printf '%s  %s%s\n' "$DIM" "$1" "$RESET"; }

run_fix() {
	echo "OBP-Frontend security auto-fix — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
	echo "Repo: $REPO_ROOT"
	cd "$REPO_ROOT"

	if ! command -v npm >/dev/null 2>&1; then
		echo "${RED}npm not found in PATH — cannot continue.${RESET}"
		exit 1
	fi

	############################################################################
	section "1. Before — npm audit summary"
	npm audit --workspaces --audit-level=low 2>&1 | tail -5 || true

	############################################################################
	section "2. Running npm audit fix (non-breaking)"
	note "Modifies package-lock.json. Review the diff before committing."
	npm audit fix --workspaces 2>&1 || true

	############################################################################
	section "3. After — npm audit summary"
	after_out=$(npm audit --workspaces --audit-level=low 2>&1 || true)
	echo "$after_out" | tail -5

	############################################################################
	section "4. Remaining findings (if any)"
	# Extract the JSON vuln counts to decide if --force is worth suggesting.
	remaining=$(npm audit --workspaces --json 2>/dev/null | sed -n 's/.*"total"\s*:\s*\([0-9]*\).*/\1/p' | head -1)
	if [ -z "${remaining:-}" ] || [ "$remaining" = "0" ]; then
		echo "${GREEN}✓ No remaining vulnerabilities.${RESET}"
	else
		echo "${RED}!! $remaining vulnerabilit(y|ies) remain.${RESET}"
		echo "   These typically require one of:"
		echo "     npm audit fix --force       (accepts breaking major-version bumps)"
		echo "     npm audit                    (see specific advisories)"
		echo "     manual dependency change    (swap or pin a problematic package)"
		echo "   Review each before deciding."
	fi

	############################################################################
	section "Done"
	echo "Diff to review:"
	echo "  git diff -- package-lock.json apps/*/package.json packages/*/package.json"
	echo
	echo "If everything looks good:"
	echo "  git add package-lock.json apps/*/package.json packages/*/package.json"
	echo "  git commit -m 'chore(deps): npm audit fix'"
	echo
	echo "To roll back:"
	echo "  git restore package-lock.json apps/*/package.json packages/*/package.json"
	echo "  npm install"
}

run_fix 2>&1 | tee "$LOG"
echo
echo "Full results written to: $LOG"
