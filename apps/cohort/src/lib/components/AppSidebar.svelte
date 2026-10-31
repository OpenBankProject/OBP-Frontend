<script lang="ts">
	import { FileText, KeyRound, LogOut, Megaphone, Settings, Users } from '@lucide/svelte';
	import LanguageSwitch from '$lib/components/LanguageSwitch.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/**
	 * The navigation of the logged-in pages, in the Portal's style. It sits on the start side (right in Arabic),
	 * and across the top on small screens.
	 */
	let { locale, path, username }: { locale: Locale; path: string; username: string } = $props();

	const items: { href: string; label: MessageKey; icon: typeof FileText }[] = [
		{ href: '/', label: 'nav_calls', icon: Megaphone },
		{ href: '/applications', label: 'nav_my_applications', icon: FileText },
		{ href: '/staff', label: 'nav_staff', icon: Users },
		{ href: '/staff/access', label: 'nav_access', icon: KeyRound },
		{ href: '/setup', label: 'nav_setup', icon: Settings }
	];

	const pathname = $derived(path.split('?')[0]);
	const matches = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
	/** The item for the current page: the longest matching href, so /staff/access does not also light up /staff. */
	const current = $derived(
		items.filter((i) => matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href
	);
</script>

<aside class="flex flex-col gap-4 bg-primary-50 p-3 md:h-screen md:sticky md:top-0 dark:bg-primary-950">
	<a href="/" class="px-3 pt-2 text-lg font-semibold" data-testid="brand">{t(locale, 'app_name')}</a>
	<nav aria-label={t(locale, 'nav_main')}>
		<ul class="flex flex-wrap gap-1 md:flex-col">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				<li>
					<a
						href={item.href}
						class="btn w-full justify-start gap-3 px-3 py-2"
						class:preset-filled-primary-500={current === item.href}
						aria-current={current === item.href ? 'page' : undefined}
						data-testid="nav-{item.href === '/' ? 'calls' : item.href.slice(1).replace('/', '-')}"
					>
						<Icon class="size-5 shrink-0" aria-hidden="true" />
						<span>{t(locale, item.label)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	<div class="mt-auto flex flex-col gap-3 border-t border-surface-200-800 px-3 pt-3">
		<span class="truncate text-sm" data-testid="header-username">{username}</span>
		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="/logout">
				<button type="submit" class="btn btn-sm preset-tonal gap-2" data-testid="logout">
					<LogOut class="size-4" aria-hidden="true" />{t(locale, 'logout')}
				</button>
			</form>
			<LanguageSwitch {locale} {path} />
		</div>
	</div>
</aside>
