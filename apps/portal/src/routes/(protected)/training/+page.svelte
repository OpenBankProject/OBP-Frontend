<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { trainingSections } from '$lib/data/trainingTopics';

	// Per-topic progress, keyed `${sectionId}/${topicId}`. Backed by the training_progress
	// personal dynamic entity: each user only ever sees and writes their own records.
	interface TopicProgress {
		recordId?: string;
		interested: boolean;
		covered: boolean;
		notes: string;
	}

	const ENTITY_PATH = '/proxy/obp/dynamic-entity/my/training_progress';

	// Deep link to the API Manager's create form, prefilled with this entity's definition.
	const managerBase = page.data.externalLinks?.API_MANAGER_URL;
	const managerCreateUrl = managerBase
		? `${managerBase}/dynamic-entities/system/create?template=training-progress`
		: '';

	let progress = $state<Record<string, TopicProgress>>({});
	let loading = $state(true);
	let entityMissing = $state(false);
	let errorMessage = $state('');
	let savingKeys = $state<Record<string, boolean>>({});

	const key = (sectionId: string, topicId: string) => `${sectionId}/${topicId}`;

	const totalTopics = trainingSections.reduce((n, s) => n + s.topics.length, 0);
	let interestedCount = $derived(Object.values(progress).filter((p) => p.interested).length);
	let coveredCount = $derived(Object.values(progress).filter((p) => p.covered).length);

	function sectionCovered(sectionId: string): number {
		return trainingSections
			.find((s) => s.id === sectionId)!
			.topics.filter((t) => progress[key(sectionId, t.id)]?.covered).length;
	}

	function getProgress(sectionId: string, topicId: string): TopicProgress {
		return progress[key(sectionId, topicId)] ?? { interested: false, covered: false, notes: '' };
	}

	onMount(load);

	async function load() {
		loading = true;
		errorMessage = '';
		try {
			const res = await fetch(ENTITY_PATH);
			if (!res.ok) {
				const body = await res.text();
				// A missing entity definition surfaces as an unmatched route / unknown entity error.
				if (res.status === 404 || /OBP-31001|DynamicEntity|not found/i.test(body)) {
					entityMissing = true;
				} else {
					errorMessage = `Could not load your training progress (HTTP ${res.status}).`;
				}
				return;
			}
			const data = await res.json();
			const records: Record<string, unknown>[] = data.training_progress_list ?? [];
			const next: Record<string, TopicProgress> = {};
			for (const r of records) {
				const sectionId = String(r.section_id ?? '');
				const topicId = String(r.topic_id ?? '');
				if (!sectionId || !topicId) continue;
				next[key(sectionId, topicId)] = {
					recordId: String(r.training_progress_id ?? ''),
					interested: r.interested === true || r.interested === 'true',
					covered: r.covered === true || r.covered === 'true',
					notes: String(r.notes ?? '')
				};
			}
			progress = next;
		} catch {
			errorMessage = 'Could not load your training progress. Check your connection and reload.';
		} finally {
			loading = false;
		}
	}

	async function save(sectionId: string, topicId: string, patch: Partial<TopicProgress>) {
		const k = key(sectionId, topicId);
		const before = getProgress(sectionId, topicId);
		const updated: TopicProgress = { ...before, ...patch };
		progress = { ...progress, [k]: updated };
		savingKeys = { ...savingKeys, [k]: true };
		errorMessage = '';
		try {
			const body = JSON.stringify({
				section_id: sectionId,
				topic_id: topicId,
				interested: updated.interested,
				covered: updated.covered,
				notes: updated.notes
			});
			const res = updated.recordId
				? await fetch(`${ENTITY_PATH}/${encodeURIComponent(updated.recordId)}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body
					})
				: await fetch(ENTITY_PATH, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body
					});
			if (!res.ok) {
				progress = { ...progress, [k]: before };
				errorMessage = `Could not save "${topicId}" (HTTP ${res.status}).`;
				return;
			}
			const data = await res.json();
			const record = data.training_progress ?? data;
			if (record?.training_progress_id) {
				progress = { ...progress, [k]: { ...updated, recordId: String(record.training_progress_id) } };
			}
		} catch {
			progress = { ...progress, [k]: before };
			errorMessage = 'Could not save your change. Check your connection and try again.';
		} finally {
			const { [k]: _, ...rest } = savingKeys;
			savingKeys = rest;
		}
	}

	function onNotesBlur(sectionId: string, topicId: string, event: Event) {
		const value = (event.target as HTMLInputElement).value;
		const current = getProgress(sectionId, topicId);
		if (value !== current.notes) {
			save(sectionId, topicId, { notes: value });
		}
	}

	const entityDefinition = `{
  "hasPersonalEntity": true,
  "training_progress": {
    "description": "Per-user progress through the OBP training curriculum. Personal entity: each user records which topics they are interested in and have covered, plus notes.",
    "required": ["section_id", "topic_id"],
    "properties": {
      "section_id": { "type": "string", "minLength": 1, "maxLength": 100, "example": "api-portal", "description": "Curriculum section id (slug)" },
      "topic_id": { "type": "string", "minLength": 1, "maxLength": 200, "example": "managing-consents", "description": "Topic id within the section (slug)" },
      "interested": { "type": "boolean", "example": true, "description": "The user wants training on this topic" },
      "covered": { "type": "boolean", "example": false, "description": "The topic has been covered in training" },
      "notes": { "type": "string", "minLength": 0, "maxLength": 2000, "example": "Covered in session 2.", "description": "Free-text notes" }
    }
  }
}`;
</script>

<svelte:head>
	<title>Training</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8" data-testid="training-page">
	<h1 class="h1 mb-2">Training</h1>
	<p class="mb-6 max-w-3xl opacity-80">
		The OBP training curriculum. Tick the topics you are interested in, mark topics as covered as
		you go, and keep notes per topic. Your progress is private to you — it is stored as a personal
		dynamic entity (<code>training_progress</code>), one of the features this training covers.
	</p>

	{#if loading}
		<p data-testid="training-loading">Loading your training progress…</p>
	{:else}
		{#if entityMissing}
			<div
				class="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20"
				data-testid="training-entity-missing"
			>
				<p class="font-semibold">Progress tracking is not set up on this instance yet.</p>
				<p class="mt-1">
					You can still read the curriculum below. To enable per-user progress, an admin with the
					<code>CanCreateSystemLevelDynamicEntity</code> role creates the
					<code>training_progress</code> system dynamic entity (with
					<code>hasPersonalEntity: true</code>).
				</p>
				{#if managerCreateUrl}
					<a
						href={managerCreateUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-2 inline-block font-medium underline"
						data-testid="training-create-entity-link"
					>
						Create it in the API Manager (form prefilled)
					</a>
				{/if}
				<details class="mt-2">
					<summary class="cursor-pointer font-medium">Entity definition JSON</summary>
					<pre class="mt-2 overflow-x-auto rounded bg-white p-3 text-xs dark:bg-black/30">{entityDefinition}</pre>
				</details>
			</div>
		{:else}
			<div class="mb-6 flex flex-wrap gap-3" data-testid="training-summary">
				<span class="rounded-full bg-primary-100 px-4 py-1 font-medium dark:bg-primary-900/30">
					{interestedCount} interested
				</span>
				<span class="rounded-full bg-green-100 px-4 py-1 font-medium dark:bg-green-900/30">
					{coveredCount} of {totalTopics} covered
				</span>
			</div>
		{/if}

		{#if errorMessage}
			<p class="mb-4 rounded bg-red-100 px-4 py-2 text-red-800 dark:bg-red-900/30 dark:text-red-300" data-testid="training-error">
				{errorMessage}
			</p>
		{/if}

		<nav class="mb-8 flex flex-wrap gap-2" aria-label="Curriculum sections">
			{#each trainingSections as section (section.id)}
				<a
					href={`#${section.id}`}
					class="rounded-full border border-surface-300 px-3 py-1 text-sm hover:border-primary-500 dark:border-surface-600"
				>
					{section.title}
					{#if !entityMissing}
						<span class="opacity-60">{sectionCovered(section.id)}/{section.topics.length}</span>
					{/if}
				</a>
			{/each}
		</nav>

		{#each trainingSections as section (section.id)}
			<section id={section.id} class="mb-10 scroll-mt-4" data-testid={`training-section-${section.id}`}>
				<h2 class="h3 mb-1">{section.title}</h2>
				{#if section.audience}
					<p class="mb-3 text-sm opacity-70">{section.audience}</p>
				{/if}
				<div class="overflow-x-auto rounded-lg border border-surface-300 dark:border-surface-600">
					<table class="w-full min-w-[720px] table-auto">
						<thead>
							<tr class="bg-surface-100 text-left text-sm uppercase tracking-wide dark:bg-surface-800">
								<th class="px-4 py-2">Topic</th>
								<th class="px-4 py-2">What it covers</th>
								<th class="px-2 py-2 text-center">Interested</th>
								<th class="px-2 py-2 text-center">Covered</th>
								<th class="px-4 py-2">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each section.topics as topic (topic.id)}
								{@const p = getProgress(section.id, topic.id)}
								{@const k = key(section.id, topic.id)}
								<tr
									class="border-t border-surface-200 align-top dark:border-surface-700 {p.covered ? 'bg-green-50/50 dark:bg-green-900/10' : ''}"
									data-testid={`training-topic-${section.id}--${topic.id}`}
									data-covered={p.covered}
									data-interested={p.interested}
								>
									<td class="px-4 py-2 font-medium">{topic.title}</td>
									<td class="px-4 py-2 text-sm opacity-90">{topic.summary}</td>
									<td class="px-2 py-2 text-center">
										<input
											type="checkbox"
											class="checkbox"
											name={`interested-${k}`}
											data-testid={`training-interested-${section.id}--${topic.id}`}
											checked={p.interested}
											disabled={entityMissing || savingKeys[k]}
											aria-label={`Interested in ${topic.title}`}
											onchange={(e) =>
												save(section.id, topic.id, { interested: (e.target as HTMLInputElement).checked })}
										/>
									</td>
									<td class="px-2 py-2 text-center">
										<input
											type="checkbox"
											class="checkbox"
											name={`covered-${k}`}
											data-testid={`training-covered-${section.id}--${topic.id}`}
											checked={p.covered}
											disabled={entityMissing || savingKeys[k]}
											aria-label={`${topic.title} covered`}
											onchange={(e) =>
												save(section.id, topic.id, { covered: (e.target as HTMLInputElement).checked })}
										/>
									</td>
									<td class="px-4 py-2">
										<input
											type="text"
											class="input w-full min-w-40 text-sm"
											name={`notes-${k}`}
											data-testid={`training-notes-${section.id}--${topic.id}`}
											value={p.notes}
											disabled={entityMissing}
											placeholder="Notes…"
											aria-label={`Notes for ${topic.title}`}
											onblur={(e) => onNotesBlur(section.id, topic.id, e)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	{/if}
</div>
