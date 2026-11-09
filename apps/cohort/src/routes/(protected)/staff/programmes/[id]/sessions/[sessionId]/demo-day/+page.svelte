<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { GUEST_STATUSES, guestCounts } from '$lib/demoDay';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const scheduled = $derived(new Set(data.slots.map((s) => s.participant_id)));
	const counts = $derived(guestCounts(data.guests));
	const startupName = (id: string) => data.startups.find((s) => s.id === id)?.startup_name ?? id;
	const ERRORS = ['demo_slot_invalid', 'demo_slot_taken', 'demo_guest_missing', 'demo_feedback_missing'];
</script>

{#snippet role(key: keyof typeof data.lacking)}
	{#if missing(key)}<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
{/snippet}

<p><a class="anchor" href="/staff/programmes/{data.programme.id}/sessions">{data.programme.name}</a></p>
<h1 class="h2">{data.session.title}</h1>
<p class="mt-1">{data.session.starts_at.replace('T', ' ')}{#if data.session.location} · {data.session.location}{/if}</p>
<p class="mt-1"><a class="anchor" href="/demo-day/{data.session.id}" data-testid="demo-public-link">{t(locale, 'demo_public_page')}</a> · <span class="text-sm">{t(locale, 'demo_public_note')}</span></p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{ERRORS.includes(String(form.error)) ? t(locale, String(form.error) as MessageKey) : `${t(locale, 'staff_error')} ${String(form.error)}`}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="demo-slots">
	<h2 class="h4">{t(locale, 'demo_running_order')}</h2>
	{#if data.slots.length === 0}<p class="mt-2">{t(locale, 'demo_slots_none')}</p>{:else}
		<ol class="mt-2 flex flex-col gap-2">
			{#each data.slots as slot (slot.id)}
				<li class="flex flex-wrap items-center gap-2">
					<span class="badge preset-tonal">{slot.position}</span>
					{#if slot.starts_at}<span>{slot.starts_at}</span>{/if}
					<strong>{slot.startup_name}</strong>{#if slot.pitch_title}<span>· {slot.pitch_title}</span>{/if}
					{#if !missing('removeSlot')}
						<form method="POST" action="?/removeSlot"><input type="hidden" name="slot_id" value={slot.id} /><button class="btn btn-sm preset-tonal-error">{t(locale, 'demo_slot_remove')}</button></form>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	{@render role('slots')}
	{#if !missing('slots')}
		<form method="POST" action="?/addSlot" class="mt-3 flex flex-wrap items-end gap-2">
			<label class="label w-56"><span class="label-text">{t(locale, 'programme_startup')}</span>
				<select class="select select-sm" name="participant_id" required>{#each data.startups.filter((s) => !scheduled.has(s.id)) as s (s.id)}<option value={s.id}>{s.startup_name}</option>{/each}</select></label>
			<label class="label w-28"><span class="label-text">{t(locale, 'demo_slot_time')}</span><input class="input input-sm" type="time" name="starts_at" /></label>
			<label class="label w-64"><span class="label-text">{t(locale, 'demo_pitch_title')}</span><input class="input input-sm" name="pitch_title" maxlength="255" /></label>
			<button class="btn btn-sm preset-filled-primary-500" data-testid="demo-slot-add">{t(locale, 'demo_slot_add')}</button>
		</form>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="demo-guests">
	<h2 class="h4">{t(locale, 'demo_guests')}</h2>
	{@render role('guests')}
	{#if !missing('guests')}
		<p class="mt-1 text-sm">{GUEST_STATUSES.map((st) => `${t(locale, `demo_guest_${st}` as MessageKey)}: ${counts[st]}`).join(' · ')}</p>
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.guests as g (g.id)}
				<li class="flex flex-wrap items-center gap-2">
					<strong>{g.name}</strong>{#if g.organisation}<span>· {g.organisation}</span>{/if}{#if g.email}<span class="text-sm">· {g.email}</span>{/if}
					{#if missing('guestStatus')}
						<span class="badge preset-tonal">{t(locale, `demo_guest_${g.status}` as MessageKey)}</span>
					{:else}
						<form method="POST" action="?/guestStatus" class="flex items-center gap-1">
							<input type="hidden" name="guest_id" value={g.id} />
							<select class="select select-sm w-auto" name="status" aria-label={t(locale, 'demo_guest_status')}>{#each GUEST_STATUSES as st (st)}<option value={st} selected={st === g.status}>{t(locale, `demo_guest_${st}` as MessageKey)}</option>{/each}</select>
							<button class="btn btn-sm preset-tonal">{t(locale, 'emails_save')}</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{@render role('invite')}
	{#if !missing('invite')}
		<form method="POST" action="?/invite" class="mt-3 flex flex-wrap items-end gap-2">
			<label class="label w-48"><span class="label-text">{t(locale, 'demo_guest_name')}</span><input class="input input-sm" name="name" required maxlength="255" /></label>
			<label class="label w-48"><span class="label-text">{t(locale, 'demo_guest_organisation')}</span><input class="input input-sm" name="organisation" maxlength="255" /></label>
			<label class="label w-56"><span class="label-text">{t(locale, 'details_email')}</span><input class="input input-sm" type="email" name="email" maxlength="255" /></label>
			<button class="btn btn-sm preset-filled-primary-500" data-testid="demo-guest-invite">{t(locale, 'demo_guest_invite')}</button>
		</form>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="demo-feedback">
	<h2 class="h4">{t(locale, 'demo_feedback')}</h2>
	<p class="mt-1 text-sm">{t(locale, 'demo_feedback_intro')}</p>
	{@render role('feedback')}
	{#if !missing('feedback')}
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.feedback as f (f.id)}
				<li><strong>{startupName(f.participant_id)}</strong> <span class="text-sm">{f.given_at.slice(0, 10)} · {f.given_by_username}</span><p class="whitespace-pre-line">{f.feedback}</p></li>
			{/each}
		</ul>
	{/if}
	{@render role('giveFeedback')}
	{#if !missing('giveFeedback')}
		<form method="POST" action="?/feedback" class="mt-3 flex flex-col gap-2">
			<label class="label max-w-sm"><span class="label-text">{t(locale, 'programme_startup')}</span>
				<select class="select select-sm" name="participant_id" required>{#each data.startups as s (s.id)}<option value={s.id}>{s.startup_name}</option>{/each}</select></label>
			<label class="label"><span class="label-text">{t(locale, 'demo_feedback_text')}</span><textarea class="textarea" name="feedback" rows="3" maxlength="4000" required></textarea></label>
			<button class="btn btn-sm preset-filled-primary-500 self-start" data-testid="demo-feedback-give">{t(locale, 'demo_feedback_give')}</button>
		</form>
	{/if}
</section>
