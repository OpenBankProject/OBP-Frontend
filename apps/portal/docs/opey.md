# Opey
## Intro
Transitioning to a more dynamic user experience is a big part of the move to a new portal. Less baked-in information and more on-demand, tailored guidance using LLMs. Therefore making sure that Opey, our Open-Bank-Project-aware chatnot and agent, is working smoothly and efficiently, and can be deployed in a number of different ways is of high priority.

## Authenticating
As Opey is a seperate service to OBP-API, the sessions are managed seperately. Opey allows for anonymous, rate-limited (and request-limited) sessions for users to try it out. But users will need to authenticate after a while. 

The only currently supported method of authentication is using [consents](https://apiexplorer-ii-sandbox.openbankproject.com/glossary#Consent). Three things will need to be set for this flow to work:

- `OPEY_BASE_URL` will need to be set in the environment variables to the base URL of your Opey service as seen from the Portal server (e.g., `http://localhost:5000`). `PUBLIC_OPEY_BASE_URL` is informational only (status page, connection popover): the browser never calls Opey itself.
- `PUBLIC_OPEY_CONSUMER_ID` will need to be set in the environment variables, so you will need to know what the Opey Consumer ID is on your OBP instance
- The **OBP API** props needs also to be set:
    ```json
    skip_consent_sca_for_consumer_id_pairs=[{ \
        "grantor_consumer_id": "<Portal Consumer ID>", \
        "grantee_consumer_id": "<Opey Consumer ID>" \
    }]
    ```
    the portal consumer ID should be found in API manager etc.

## The Opey proxy (one interception point)
The browser never talks to Opey directly. Every call the chat makes (`create-session` via `auth`, `stream`, `regenerate`, `stop`, `invoke`, `status`, `mermaid_diagram`) goes to this app's own `/backend/opey/*` routes, which forward it to `OPEY_BASE_URL` server-side. The handlers come from `@obp/shared/server/opey` (`createOpeyProxyHandlers`) and are configured once per app in `src/lib/server/opey/proxy.ts`; the API Manager uses the same factory. No CORS configuration is needed on Opey for the apps, and only Opey's own session cookie is forwarded to it (the app's session cookie never leaves the app).

Because all Opey traffic passes through the proxy, that is also where conversations are recorded, whichever page embeds the chat: the stream handler tees Opey's server-sent events, keeps the messages that completed, and writes the turn as the logged-in user into the app's personal dynamic entity (`obp_portal_opey_conversation` here, `obp_manager_opey_conversation` in the API Manager; one row per thread, visible under My Data). The consent a turn used is recorded by its `consent_reference_id`. The outcome is appended to the stream as a `conversation_recorded` event so the chat can show whether it is being saved. Anonymous sessions are relayed but not recorded; `invoke` (the Insight Bar's one-shot calls) is not recorded either.

POSTs to `/backend/opey/*` are rate limited per IP (`RATE_LIMIT_OPEY`, default 30/m).

Once the user has logged in to the portal, and the OpeyChat component is mounted (see `packages/shared/src/lib/components/OpeyChat.svelte`, imported via `@obp/shared/components`). The user will make a consent at OBP-API, which is sent to Opey in exchange for a session.

## Architecture
Built with reusability, flexibility, and modularity in mind we have tried to adhere as best as possible to SOLID design principles, and used [design patterns](https://refactoring.guru/design-patterns) where applicable.

Opey frontend is divided into State, Services, Controllers and Types. On a basic level, controllers orchestrate between services, which _do stuff_ and state which _knows stuff_.

### ChatService and RestChatService
ChatService is the Abstract class and RestChatService a concrete implementation of it. This is so that we might be able to implement different protocols i.e. WebSocketChatServices if needed in the future.

ChatService implements some key features of chat like sending a message, what to do when recieving a token etc.

Callbacks for streaming and errors are registered in the ChatController class using the .onStreamEvent method.