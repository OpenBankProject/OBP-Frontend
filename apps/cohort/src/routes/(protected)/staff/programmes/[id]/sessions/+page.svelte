<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';
	import { SESSION_KINDS } from '$lib/sessions';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

<p><a class="anchor" href="/staff/programmes/{data.programme.id}">{data.programme.name}</a></p>
<h1 class="h2">{t(locale, 'sessions_heading')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{#if form.error === 'invalid'}{t(locale, 'sessions_error_invalid')}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'session' && form?.created}<p class="mt-4" role="status">{t(locale, 'sessions_created')}</p>{/if}
{#if form?.form === 'attendance' && form?.recorded}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'sessions_attendance_recorded')}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4">
	{@render roleNeeded('create')}
	{#if !missing('create')}
		<details>
			<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'sessions_add')}</summary>
			<form method="POST" action="?/createSession" class="mt-2 flex max-w-xl flex-col gap-2" data-testid="sessions-add">
				<label class="label"><span class="label-text">{t(locale, 'sessions_title')} *</span><input class="input" name="title" required maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'sessions_kind')}</span>
					<select class="select" name="kind">{#each SESSION_KINDS as k (k)}<option value={k}>{t(locale, `session_kind_${k}` as MessageKey)}</option>{/each}</select>
				</label>
				<div class="flex flex-wrap gap-3">
					<label class="label"><span class="label-text">{t(locale, 'sessions_starts')} *</span><input class="input w-auto" type="datetime-local" name="starts_at" required /></label>
					<label class="label"><span class="label-text">{t(locale, 'sessions_duration')}</span><input class="input w-24" type="number" name="duration_minutes" min="5" value="60" /></label>
					<label class="label"><span class="label-text">{t(locale, 'sessions_capacity')}</span><input class="input w-24" type="number" name="capacity" min="1" value="1" /></label>
				</div>
				<label class="label"><span class="label-text">{t(locale, 'sessions_mentor')}</span><input class="input" name="mentor_name" maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'sessions_location')}</span><input class="input" name="location" maxlength="1000" /></label>
				<button class="btn preset-filled self-start">{t(locale, 'staff_create')}</button>
			</form>
		</details>
	{/if}
</section>

<section class="mt-6" data-testid="sessions-list">
	{@render roleNeeded('read')}
	{@render roleNeeded('bookings')}
	{@render roleNeeded('participants')}
	{@render roleNeeded('attendance')}
	{@render roleNeeded('readAttendance')}
	{#if data.error}<p class="mt-2 preset-tonal-error rounded p-3">{data.error}</p>{/if}
	{#if data.sessions.length === 0}<p class="mt-2">{t(locale, 'sessions_none')}</p>{/if}
	{#each data.sessions as s (s.id)}
		<article class="card preset-outlined-surface-200-800 mt-3 p-4" data-testid="session-{s.id}">
			<h2 class="h4">{s.title}</h2>
			<p class="text-sm">
				{t(locale, `session_kind_${s.kind}` as MessageKey)} · {s.starts_at.replace('T', ' ')} · {s.duration_minutes} {t(locale, 'sessions_minutes')}
				{#if s.mentor_name}{' '}· {s.mentor_name}{/if}{#if s.location}{' '}· {s.location}{/if}
			</p>
			{#if s.kind === 'demo_day'}<p class="mt-1"><a class="anchor" href="/staff/programmes/{data.programme.id}/sessions/{s.id}/demo-day" data-testid="session-demo-day-{s.id}">{t(locale, 'demo_manage')}</a></p>{/if}
			<p class="mt-1 text-sm">{t(locale, 'sessions_booked')}: {s.booked.length} / {s.capacity}{#if s.booked.length}{' '}({s.booked.map((b) => b.startup_name).join(', ')}){/if}</p>
			{#if s.started && s.roll.length && !missing('attendance')}
				<form method="POST" action="?/attendance" class="mt-2" data-testid="session-attendance-{s.id}">
					<input type="hidden" name="session_id" value={s.id} />
					<fieldset class="flex flex-wrap gap-4">
						<legend class="label-text text-sm">{t(locale, 'sessions_who_attended')}</legend>
						{#each s.roll as p (p.id)}
							<input type="hidden" name="roll" value={p.id} />
							<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="attended" value={p.id} checked={p.attended === true} />{p.startup_name}</label>
						{/each}
					</fieldset>
					<button class="btn btn-sm preset-tonal mt-2">{t(locale, 'sessions_record_attendance')}</button>
				</form>
			{/if}
		</article>
	{/each}
</section>
