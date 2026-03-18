# Migration Guide: `@trampswealthy/obp-svelte-components`

This document helps developers (and LLMs) transition from in-house copies of these components to the published npm package.

---

## 1. Installation & Setup

### Install the package

```bash
npm install @trampswealthy/obp-svelte-components
```

### Required peer dependencies

```bash
npm install svelte@^5.0.0 @skeletonlabs/skeleton@^4.0.0 @skeletonlabs/skeleton-svelte@^4.0.0 bits-ui@^2.8.10 @lucide/svelte@^0.513.0
```

### Optional peer dependencies (server-side features)

Only needed if you use `server/oauth` or `server/redis` exports:

```bash
npm install arctic svelte-kit-sessions svelte-kit-connect-redis ioredis
```

---

## 2. Import Path Mapping

Replace all `$lib/` imports with the npm package paths:

| Old (in-house)              | New (npm package)                                         |
| --------------------------- | --------------------------------------------------------- |
| `$lib`                      | `@trampswealthy/obp-svelte-components`                    |
| `$lib/components`           | `@trampswealthy/obp-svelte-components/components`         |
| `$lib/opey`                 | `@trampswealthy/obp-svelte-components/opey`               |
| `$lib/obp`                  | `@trampswealthy/obp-svelte-components/obp`                |
| `$lib/utils`                | `@trampswealthy/obp-svelte-components/utils`              |
| `$lib/stores`               | `@trampswealthy/obp-svelte-components/stores`             |
| `$lib/health-check`         | `@trampswealthy/obp-svelte-components/health-check`       |
| `$lib/markdown`             | `@trampswealthy/obp-svelte-components/markdown`           |
| `$lib/config`               | `@trampswealthy/obp-svelte-components/config`             |
| `$lib/server`               | `@trampswealthy/obp-svelte-components/server`             |
| `$lib/server/oauth`         | `@trampswealthy/obp-svelte-components/server/oauth`       |
| `$lib/server/redis`         | `@trampswealthy/obp-svelte-components/server/redis`       |
| `$lib/server/health-check`  | `@trampswealthy/obp-svelte-components/server/health-check` |
| `$lib/server/obp`           | `@trampswealthy/obp-svelte-components/server/obp`         |

### Example

```diff
- import { OpeyChat } from '$lib/components';
- import { OBPRequests } from '$lib/obp';
- import { createLogger } from '$lib/utils';
+ import { OpeyChat } from '@trampswealthy/obp-svelte-components/components';
+ import { OBPRequests } from '@trampswealthy/obp-svelte-components/obp';
+ import { createLogger } from '@trampswealthy/obp-svelte-components/utils';
```

---

## 3. Complete Component & Export Reference

### `@trampswealthy/obp-svelte-components` (root)

Re-exports everything from the submodules listed below. Use subpath imports for tree-shaking.

---

### `@trampswealthy/obp-svelte-components/components`

| Export                | Type      | Description                                        |
| --------------------- | --------- | -------------------------------------------------- |
| `OpeyChat`            | Component | Main chat interface for the Opey AI assistant      |
| `ChatMessage`         | Component | Renders a single chat message                      |
| `ConsentCard`         | Component | Displays a consent request card                    |
| `LegalDocumentModal`  | Component | Modal for displaying legal documents               |
| `LightSwitch`         | Component | Dark/light theme toggle switch                     |
| `Toast`               | Component | Toast notification display                         |
| `ToolApprovalCard`    | Component | Card for approving/denying tool calls              |
| `ToolMessage`         | Component | Displays tool-generated messages                   |
| `ToolError`           | Component | Displays tool execution errors                     |
| `ObpApiResponse`      | Component | Renders OBP API response data                      |
| `DefaultToolResponse` | Component | Default fallback for tool response display         |

---

### `@trampswealthy/obp-svelte-components/opey`

#### Controllers

| Export                | Type  | Description                                    |
| --------------------- | ----- | ---------------------------------------------- |
| `ChatController`      | Class | Manages chat state and message flow            |
| `SessionController`   | Class | Manages session lifecycle                      |
| `ToolCallController`  | Class | Manages tool call execution and approval       |

#### Services

| Export                  | Type  | Description                                  |
| ----------------------- | ----- | -------------------------------------------- |
| `RestChatService`       | Class | REST-based chat service implementation       |
| `ConsentSessionService` | Class | Manages consent sessions                     |
| `CookieAuthStrategy`   | Class | Cookie-based authentication strategy         |

#### State

| Export          | Type  | Description                                        |
| --------------- | ----- | -------------------------------------------------- |
| `ChatState`     | Class | Manages chat state with snapshot/restore support   |
| `SessionState`  | Class | Manages session state with snapshot/restore support|

#### Types

