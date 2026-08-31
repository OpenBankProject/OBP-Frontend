import { createLogger } from '@obp/shared/utils';
const logger = createLogger('UserActivityServer');
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import {
	OBPRequestError,
	buildMyMetricsQuery,
	buildMyMetricsSummaryQuery,
	summariseMetrics,
	buildMyMetricsConsumerOptions,
	MY_METRICS_PAGE_SIZE
} from '@obp/shared/obp';
import type {
	OBPConsumer,
	OBPMetric,
	OBPMetricsResponse,
	MyMetricsSummary
} from '@obp/shared/obp';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v7.0.0';

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, {
			message: 'Unauthorized: No access token found in session.'
		});
	}

	// Always carries an explicit from_date: without one the API only looks back
	// a few minutes and the page would appear empty.
	const { query, filters } = buildMyMetricsQuery(event.url.searchParams);
	const pageEndpoint = `/obp/${API_VERSION}/my/metrics?${query.toString()}`;
	const summaryEndpoint = `/obp/${API_VERSION}/my/metrics?${buildMyMetricsSummaryQuery(query).toString()}`;
	const consumersEndpoint = '/obp/v6.0.0/management/users/current/consumers';
	const apiExplorerUrl = env.API_EXPLORER_URL || '';

	// The visible page is the only fetch that decides the page's error state; the
	// summary tiles and the consumer dropdown degrade to "absent" on their own.
	const [pageResult, summaryResult, consumersResult] = await Promise.allSettled([
		obp_requests.get(pageEndpoint, token) as Promise<OBPMetricsResponse>,
		obp_requests.get(summaryEndpoint, token) as Promise<OBPMetricsResponse>,
		obp_requests.get(consumersEndpoint, token) as Promise<{ consumers: OBPConsumer[] }>
	]);

	let metrics: OBPMetric[] = [];
	let fetchError: string | null = null;
	if (pageResult.status === 'fulfilled') {
		metrics = pageResult.value?.metrics ?? [];
	} else {
		const e = pageResult.reason;
		logger.error('Error fetching my metrics:', e);
		fetchError =
			e instanceof OBPRequestError
				? e.message
				: 'Could not fetch your activity at this time. Please try again later.';
	}

	let summary: MyMetricsSummary | null = null;
	if (summaryResult.status === 'fulfilled') {
		summary = summariseMetrics(summaryResult.value?.metrics ?? []);
	} else {
		logger.error('Error fetching my metrics summary:', summaryResult.reason);
	}

	let myConsumers: OBPConsumer[] = [];
	if (consumersResult.status === 'fulfilled') {
		myConsumers = consumersResult.value?.consumers ?? [];
	} else {
		logger.error('Error fetching current user consumers:', consumersResult.reason);
	}

	return {
		metrics,
		filters,
		summary,
		consumerOptions: buildMyMetricsConsumerOptions(myConsumers, summary, filters.consumer_id),
		// The endpoint returns no total, so "more" means "this page was full".
		hasMore: metrics.length === MY_METRICS_PAGE_SIZE,
		pageSize: MY_METRICS_PAGE_SIZE,
		apiExplorerUrl,
		error: fetchError
	};
}
