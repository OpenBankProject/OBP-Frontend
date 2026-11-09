<script lang="ts">
	import { RESOURCE_TYPES, RETENTION_ACTIONS, type RetentionPolicy } from '$lib/retention';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/** The fields of a retention policy, for adding one or changing it. */
	let { locale, entityNames, values }: { locale: Locale; entityNames: string[]; values?: Partial<RetentionPolicy> } = $props();
</script>

<label class="label"><span class="label-text">{t(locale, 'retention_resource')}</span>
	<select class="select select-sm" name="resource_type">{#each RESOURCE_TYPES as r (r)}<option value={r} selected={r === (values?.resource_type ?? 'dynamic_entity_record')}>{t(locale, `retention_resource_${r}` as MessageKey)}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'retention_entity')}</span>
	<select class="select select-sm" name="entity_name"><option value="">–</option>{#each entityNames as n (n)}<option value={n} selected={n === values?.entity_name}>{n}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'retention_date_basis')}</span><input class="input input-sm" name="date_basis" value={values?.date_basis ?? 'created'} maxlength="100" /></label>
<label class="label"><span class="label-text">{t(locale, 'retention_condition')}</span><input class="input input-sm" name="condition" value={values?.condition ?? ''} maxlength="200" placeholder="status=draft" /></label>
<label class="label"><span class="label-text">{t(locale, 'retention_retain_days')}</span><input class="input input-sm" type="number" min="1" name="retain_days" required value={values?.retain_days ?? ''} /></label>
<label class="label"><span class="label-text">{t(locale, 'retention_action')}</span>
	<select class="select select-sm" name="action">{#each RETENTION_ACTIONS as a (a)}<option value={a} selected={a === (values?.action ?? 'archive')}>{t(locale, `retention_action_${a}` as MessageKey)}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'retention_archive_days')}</span><input class="input input-sm" type="number" min="1" name="archive_days" value={values?.archive_days ?? ''} /></label>
<div class="flex flex-col gap-1 text-sm">
	<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="cascade" checked={values?.cascade ?? false} />{t(locale, 'retention_cascade')}</label>
	<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="requires_approval" checked={values?.requires_approval ?? true} />{t(locale, 'retention_requires_approval')}</label>
	<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="enabled" checked={values?.enabled ?? false} />{t(locale, 'retention_enabled')}</label>
</div>
