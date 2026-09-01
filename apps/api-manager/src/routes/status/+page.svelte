<script lang="ts">
	import type { PageData } from './$types';
	import { SystemStatusPage } from '@obp/shared/components';
	import { env } from '$env/dynamic/public';

	let { data }: { data: PageData } = $props();
</script>

<SystemStatusPage
	{data}
	title="System Status - API Manager"
	opeyPublicUrl={env.PUBLIC_OPEY_BASE_URL}
	buildInfo={{
		version: __APP_VERSION__,
		commit: __GIT_COMMIT__,
		branch: __GIT_BRANCH__,
		buildTime: __BUILD_TIME__
	}}
/>
