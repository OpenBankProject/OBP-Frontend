import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { renderMarkdown } from "@obp/shared/markdown";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { loadDynamicCodeApprovalConfig } from "$lib/server/dynamicCodeApproval";
import {
  fetchGlossary,
  findGlossaryItem,
  rewriteGlossaryLinks,
  glossaryEntryUrl,
  apiExplorerBaseUrl,
} from "$lib/server/glossaryCache";

const logger = createLogger("DynamicResourceDocsHelp");

/** The glossary entries this page is made of, in display order. The text lives in OBP, not here. */
const GLOSSARY_TITLES = ["Dynamic Resource Doc", "Dynamic Change Request"] as const;
const CHANGE_REQUEST_TAG = "Dynamic-Change-Request";
const CHANGE_REQUEST_DOCS_PATH = `/obp/v7.0.0/resource-docs/v7.0.0/obp?tags=${CHANGE_REQUEST_TAG}`;

export interface HelpGlossarySection {
  title: string;
  html: string | null;
  explorerUrl: string;
}

export interface ChangeRequestEndpoint {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
  roles: string[];
  explorerUrl: string;
}

const VERB_ORDER: Record<string, number> = { GET: 0, POST: 1, PUT: 2, DELETE: 3 };

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const explorerUrl = apiExplorerBaseUrl();
  const warnings: string[] = [];

  const [approval, glossary, endpoints] = await Promise.all([
    loadDynamicCodeApprovalConfig(token),
    fetchGlossary(token, force).catch((e) => {
      logger.warn("Could not load the OBP glossary:", e);
      warnings.push(`Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }),
    obp_requests
      .get(CHANGE_REQUEST_DOCS_PATH, token)
      .then((resp) =>
        ((resp?.resource_docs ?? []) as any[])
          .map<ChangeRequestEndpoint>((d) => ({
            operation_id: d.operation_id,
            request_verb: d.request_verb,
            request_url: d.request_url,
            summary: d.summary,
            roles: (d.roles ?? []).map((r: { role: string }) => r.role),
            explorerUrl: `${explorerUrl}/resource-docs/OBPv7.0.0?operationid=${d.operation_id}`,
          }))
          .sort(
            (a, b) =>
              a.request_url.localeCompare(b.request_url) ||
              (VERB_ORDER[a.request_verb] ?? 9) - (VERB_ORDER[b.request_verb] ?? 9),
          ),
      )
      .catch((e) => {
        logger.warn("Could not load the v7 change-request resource docs:", e);
        warnings.push(`Could not load the ${CHANGE_REQUEST_TAG} resource docs from OBP: ${e instanceof Error ? e.message : String(e)}`);
        return [] as ChangeRequestEndpoint[];
      }),
  ]);

  const sections: HelpGlossarySection[] = GLOSSARY_TITLES.map((title) => {
    const item = findGlossaryItem(glossary, title);
    if (!item) {
      warnings.push(`This OBP instance has no glossary entry "${title}".`);
    }
    return {
      title,
      // markdown-it with its default html:false escapes any raw HTML in the source, so this is safe to {@html}.
      html: item ? renderMarkdown(rewriteGlossaryLinks(item.description.markdown, explorerUrl)) : null,
      explorerUrl: glossaryEntryUrl(title, explorerUrl),
    };
  });

  return {
    approval,
    sections,
    endpoints,
    changeRequestTag: CHANGE_REQUEST_TAG,
    explorerUrl,
    warnings,
  };
};