| Export              | Type | Description                              |
| ------------------- | ---- | ---------------------------------------- |
| `Role`              | Type | Message role (user, assistant, error, tool) |
| `BaseMessage`       | Type | Base message structure                   |
| `UserMessage`       | Type | User-authored message                    |
| `AssistantMessage`  | Type | Assistant-generated message              |
| `ErrorMessage`      | Type | Error message                            |
| `ToolMessage`       | Type | Tool-related message                     |
| `ToolCall`          | Type | Tool invocation structure                |
| `ToolCallApprover`  | Type | Interface for tool call approval logic   |
| `AuthStrategy`      | Type | Interface for authentication strategies  |
| `ChatService`       | Type | Interface for chat service contract      |
| `StreamEvent`       | Type | Type for streaming events                |
| `SessionService`    | Type | Interface for session services           |
| `ChatStateSnapshot` | Type | Snapshot of chat state                   |
| `SessionSnapshot`   | Type | Snapshot of session state                |

---

### `@trampswealthy/obp-svelte-components/obp`

#### Classes & Factory

| Export              | Type     | Description                                    |
| ------------------- | -------- | ---------------------------------------------- |
| `OBPRequests`       | Class    | Main OBP API requests handler                  |
| `createOBPRequests` | Function | Factory to create OBPRequests instances         |

#### Error Classes

| Export              | Type  | Description                   |
| ------------------- | ----- | ----------------------------- |
| `OBPErrorBase`      | Class | Base class for OBP API errors |
| `OBPRequestError`   | Class | General request error         |
| `OBPRateLimitError` | Class | Rate limit error              |
| `OBPTimeoutError`   | Class | Request timeout error         |

#### Types

| Export                                  | Type | Description                          |
| --------------------------------------- | ---- | ------------------------------------ |
| `OBPBank`                               | Type | Bank information                     |
| `OBPConsent`                            | Type | Consent information                  |
| `OBPConsentInfo`                        | Type | Detailed consent information         |
| `OBPConsumer`                           | Type | Consumer/user information            |
| `OBPConsumerRequestBody`               | Type | Request body for consumer operations |
| `OBPUserRegistrationRequestBody`       | Type | User registration request            |
| `OBPAddEntitlementBody`                | Type | Entitlement addition request         |
| `OBPPasswordResetInitiateRequestBody`  | Type | Password reset initiation            |
| `OBPPasswordResetRequestBody`          | Type | Password reset request               |
| `OBPUserInvitation`                    | Type | User invitation details              |
| `OBPUserInvitationValidateRequestBody` | Type | Invitation validation request        |
| `OBPUserInvitationCreateRequestBody`   | Type | Invitation creation request          |
| `OBPUserInvitationsResponse`           | Type | Invitations list response            |
| `OBPUserInvitationAcceptRequestBody`   | Type | Invitation acceptance request        |
| `OBPApiCollection`                     | Type | API collection details               |
| `OBPApiCollectionsResponse`            | Type | Collections list response            |
| `OBPApiCollectionEndpoint`             | Type | API endpoint details                 |
| `OBPApiCollectionEndpointsResponse`    | Type | Endpoints list response              |
| `OBPProductAttribute`                  | Type | Product attribute details            |
| `OBPProduct`                           | Type | Product information                  |
| `OBPProductsResponse`                  | Type | Products list response               |
| `OBPProductCollection`                 | Type | Product collection                   |
| `APIProductDetails`                    | Type | Detailed product information         |
| `OBPAccountApplication`               | Type | Account application details          |
| `OBPAccountApplicationsResponse`      | Type | Applications list response           |
| `OBPAccountApplicationCreateBody`     | Type | Account application creation request |

---

### `@trampswealthy/obp-svelte-components/utils`

| Export                          | Type     | Description                                  |
| ------------------------------- | -------- | -------------------------------------------- |
| `createLogger`                  | Function | Creates a logger with configurable log levels|
| `extractUsernameFromJWT`        | Function | Extracts username from a JWT token           |
| `isJWTExpired`                  | Function | Checks if a JWT token is expired             |
| `getJWTPayload`                 | Function | Decodes and returns JWT payload              |
| `toaster`                       | Store    | Toast notification service                   |
| `toast`                         | Function | Creates a toast notification                 |
| `getLegalMarkdownFromWebUIProps`| Function | Loads legal document markdown from API       |
| `Logger`                        | Type     | Logger interface                             |
| `LogLevel`                      | Type     | Log level enumeration                        |
| `JWTPayload`                    | Type     | Decoded JWT payload structure                |

---

### `@trampswealthy/obp-svelte-components/stores`

| Export        | Type  | Description                                  |
| ------------- | ----- | -------------------------------------------- |
| `currentBank` | Store | Svelte store tracking the current/selected bank |

---

### `@trampswealthy/obp-svelte-components/health-check`

| Export                 | Type     | Description                              |
| ---------------------- | -------- | ---------------------------------------- |
| `HealthCheckRegistry`  | Class    | Registry for health check handlers       |
| `healthCheckRegistry`  | Instance | Singleton instance of HealthCheckRegistry|
| `HealthCheckService`   | Class    | Service for performing health checks     |
| `HealthCheckState`     | Class    | Manages health check state               |
| `HealthCheckOptions`   | Type     | Configuration options                    |
| `HealthCheckSnapshot`  | Type     | Snapshot of health check state           |

---

### `@trampswealthy/obp-svelte-components/markdown`

| Export           | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `renderMarkdown` | Function | Renders markdown content to HTML  |

