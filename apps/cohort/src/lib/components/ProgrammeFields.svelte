<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/** The cohort_programme form fields, for creating and editing. `values` is the record being edited, if any. */
	let { locale, values = {} }: { locale: Locale; values?: Record<string, unknown> } = $props();
	const v = (key: string) => String(values[key] ?? '');
	const statuses = ['draft', 'open', 'closed'];
</script>

<label class="label"><span class="label-text">{t(locale, 'staff_field_name')} *</span><input class="input" name="name" required maxlength="255" value={v('name')} /></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_description')}</span><textarea class="textarea" name="description" rows="3" maxlength="4000" value={v('description')}></textarea></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_status')}</span>
	<select class="select" name="status">{#each statuses as s (s)}<option value={s} selected={s === v('status')}>{t(locale, `status_${s}` as MessageKey)}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_starts_on')}</span><input class="input" type="date" name="starts_on" value={v('starts_on')} /></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_ends_on')}</span><input class="input" type="date" name="ends_on" value={v('ends_on')} /></label>
