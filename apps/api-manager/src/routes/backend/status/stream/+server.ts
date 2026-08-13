import type { RequestHandler } from './$types';
import { sseProbeResponse } from '@obp/shared/health-check';

// SSE transport probe for the /status page: emits two spaced events so the
// browser can tell real streaming from a proxy-buffered response. Carries no
// data, so no auth — unlike the real metrics/log-cache stream endpoints.
export const GET: RequestHandler = async () => {
  return sseProbeResponse();
};
