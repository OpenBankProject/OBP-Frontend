import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("BanksAPI");

export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const endpoint = `/obp/v6.0.0/banks`;
    const accessToken = session.data.oauth?.access_token;
    const response = await obp_requests.get(endpoint, accessToken);

    const banks = (response.banks || []).filter(
      (b: any) => b.bank_id != null,
    );

    return json({
      banks,
      count: banks.length,
    });
  } catch (error: any) {
    logger.error("Error fetching banks:", error);

    return json(
      {
        banks: [],
        count: 0,
        error: error.message || "Internal Server Error",
      },
      { status: 500 },
    );
  }
};
