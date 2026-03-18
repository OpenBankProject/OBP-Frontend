<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<div
	class="card dark:bg-primary-500/50 backdrop-blur-3xl border-primary-200-800 divide-primary-200-800 mx-auto my-10 md:px-15 flex flex-col divide-y shadow-lg w-[90%] lg:max-w-3xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Register a consumer</h1>
	</header>
	<article class="space-y-4 p-4">
		{#if form?.error}
			<div class="bg-error-500/10 border-error-500 rounded-lg border p-4 text-center">
				<p class="text-error-500 font-semibold">{form.error}</p>
			</div>
		{/if}
		<form class="w-full space-y-6 pb-10" method="POST">
			<label class="label">
				<span class="label-text">Application Type</span>
				<select class="select" name="app_type" required>
					<option value="public">Public</option>
					<option value="confidential">Confidential</option>
				</select>
			</label>

			<!-- --- -->
			<label class="label">
				<span class="label-text">Application Name</span>
				<input type="text" class="input" name="app_name" placeholder="Enter Application Name" required/>
			</label>
			<!-- --- -->
			<label class="label">
				<span class="label-text">Redirect Url</span>
				<input type="url" class="input" name="redirect_url" placeholder="i.e. http://localhost:8080/callback" />
			</label>
			<!-- this should be automatically filled out if the user is registered -->
			<label class="label">
				<span class="label-text">Developer Email</span>
				<input type="email" class="input" name="developer_email" placeholder="john@example.com" required/>
			</label>
			<!-- --- -->
			<label class="label">
				<span class="label-text">Description</span>
				<textarea class="input" name="description" placeholder="Enter a short description of the application..." required></textarea>
			</label>

            <label class="label">
				<span class="label-text text-left">Company</span>
				<input type="text" class="input" name="company" placeholder="Enter Company Name" required/>
			</label>

            <button type="submit" aria-label="submit" class="btn preset-filled-primary-500 w-full mt-5">Submit</button>
		</form>
	</article>
</div>
