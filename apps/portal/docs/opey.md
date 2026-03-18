# Opey
## Intro
Transitioning to a more dynamic user experience is a big part of the move to a new portal. Less baked-in information and more on-demand, tailored guidance using LLMs. Therefore making sure that Opey, our Open-Bank-Project-aware chatnot and agent, is working smoothly and efficiently, and can be deployed in a number of different ways is of high priority.

## Authenticating
As Opey is a seperate service to OBP-API, the sessions are managed seperately. Opey allows for anonymous, rate-limited (and request-limited) sessions for users to try it out. But users will need to authenticate after a while. 

The only currently supported method of authentication is using [consents](https://apiexplorer-ii-sandbox.openbankproject.com/glossary#Consent). Three things will need to be set for this flow to work:

- `PUBLIC_OPEY_BASE_URL` will need to be set in the environment variables to the base URL of your Opey service (e.g., `http://localhost:5000`)
- `PUBLIC_OPEY_CONSUMER_ID` will need to be set in the environment variables, so you will need to know what the Opey Consumer ID is on your OBP instance
- The **OBP API** props needs also to be set:
    ```json
    skip_consent_sca_for_consumer_id_pairs=[{ \
        "grantor_consumer_id": "<Portal Consumer ID>", \
        "grantee_consumer_id": "<Opey Consumer ID>" \
    }]
    ```
    the portal consumer ID should be found in API manager etc.

## CORS Configuration
If you're running Opey as a separate service, you'll need to configure CORS to allow cross-origin requests from the OBP-Portal. The Opey service must include the following CORS headers:

- `Access-Control-Allow-Origin`: Set to your OBP-Portal's origin (e.g., `http://localhost:5174`)
- `Access-Control-Allow-Methods`: Include `POST, GET, OPTIONS`
- `Access-Control-Allow-Headers`: Include `Content-Type, Authorization, Consent-JWT`
- `Access-Control-Allow-Credentials`: Set to `true` if using cookies

Without proper CORS configuration, you'll see errors like "Access to fetch at 'http://localhost:5000/stream' from origin 'http://localhost:5174' has been blocked by CORS policy".

Once the user has logged in to the portal, and the OpeyChat component is mounted (see `lib/components/OpeyChat.svelte`). The user will make a consent at OBP-API, which is sent to Opey in exchange for a session.

## Architecture
Built with reusability, flexibility, and modularity in mind we have tried to adhere as best as possible to SOLID design principles, and used [design patterns](https://refactoring.guru/design-patterns) where applicable.

Opey frontend is divided into State, Services, Controllers and Types. On a basic level, controllers orchestrate between services, which _do stuff_ and state which _knows stuff_.

### ChatService and RestChatService
ChatService is the Abstract class and RestChatService a concrete implementation of it. This is so that we might be able to implement different protocols i.e. WebSocketChatServices if needed in the future.

ChatService implements some key features of chat like sending a message, what to do when recieving a token etc.

Callbacks for streaming and errors are registered in the ChatController class using the .onStreamEvent method.