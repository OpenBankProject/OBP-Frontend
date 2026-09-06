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
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm ci
COPY . .

# Accept build arguments for environment variables
ARG PUBLIC_OBP_BASE_URL
ARG OBP_OAUTH_CLIENT_ID
ARG OBP_OAUTH_CLIENT_SECRET
ARG APP_CALLBACK_URL
ARG ORIGIN

# Set environment variables for build
ENV PUBLIC_OBP_BASE_URL=$PUBLIC_OBP_BASE_URL
ENV OBP_OAUTH_CLIENT_ID=$OBP_OAUTH_CLIENT_ID
ENV OBP_OAUTH_CLIENT_SECRET=$OBP_OAUTH_CLIENT_SECRET
ENV APP_CALLBACK_URL=$APP_CALLBACK_URL
ENV ORIGIN=$ORIGIN

RUN npm run build
RUN npm prune --production

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
# gRPC clients load proto definitions from <cwd>/proto at runtime — without this
# the metrics and log-cache stream endpoints 500 (ENOENT on proto/*.proto).
COPY --from=builder /app/proto proto/
EXPOSE 3003
ENV NODE_ENV=production
CMD [ "node", "build" ]
