<script lang="ts">
	import { BellRing, ChartColumn, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, FileText, Inbox, KeyRound, Map as MapIcon, Megaphone, MessagesSquare, Rocket, Settings, UserCheck, UserRound, Users } from '@lucide/svelte';
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
		darkLogoUrl
	}: {
		locale: Locale;
		path: string;
		username: string | null;
		/** Holds a staff Role at the space: only then is the Staff section shown. */
		isStaff?: boolean;
		mode?: 'dark' | 'light';
		logoUrl: string;
		darkLogoUrl: string;
	} = $props();

	interface Item {
		href: string;
		label: MessageKey;
		icon: typeof FileText;
		public?: boolean;
		/** A sub menu, as in the API Manager: shown under the item, open while one of its pages is shown. */
		children?: Item[];
	}

	const allItems: Item[] = [
		{ href: '/', label: 'nav_calls', icon: Megaphone, public: true },
		{ href: '/applications', label: 'nav_my_applications', icon: FileText },
		{ href: '/programme', label: 'nav_my_programme', icon: Rocket },
		{ href: '/review', label: 'nav_review', icon: ClipboardCheck },
		{ href: '/conversations', label: 'nav_my_conversations', icon: MessagesSquare },
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
				{ href: '/staff/reviewers', label: 'nav_reviewers', icon: UserCheck },
				{ href: '/staff/reminders', label: 'nav_reminders', icon: BellRing },
				{ href: '/staff/setup', label: 'nav_setup', icon: Settings }
			]
		},
		{ href: '/sitemap', label: 'nav_sitemap', icon: MapIcon, public: true }
	];
	const items = $derived(allItems.filter((i) => (username || i.public) && (i.href !== '/staff' || isStaff)));

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
		class="btn w-full justify-start gap-3 {size}"
		class:preset-filled-primary-50-950={current === item.href}
		class:border={current === item.href}
		class:border-secondary-500={current === item.href}
		aria-current={current === item.href ? 'page' : undefined}
		data-testid="nav-{item.href === '/' ? 'calls' : item.href.slice(1).replace('/', '-')}"
	>
		<Icon class="size-5 shrink-0" aria-hidden="true" />
		<span>{t(locale, item.label)}</span>
	</a>
{/snippet}

<aside class="flex flex-col gap-4 border-e border-surface-100-900 bg-primary-50 p-3 md:overflow-y-auto dark:bg-primary-950">
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
								class="btn-icon btn-icon-sm"
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
</aside>
