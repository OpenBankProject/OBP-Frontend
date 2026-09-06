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
# API Manager II Dev Server
#
# Runs `npm run dev` in the foreground and also writes a copy of stdout/stderr
# to /tmp/obp-api-manager.log so logs can be tailed from another terminal:
#
#   tail -f /tmp/obp-api-manager.log
################################################################################

set -e

RUNTIME_LOG=/tmp/obp-api-manager.log

cd "$(dirname "$0")"

echo "Starting API Manager II dev server (Ctrl+C to stop)"
echo "Runtime log also written to: $RUNTIME_LOG"
echo ""

npm run dev 2>&1 | tee "$RUNTIME_LOG"
