import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";
import { renderMarkdown } from "@obp/shared/markdown";
import {
  fetchGlossary,
  findGlossaryItem,
  rewriteGlossaryLinks,
  glossaryEntryUrl,
  apiExplorerBaseUrl,
} from "$lib/server/glossaryCache";

const logger = createLogger("RateLimitingHelp");

/** The glossary entry that explains rate limiting on the OBP instance. */
const GLOSSARY_TITLE = "Rate Limiting";
/** The section of that entry this page shows; the rest of the entry is long and lives in the API Explorer. */
const SECTION_HEADING = "### Three rate limiters";

/** The markdown of one `### ` section: from its heading up to the next `### ` heading. */
function sectionOf(markdown: string, heading: string): string | null {
  const start = markdown.indexOf(heading);
  if (start < 0) return null;
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n###? /);
  return (heading + (next < 0 ? rest : rest.slice(0, next))).trim();
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const explorerUrl = apiExplorerBaseUrl();
  const warnings: string[] = [];
  let sectionHtml: string | null = null;

  try {
    const item = findGlossaryItem(
      await fetchGlossary(token, force),
      GLOSSARY_TITLE,
    );
    if (!item) {
      warnings.push(
        `This OBP instance has no glossary entry "${GLOSSARY_TITLE}".`,
      );
    } else {
      const section = sectionOf(item.description.markdown, SECTION_HEADING);
      if (section) {
        // markdown-it with html:false escapes raw HTML in the source, so this is safe to {@html}.
        sectionHtml = renderMarkdown(
          rewriteGlossaryLinks(section, explorerUrl),
        );
      } else {
        warnings.push(
          `The "${GLOSSARY_TITLE}" glossary entry on this OBP instance has no "${SECTION_HEADING.replace("### ", "")}" section.`,
        );
      }
    }
  } catch (e) {
    logger.warn("Could not load the OBP glossary:", e);
    warnings.push(
      `Could not load the glossary from OBP: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return {
    glossary: {
      title: GLOSSARY_TITLE,
      html: sectionHtml,
      explorerUrl: glossaryEntryUrl(GLOSSARY_TITLE, explorerUrl),
    },
    explorerUrl,
    warnings,
  };
};
