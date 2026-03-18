FROM node:22-alpine AS builder
RUN apk add --no-cache git
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
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]
