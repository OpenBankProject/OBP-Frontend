<script lang="ts">
  import { env } from "$env/dynamic/public";
</script>

<div class="mx-auto max-w-3xl px-6 py-10">
  <h1 class="h2 mb-6" data-testid="about-title">About</h1>

  <div class="space-y-4 text-sm text-surface-700-300">
    <p>
      The <strong>Open Bank Project API Manager</strong> helps you manage your OBP API instance,
      configure settings, manage roles and entitlements, and explore the full power of the
      Open Bank Project.
    </p>

    <p>
      For more information visit
      <a
        href="https://www.openbankproject.com"
        class="text-primary-500 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >openbankproject.com</a>.
    </p>

    <h2 class="h3 pt-4" data-testid="useful-links-title">Useful Links</h2>

    <ul class="list-disc space-y-1 pl-5">
      <li>
        <a href="/site-map" class="text-primary-500 hover:underline" data-testid="link-site-map">
          Site Map
        </a>
        — view all pages and the roles required to access them
      </li>
      <li>
        <a href="/status" class="text-primary-500 hover:underline" data-testid="link-status">
          System Status
        </a>
        — check the health of the API
      </li>
      <li>
        <a
          href="https://github.com/OpenBankProject"
          class="text-primary-500 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-github"
        >
          GitHub
        </a>
        — source code and issue tracking
      </li>
    </ul>
  </div>
</div>
