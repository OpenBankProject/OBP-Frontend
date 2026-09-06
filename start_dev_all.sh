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
# OBP-Frontend Dev Servers
#
# Starts both apps in the background, logs go to /tmp/obp-portal.log and
# /tmp/obp-api-manager.log. Ctrl+C stops both.
#
# Portal:      http://localhost:5174
# API Manager: http://localhost:3003
#
# Follow logs from another terminal:
#   tail -f /tmp/obp-portal.log
#   tail -f /tmp/obp-api-manager.log
################################################################################

set -e

cd "$(dirname "$0")"

PORTAL_LOG=/tmp/obp-portal.log
APIM_LOG=/tmp/obp-api-manager.log

echo "Starting both dev servers (Ctrl+C to stop)"
echo "  Portal      -> http://localhost:5174  (log: $PORTAL_LOG)"
echo "  API Manager -> http://localhost:3003  (log: $APIM_LOG)"
echo ""

# Start both in the background, teeing output to log files + terminal (prefixed).
npm run dev --workspace=apps/portal 2>&1 | tee "$PORTAL_LOG" | sed 's/^/[portal] /' &
PORTAL_PID=$!

npm run dev --workspace=apps/api-manager 2>&1 | tee "$APIM_LOG" | sed 's/^/[apim]   /' &
APIM_PID=$!

# Stop both on Ctrl+C / exit
trap 'echo; echo "Stopping dev servers..."; kill $PORTAL_PID $APIM_PID 2>/dev/null; wait 2>/dev/null' INT TERM EXIT

wait
