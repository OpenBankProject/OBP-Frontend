<script lang="ts">
	import { OpeyChat, CurrentBankPicker, AccountScopePicker } from '@obp/shared/components';
	import { renderTextWithLinks } from '@obp/shared/markdown';
	import type { OpeyChatOptions, SuggestedQuestion } from '@obp/shared/components';
	import { PORTAL_OPEY_CONVERSATION_ENTITY_NAME } from '@obp/shared/opey';
    import { CheckCheck, Layers, Rocket, UserLock, HelpCircle } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';
	import { page } from '$app/stores';
	import { currentBank } from '$lib/stores/currentBank.svelte';

	let { data } = $props();

	// Get the 'ask' query parameter from URL (used by "Tell Me More" links)
	const askParam = $derived($page.url.searchParams.get('ask'));
	let name = data.username || 'Guest';
	let isAuthenticated = !!data.userId;

	// Configurable text via environment variables
	const welcomeTitle = env.PUBLIC_WELCOME_TITLE || 'Welcome!';
	const helpQuestion = env.PUBLIC_HELP_QUESTION || 'How can I help?';
	const welcomeDescription = env.PUBLIC_WELCOME_DESCRIPTION || 'Welcome to the Open Bank Project sandbox — where developers, Fintechs, and banks can build and test innovative open banking ++ solutions.';
	// Supports markdown-style links, e.g. "See [the docs](https://example.com)";
	// everything else is escaped, so the result is safe for {@html}
	const welcomeDescriptionHtml = renderTextWithLinks(welcomeDescription, {
		// primary-* is near-black in the OBP theme, so use tertiary for a visible hover
		linkClass: 'underline hover:text-tertiary-600 dark:hover:text-tertiary-400'
	});

	// Icon mapping for configurable questions
    const iconMap: Record<string, typeof Rocket> = {
        Rocket,
        UserLock,
        CheckCheck,
        Layers,
        HelpCircle
    };

    const defaultQuestions: SuggestedQuestion[] = [
        { questionString: 'How can I get started with the Open Bank Project?', pillTitle: 'Getting Started', icon: Rocket },
        { questionString: 'How do I authenticate with the Open Bank Project?', pillTitle: 'Authentication', icon: UserLock },
        { questionString: 'How do I use consents within the Open Bank Project?', pillTitle: 'Consents', icon: CheckCheck },
        { questionString: 'What SDKs are available for the Open Bank Project?', pillTitle: 'SDKs', icon: Layers }
    ];

    function parseSuggestedQuestions(): SuggestedQuestion[] {
        const jsonString = env.PUBLIC_SUGGESTED_QUESTIONS;
        if (!jsonString) return defaultQuestions;

        try {
            const parsed = JSON.parse(jsonString) as Array<{ questionString: string; pillTitle: string; icon: string }>;
            return parsed.map((q) => ({
                questionString: q.questionString,
                pillTitle: q.pillTitle,
                icon: iconMap[q.icon] || HelpCircle
            }));
        } catch {
            console.warn('Failed to parse PUBLIC_SUGGESTED_QUESTIONS, using defaults');
            return defaultQuestions;
        }
    }

    const suggestedQuestions: SuggestedQuestion[] = parseSuggestedQuestions();


	let opeyChatOptions: Partial<OpeyChatOptions> = $derived({
		baseUrl: env.PUBLIC_OPEY_BASE_URL,
		displayHeader: false,
		currentlyActiveUserName: name,
		suggestedQuestions: suggestedQuestions,
		bodyClasses: 'bg-opacity-0',
		footerClasses: 'bg-opacity-0',
		displayConnectionPips: true,
		consentMetricsHref: '/user/my-activity-dashboard',
		initialUserMessage: askParam || undefined,
		conversationEntityName: PORTAL_OPEY_CONVERSATION_ENTITY_NAME,
	});
	
</script>

<div class="flex h-full w-full items-start justify-center px-4 pb-4">
	<div class="flex h-full w-full max-w-4xl flex-col gap-3 xl:max-w-6xl 2xl:max-w-7xl">
		<OpeyChat {opeyChatOptions} userAuthenticated={isAuthenticated} currentBankId={currentBank.bankId}>
			{#snippet splash()}
				<div class="flex w-2/3 flex-col items-center justify-center text-center">
					<h1 class="h3 text-surface-700-300 mb-2">{welcomeTitle}</h1>
					<h1 class="h3 mb-4">{helpQuestion}</h1>
					<p class="text-surface-700-300 mb-7 text-sm">
						{@html welcomeDescriptionHtml}
					</p>
				</div>
			{/snippet}
			{#snippet belowSuggestions()}
				<div class="flex flex-col items-center gap-2 px-4 pb-2 text-surface-950-50">
					<CurrentBankPicker store={currentBank} />
					{#if isAuthenticated}
						<AccountScopePicker bankStore={currentBank} />
					{/if}
				</div>
			{/snippet}
		</OpeyChat>
	</div>
</div>
