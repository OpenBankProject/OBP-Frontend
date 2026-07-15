// App wiring only — strategy, factory and manager logic lives in @obp/shared/server/oauth.
import { env } from "$env/dynamic/private";
import {
  OAuth2ProviderFactory,
  KeyCloakStrategy,
  OBPOIDCStrategy,
  GoogleStrategy,
} from "@obp/shared/server/oauth";

export type { WellKnownUri } from "@obp/shared/server/oauth";
export { OAuth2ProviderFactory } from "@obp/shared/server/oauth";

export const oauth2ProviderFactory = new OAuth2ProviderFactory([
  new KeyCloakStrategy({
    clientId: env.KEYCLOAK_OAUTH_CLIENT_ID,
    clientSecret: env.KEYCLOAK_OAUTH_CLIENT_SECRET,
    callbackUrl: env.APP_CALLBACK_URL,
  }),
  new OBPOIDCStrategy({
    clientId: env.OBP_OAUTH_CLIENT_ID,
    clientSecret: env.OBP_OAUTH_CLIENT_SECRET,
    callbackUrl: env.APP_CALLBACK_URL,
  }),
  new GoogleStrategy({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    callbackUrl: env.APP_CALLBACK_URL,
  }),
]);
