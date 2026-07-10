<script lang="ts">
	import type { PageData } from './$types';
	import { SystemStatusPage } from '@obp/shared/components';
	import { env } from '$env/dynamic/public';

	let { data }: { data: PageData } = $props();
</script>

<SystemStatusPage {data} title="System Status - API Manager" opeyPublicUrl={env.PUBLIC_OPEY_BASE_URL} />