---

### `@trampswealthy/obp-svelte-components/config`

| Export                | Type     | Description                                       |
| --------------------- | -------- | ------------------------------------------------- |
| `buildMyAccountItems` | Function | Builds navigation items for "My Account" section  |
| `getActiveMenuItem`   | Function | Determines the currently active menu item         |
| `NavigationItem`      | Type     | Individual navigation item structure              |
| `NavigationConfig`    | Type     | Navigation configuration                          |

---

### `@trampswealthy/obp-svelte-components/server`

Re-exports everything from `server/oauth`, `server/redis`, `server/health-check`, and `server/obp`.

---

### `@trampswealthy/obp-svelte-components/server/oauth`

| Export                       | Type  | Description                                  |
| ---------------------------- | ----- | -------------------------------------------- |
| `OAuth2ClientWithConfig`     | Class | OAuth2 client with embedded configuration    |
| `OAuth2ProviderFactory`      | Class | Factory for creating OAuth2 providers        |
| `KeyCloakStrategy`           | Class | KeyCloak OAuth2 strategy implementation      |
| `OBPOIDCStrategy`            | Class | OBP OIDC strategy implementation             |
| `OAuth2ProviderManager`      | Class | Manages multiple OAuth2 providers            |
| `SessionOAuthHelper`         | Class | Helper for session-based OAuth operations    |
| `WellKnownUri`               | Type  | OAuth2 well-known configuration URI          |
| `OAuthProviderConfig`        | Type  | OAuth provider configuration                 |
| `ProviderStatus`             | Type  | Status of OAuth provider                     |
| `SessionOAuthData`           | Type  | OAuth data stored in session                 |
| `OpenIdConnectConfiguration` | Type  | OIDC configuration details                   |
| `OAuth2AccessTokenPayload`   | Type  | Access token payload structure               |

---

### `@trampswealthy/obp-svelte-components/server/redis`

| Export              | Type     | Description                                    |
| ------------------- | -------- | ---------------------------------------------- |
| `RedisService`      | Class    | Redis service for cache and session management |
| `createRedisService`| Function | Factory to create RedisService instances        |
| `RedisConfig`       | Type     | Redis configuration                            |

---

### `@trampswealthy/obp-svelte-components/server/health-check`

| Export                    | Type  | Description                                |
| ------------------------- | ----- | ------------------------------------------ |
| `RedisHealthCheckService` | Class | Health check service for Redis connectivity|

---

### `@trampswealthy/obp-svelte-components/server/obp`

| Export                          | Type     | Description                                   |
| ------------------------------- | -------- | --------------------------------------------- |
| `DefaultOBPIntegrationService`  | Class    | Default OBP integration service               |
| `OBPIntegrationService`        | Type     | Interface for OBP integration services        |
| `getOperationIds`              | Function | Retrieves cached operation IDs from OBP API   |
| `OperationIdEntry`             | Type     | Structure of an operation ID cache entry       |

---

## 4. Quick Migration Steps

1. **Install the package and peer dependencies:**
   ```bash
   npm install @trampswealthy/obp-svelte-components
   npm install svelte @skeletonlabs/skeleton @skeletonlabs/skeleton-svelte bits-ui @lucide/svelte
   ```

2. **Find and replace imports** across your codebase:
   ```bash
   # Using sed (adjust for your OS)
   find src -type f -name '*.ts' -o -name '*.svelte' | xargs sed -i \
     "s|\$lib/components|@trampswealthy/obp-svelte-components/components|g; \
      s|\$lib/opey|@trampswealthy/obp-svelte-components/opey|g; \
      s|\$lib/obp|@trampswealthy/obp-svelte-components/obp|g; \
      s|\$lib/utils|@trampswealthy/obp-svelte-components/utils|g; \
      s|\$lib/stores|@trampswealthy/obp-svelte-components/stores|g; \
      s|\$lib/health-check|@trampswealthy/obp-svelte-components/health-check|g; \
      s|\$lib/markdown|@trampswealthy/obp-svelte-components/markdown|g; \
      s|\$lib/config|@trampswealthy/obp-svelte-components/config|g; \
      s|\$lib/server/oauth|@trampswealthy/obp-svelte-components/server/oauth|g; \
      s|\$lib/server/redis|@trampswealthy/obp-svelte-components/server/redis|g; \
      s|\$lib/server/health-check|@trampswealthy/obp-svelte-components/server/health-check|g; \
      s|\$lib/server/obp|@trampswealthy/obp-svelte-components/server/obp|g; \
      s|\$lib/server|@trampswealthy/obp-svelte-components/server|g"
   ```

   > **Note:** Order matters in the sed command — more specific paths (e.g., `$lib/server/oauth`) must come before less specific ones (e.g., `$lib/server`).

3. **Remove the in-house `src/lib` copies** of the migrated modules.

4. **Verify the build:**
   ```bash
   npm run check
   npm run build
   npm run test
   ```

5. **If using server-side features**, install optional peer dependencies:
   ```bash
   npm install arctic svelte-kit-sessions svelte-kit-connect-redis ioredis
   ```
