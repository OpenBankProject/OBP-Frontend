<script lang="ts">
	import { Archive, Bell, BellRing, Bookmark as BookmarkIcon, Building2, ChartColumn, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, FileText, MessageCircle, Newspaper, Inbox, KeyRound, Megaphone, MessagesSquare, Rocket, Settings, UserCheck, UserRound, Users } from '@lucide/svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/**
	 * The navigation of every page, in the Portal's style. It sits on the start side (right in Arabic), and across
	 * the top on small screens. Visitors who are not logged in see only the public pages.
	 */
	let {
		locale,
		path,
		username,
		isStaff = false,
		mode = 'dark',
		logoUrl,
		darkLogoUrl,
		pages = []
	}: {
		locale: Locale;
		path: string;
		username: string | null;
		/** Holds a staff Role at the space: only then is the Staff section shown. */
		isStaff?: boolean;
		mode?: 'dark' | 'light';
		logoUrl: string;
		darkLogoUrl: string;
		/** The pages published to Cohort with App Studio, in menu order: shown to everyone, after Calls. */
		pages?: { slug: string; title: string }[];
	} = $props();

	interface Item {
		href: string;
		label: MessageKey;
		/** Text shown instead of the label's message, for a page's own title. */
		text?: string;
		icon: typeof FileText;
		public?: boolean;
		/** A sub menu, as in the API Manager: shown under the item, open while one of its pages is shown. */
		children?: Item[];
	}

	const allItems: Item[] = [
		{ href: '/', label: 'nav_calls', icon: Megaphone, public: true },
		{ href: '/updates', label: 'nav_updates', icon: Bell },
		{ href: '/applications', label: 'nav_my_applications', icon: FileText },
		{ href: '/saved', label: 'nav_saved', icon: BookmarkIcon },
		{ href: '/programme', label: 'nav_my_programme', icon: Rocket },
		{ href: '/review', label: 'nav_review', icon: ClipboardCheck },
		{ href: '/conversations', label: 'nav_my_conversations', icon: MessagesSquare },
		{ href: '/discussions', label: 'nav_discussions', icon: MessageCircle },
		{
			href: '/staff',
			label: 'nav_staff',
			icon: Users,
			children: [
				{ href: '/staff/dashboard', label: 'nav_dashboard_staff', icon: ChartColumn },
				{ href: '/staff/access', label: 'nav_access', icon: KeyRound },
				{ href: '/staff/applications', label: 'nav_staff_applications', icon: Inbox },
				{ href: '/staff/conversations', label: 'nav_conversations', icon: MessagesSquare },
				{ href: '/staff/forms', label: 'nav_forms', icon: ClipboardList },
				{ href: '/staff/participants', label: 'nav_participants', icon: UserRound },
				{ href: '/staff/organisations', label: 'nav_organisations', icon: Building2 },
				{ href: '/staff/reviewers', label: 'nav_reviewers', icon: UserCheck },
				{ href: '/staff/announcements', label: 'nav_announcements', icon: Newspaper },
				{ href: '/staff/reminders', label: 'nav_reminders', icon: BellRing },
				{ href: '/staff/retention', label: 'nav_retention', icon: Archive },
				{ href: '/staff/setup', label: 'nav_setup', icon: Settings }
			]
		}
	];
	const pageItems = $derived(pages.map((p): Item => ({ href: `/pages/${p.slug}`, label: 'nav_pages', text: p.title, icon: FileText, public: true })));
	const items = $derived(
		[allItems[0], ...pageItems, ...allItems.slice(1)].filter((i) => (username || i.public) && (i.href !== '/staff' || isStaff))
	);

	const pathname = $derived(path.split('?')[0]);
	const matches = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
	/** The item for the current page: the longest matching href, so /staff/access does not also light up /staff. */
	const current = $derived(
		items
			.flatMap((i) => [i, ...(i.children ?? [])])
			.filter((i) => matches(i.href))
			.sort((a, b) => b.href.length - a.href.length)[0]?.href
	);

	/** Sub menus the visitor opened or closed; until then a sub menu is open while one of its pages is shown. */
	let toggled = $state<Record<string, boolean>>({});
	const isOpen = (item: Item) => toggled[item.href] ?? matches(item.href);
</script>

{#snippet link(item: Item, size: string)}
	{@const Icon = item.icon}
	<a
		href={item.href}
		class="btn h-auto w-full min-w-0 justify-start gap-3 text-start whitespace-normal {size}"
		class:preset-filled-primary-50-950={current === item.href}
		class:border={current === item.href}
		class:border-secondary-500={current === item.href}
		aria-current={current === item.href ? 'page' : undefined}
		data-testid="nav-{item.href === '/' ? 'calls' : item.href.slice(1).replace('/', '-')}"
	>
		<Icon class="size-5 shrink-0" aria-hidden="true" />
		<span class="min-w-0 break-words">{item.text ?? t(locale, item.label)}</span>
	</a>
{/snippet}

<aside class="flex flex-col gap-4 border-e border-surface-100-900 bg-primary-50 p-3 md:overflow-x-hidden md:overflow-y-auto dark:bg-primary-950">
	<a href="/" class="px-3 pt-2" data-testid="brand">
		<img src={mode === 'dark' ? darkLogoUrl : logoUrl} alt={t(locale, 'nav_home')} class="w-40" />
	</a>
	<nav aria-label={t(locale, 'nav_main')}>
		<ul class="flex flex-wrap gap-1 md:flex-col">
			{#each items as item (item.href)}
				<li>
					<div class="flex items-center gap-1">
						{@render link(item, 'px-3 py-2')}
						{#if item.children}
							<button
								type="button"
								class="btn-icon btn-icon-sm shrink-0"
								aria-expanded={isOpen(item)}
								aria-label={t(locale, isOpen(item) ? 'nav_close_menu' : 'nav_open_menu')}
								onclick={() => (toggled[item.href] = !isOpen(item))}
								data-testid="nav-toggle-{item.href.slice(1)}"
							>
								{#if isOpen(item)}<ChevronDown class="size-4" aria-hidden="true" />{:else}<ChevronRight class="size-4 rtl:rotate-180" aria-hidden="true" />{/if}
							</button>
						{/if}
					</div>
					{#if item.children && isOpen(item)}
						<ul class="ms-6 mt-1 flex flex-col gap-1 border-s border-surface-300-700 ps-2">
							{#each item.children as child (child.href)}<li>{@render link(child, 'px-3 py-1.5 text-sm')}</li>{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
	<footer class="mt-auto flex flex-wrap gap-x-3 gap-y-1 px-3 pt-2 pb-1 text-xs text-surface-700-300" data-testid="sidebar-footer">
		<a class="hover:underline" href="/sitemap" aria-current={pathname === '/sitemap' ? 'page' : undefined} data-testid="nav-sitemap">{t(locale, 'nav_sitemap')}</a>
		{#if username}<a class="hover:underline" href="/setup" aria-current={pathname === '/setup' ? 'page' : undefined} data-testid="nav-setup">{t(locale, 'nav_platform_setup')}</a>{/if}
	</footer>
</aside>
