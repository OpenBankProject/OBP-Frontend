<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	interface FileRow {
		file_id: string;
		file_name: string;
		media_type: string;
		size_in_bytes: number;
		scan_status: string;
		scan_status_reason: string;
	}

	interface Props {
		locale: Locale;
		files: FileRow[];
		/** Staff with the scan Role get Approve and Reject on files that are not clean. */
		canSetScanStatus?: boolean;
	}

	let { locale, files, canSetScanStatus = false }: Props = $props();

	const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);
</script>

<!-- Names, types and sizes only: no previews or thumbnails, and a file opens only as a download. -->
<table class="table" data-testid="files">
	<thead>
		<tr>
			<th>{t(locale, 'files_name')}</th>
			<th>{t(locale, 'files_type')}</th>
			<th>{t(locale, 'files_size')}</th>
			<th>{t(locale, 'files_scan_status')}</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each files as file (file.file_id)}
			<tr data-testid="file-{file.file_id}">
				<td>{file.file_name}</td>
				<td>{file.media_type}</td>
				<td>{size(file.size_in_bytes)}</td>
				<td>
					{t(locale, `scan_${file.scan_status}` as MessageKey)}
					{#if file.scan_status_reason}<span class="text-sm"> ({file.scan_status_reason})</span>{/if}
				</td>
				<td class="flex flex-wrap gap-2">
					{#if file.scan_status !== 'rejected'}
						<a class="anchor text-sm" href="/files/{file.file_id}/download" download data-testid="file-download-{file.file_id}">{t(locale, 'files_download')}</a>
					{/if}
					{#if canSetScanStatus}
						{#if file.scan_status !== 'clean'}
							<form method="POST" action="?/approveFile"><input type="hidden" name="file_id" value={file.file_id} /><button class="btn btn-sm preset-tonal">{t(locale, 'files_approve')}</button></form>
						{/if}
						{#if file.scan_status !== 'rejected'}
							<form method="POST" action="?/rejectFile"><input type="hidden" name="file_id" value={file.file_id} /><button class="btn btn-sm preset-tonal-error">{t(locale, 'files_reject')}</button></form>
						{/if}
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
