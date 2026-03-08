<script lang="ts">
  import "../app.css";
  import { Navigation } from "@skeletonlabs/skeleton-svelte";
  import { page } from "$app/state";
  import { navSections as allNavSections, type NavigationSection } from "$lib/config/navigation";
  import { SITE_MAP, type UserEntitlement } from "$lib/utils/roleChecker";

  // Separate My Account and Banks from other sections so they render in specific positions
  const myAccountSection = allNavSections.find(s => s.id === "my-account");
  const banksSection = allNavSections.find(s => s.id === "banks");
  const navSections = allNavSections.filter(s => s.id !== "my-account" && s.id !== "banks");
  import Toast from "$lib/components/Toast.svelte";
  import ApiActivityIndicator from "$lib/components/ApiActivityIndicator.svelte";
  import { createLogger } from "$lib/utils/logger";
  import { resourceDocsCache } from "$lib/stores/resourceDocsCache";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { userPreferences } from "$lib/stores/userPreferences.svelte";
  import { onMount, tick } from "svelte";

  const logger = createLogger("LayoutClient");
  const layoutStartTime = performance.now();
  logger.info("🎨 Layout client initialization started");

  // Lucide Icons
  import {
    Compass,
    KeyRound,
    SquareTerminal,
    Users,
    ChevronDown,
    ChevronRight,
    CreditCard,
    Globe,
  } from "@lucide/svelte";

  import { env } from "$env/dynamic/public";
  import LightSwitch from "$lib/components/LightSwitch.svelte";
  import CurrentBankSelector from "$lib/components/CurrentBankSelector.svelte";
  import type { RootLayoutData } from "./+layout.server";

  logger.info("📦 All imports loaded");
  const importsLoadedTime = performance.now();
  logger.info(
    `⏱️  Imports loaded in ${(importsLoadedTime - layoutStartTime).toFixed(2)}ms`,
  );

  let { data, children } = $props();
  logger.info("📊 Props received from server");
  let isAuthenticated = $state(false);
  let isMobileMenuOpen = $state(false);
  let expandedSections = $state<Record<string, boolean>>({});
  let displayMode: "dark" | "light" = $state(userPreferences.theme);
  let userMenuOpen = $state(false);
  let bankSelectorOpen = $state(false);
  let bankSelectEl: HTMLSelectElement | undefined = $state();

  async function openBankSelector() {
    bankSelectorOpen = true;
    await tick();
    try { bankSelectEl?.showPicker(); } catch {}
  }
  let systemDynamicEntities = $state<any[]>([]);

  async function clearCache() {
    try {
      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error("Error clearing cache:", error);
      alert("Cache cleared. Page will reload.");
      window.location.reload();
    }
  }

  logger.info("🔐 Checking authentication state");

  // Make authentication reactive to data changes
  $effect(() => {
    if (data.email) {
      isAuthenticated = true;
      logger.info(`✅ User authenticated: ${data.email}`);
    } else {
      isAuthenticated = false;
      logger.info("ℹ️  User not authenticated");
    }
  });

  // Pre-warm resource docs cache, fetch banks, and load preferences for authenticated users
  onMount(() => {
    if (isAuthenticated) {
      logger.info("🔄 Pre-warming browser resource docs cache...");
      resourceDocsCache.preWarmCache(undefined as any);
      currentBank.fetchBanks();
      userPreferences.loadFromOBP();
    }
  });

  // Fetch system dynamic entities for shortcuts
  async function fetchSystemDynamicEntities() {
    if (!isAuthenticated) return;

    try {
      const response = await fetch("/api/dynamic-entities/system/list", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        systemDynamicEntities = data.entities || [];
        logger.info(
          `✅ Loaded ${systemDynamicEntities.length} system dynamic entities`,
        );
      }
    } catch (error) {
      logger.error("Failed to fetch system dynamic entities:", error);
    }
  }

  onMount(() => {
    fetchSystemDynamicEntities();
  });

  // Refresh dynamic entities when navigating within dynamic entities section
  $effect(() => {
    if (page.url.pathname.startsWith("/dynamic-entities/system")) {
      fetchSystemDynamicEntities();
    }
  });

  function isSectionActive(section: NavigationSection): boolean {
    return section.basePaths.some(
      (bp) =>
        page.url.pathname === bp || page.url.pathname.startsWith(bp + "/"),
    );
  }

  function toggleSection(id: string) {
    expandedSections[id] = !expandedSections[id];
  }

  function userHasRole(roleName: string): boolean {
    const entitlements: UserEntitlement[] = data.userEntitlements || [];
    return entitlements.some((e) => e.role_name === roleName);
  }

  function getMenuTooltip(href: string, label: string): string {
    if (href.startsWith("http")) return label;
    const path = href.split("?")[0];
    const config = SITE_MAP[path];
    if (!config) return `${label}\nNo Roles required`;
    const roles = config.required;
    if (roles.length === 0) return `${label}\nRequired roles: (none)`;
    const lines = roles.map((r) => {
      const has = userHasRole(r.role);
      return `${has ? "\u2713" : "\u2717"} ${r.role}`;
    });
    if (roles.length === 1) {
      return `${label}\nRequired role:\n${lines[0]}`;
    }
    const logic = config.requirementType === "AND" ? "AND" : "OR";
    const separator = logic === "AND" ? "\n" : `\n  ${logic} `;
    return `${label}\nRequired roles (${logic}):\n${lines.join(separator)}`;
  }

  logger.info("🧭 Navigation state initialized");
  const navStateTime = performance.now();
  logger.info(
    `⏱️  Navigation state in ${(navStateTime - importsLoadedTime).toFixed(2)}ms`,
  );

  // Auto-expand active sections on route change
  $effect(() => {
    logger.info("🔄 Route effect triggered");
    for (const section of navSections) {
      if (isSectionActive(section)) {
        expandedSections[section.id] = true;
      }
    }
    logger.info(`📍 Current route: ${page.url.pathname}`);
  });

  // Log when layout is fully initialized
  $effect(() => {
    const layoutEndTime = performance.now();
    const totalTime = layoutEndTime - layoutStartTime;
    logger.info(
      `✅ Layout client fully initialized in ${totalTime.toFixed(2)}ms`,
    );
  });

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  // Some items in the menu are rendered conditionally based on the presence of URLs set in the environment variables.
  // This is to ensure no broken links

  // Top menu items rendered before My Account
  let topMenuItems = $state([
    ...(data.externalLinks.API_EXPLORER_URL
      ? [
          {
            href: data.externalLinks.API_EXPLORER_URL,
            label: "API Explorer",
            iconComponent: Compass,
            external: true,
          },
        ]
      : []), // unpacks a conditional list so we can add menu items where we want
    ...(data.externalLinks.PORTAL_URL
      ? [
          {
            href: data.externalLinks.PORTAL_URL,
            label: "Portal",
            iconComponent: Globe,
            external: true,
          },
        ]
      : []),
  ]);

  // Menu items rendered after My Account
  let menuItems = $state([
    {
      label: "Users",
      href: "/users",
      iconComponent: Users,
    },
    {
      label: "Consumers",
      href: "/consumers",
      iconComponent: KeyRound,
    },

    ...(data.externalLinks.SUBSCRIPTIONS_URL
      ? [
          {
            href: data.externalLinks.SUBSCRIPTIONS_URL,
            label: "Subscriptions",
            iconComponent: CreditCard,
            external: true,
          },
        ]
      : []),
    // ...(data.SUBSCRIPTIONS_URL
    // 	? [{ href: data.SUBSCRIPTIONS_URL, label: 'Subscriptions', iconComponent: Star }]
    // 	: []),
    //{ label: 'Onboarding', href: '/intro', iconComponent: UserPlus },
    //{ label: 'Consent Simulator', href: '/hola', iconComponent: ShieldUser },
    //{ label: 'FAQs', href: '/faq', iconComponent: MessageCircleQuestion },
    ...(data.externalLinks.API_MANAGER_URL
      ? [
          {
            href: data.externalLinks.API_MANAGER_URL,
            label: "API Manager",
            iconComponent: SquareTerminal,
            external: true,
          },
        ]
      : []),
  ]);

  let footerLinks = $state([
    //{ href: '/privacy', label: 'Privacy Policy' },
    {
      href: "https://github.com/OpenBankProject",
      label: "GitHub",
    },
    { href: "/about", label: "About" },
  ]); //{ href: '/terms', label: 'Terms of Service' },

  // Default logo URL, can be overridden by PUBLIC_LOGO_URL in .env
  const defaultLogoUrl = "/logo2x-1.png";
  const defaultDarkLogoUrl = "/obp_logo.png";
  let lightLogoUrl = $state(env.PUBLIC_LOGO_URL || defaultLogoUrl);

  if (!env.PUBLIC_DARK_LOGO_URL) {
    // If no dark logo URL is provided, use the same as light logo
    env.PUBLIC_DARK_LOGO_URL = env.PUBLIC_LOGO_URL || defaultLogoUrl;
  }

  let darkLogoUrl = $state(env.PUBLIC_DARK_LOGO_URL || defaultDarkLogoUrl);

  // Logo width, can be overridden by PUBLIC_LOGO_WIDTH in .env (e.g. "150px", "10rem", "100%")
  const logoWidth = env.PUBLIC_LOGO_WIDTH || "100%";

  let logoUrl = $derived.by(() => {
    return displayMode === "dark" ? darkLogoUrl : lightLogoUrl;
  });
</script>

<div
  class="grid min-h-screen w-full grid-cols-[auto_1fr] divide-x divide-solid divide-surface-100-900"
>
  <div class="sticky top-0 h-screen">
    <Navigation
      layout="sidebar"
      class="grid h-full grid-rows-[auto_1fr_auto] gap-4 preset-filled-primary-50-950"
    >
      <Navigation.Header class="p-4">
        <a href="/" class="flex w-full items-center">
          <img class="block" style="width: {logoWidth};" src={logoUrl} alt="Logo" />
        </a>
      </Navigation.Header>

      <Navigation.Content class="">
        <!-- Top Menu: API Explorer, Portal -->
        <Navigation.Group>
          <Navigation.Menu class="flex flex-col gap-2">
            {#each topMenuItems as item}
              {@const Icon = item.iconComponent}
              <a
                href={item.href}
                class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
                class:preset-filled-primary-50-950={page.url.pathname ===
                  item.href}
                class:border={page.url.pathname === item.href}
                class:border-solid-secondary-500={page.url.pathname ===
                  item.href}
                title={getMenuTooltip(item.href, item.label)}
                aria-label={item.label}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                <Icon class="size-5" />
                <span>{item.label}</span>
              </a>
            {/each}
          </Navigation.Menu>
        </Navigation.Group>

        <!-- My Account: right after Portal -->
        {#if isAuthenticated && myAccountSection}
          {@const SectionIcon = myAccountSection.iconComponent}
          {@const active = isSectionActive(myAccountSection)}
          <Navigation.Group>
            <button
              type="button"
              class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
              class:preset-filled-primary-50-950={active}
              class:border={active}
              class:border-solid-secondary-500={active}
              onclick={() => toggleSection(myAccountSection.id)}
            >
              <SectionIcon class="size-5" />
              <span>{myAccountSection.label}</span>
              {#if expandedSections[myAccountSection.id]}
                <ChevronDown class="h-4 w-4" />
              {:else}
                <ChevronRight class="h-4 w-4" />
              {/if}
            </button>

            {#if expandedSections[myAccountSection.id]}
              <Navigation.Menu class="mt-1 ml-4 flex flex-col gap-1 px-2">
                {#each myAccountSection.items as subItem}
                  {@const SubIcon = subItem.iconComponent}
                  <a
                    href={subItem.href}
                    class="btn w-full justify-start gap-3 px-2 pl-6 text-sm hover:preset-tonal"
                    class:preset-filled-secondary-50-950={page.url.pathname ===
                      subItem.href}
                    class:border-l-2={page.url.pathname === subItem.href}
                    class:border-primary-500={page.url.pathname ===
                      subItem.href}
                    title={getMenuTooltip(subItem.href, subItem.label)}
                    aria-label={subItem.label}
                    target={subItem.external ? "_blank" : undefined}
                    rel={subItem.external ? "noopener noreferrer" : undefined}
                  >
                    <SubIcon class="size-4" />
                    <span>{subItem.label}</span>
                  </a>
                {/each}
              </Navigation.Menu>
            {/if}
          </Navigation.Group>
        {/if}

        <!-- Banks section: rendered above Users/Consumers -->
        {#if isAuthenticated && banksSection}
          <Navigation.Group>
            {@const SectionIcon = banksSection.iconComponent}
            {@const active = isSectionActive(banksSection)}
            <button
              type="button"
              class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
              class:preset-filled-primary-50-950={active}
              class:border={active}
              class:border-solid-secondary-500={active}
              onclick={() => toggleSection(banksSection.id)}
            >
              <SectionIcon class="size-5" />
              <span>{banksSection.label}</span>
              {#if expandedSections[banksSection.id]}
                <ChevronDown class="h-4 w-4" />
              {:else}
                <ChevronRight class="h-4 w-4" />
              {/if}
            </button>

            {#if expandedSections[banksSection.id]}
              <Navigation.Menu class="flex flex-col gap-2 px-2 pl-6">
                {#each banksSection.items as item}
                  {@const ItemIcon = item.iconComponent}
                  <a
                    href={item.href}
                    class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
                    class:preset-filled-primary-50-950={page.url.pathname === item.href}
                    class:border={page.url.pathname === item.href}
                    class:border-solid-secondary-500={page.url.pathname === item.href}
                    title={getMenuTooltip(item.href, item.label)}
                    aria-label={item.label}
                  >
                    <ItemIcon class="size-5" />
                    <span>{item.label}</span>
                  </a>
                {/each}
              </Navigation.Menu>
            {/if}
          </Navigation.Group>
        {/if}

        <!-- Other top-level items: Users, Consumers, etc. -->
        <Navigation.Group>
          <Navigation.Menu class="flex flex-col gap-2">
            {#each menuItems as item}
              {@const Icon = item.iconComponent}
              <a
                href={item.href}
                class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
                class:preset-filled-primary-50-950={page.url.pathname ===
                  item.href}
                class:border={page.url.pathname === item.href}
                class:border-solid-secondary-500={page.url.pathname ===
                  item.href}
                title={getMenuTooltip(item.href, item.label)}
                aria-label={item.label}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                <Icon class="size-5" />
                <span>{item.label}</span>
              </a>
            {/each}
          </Navigation.Menu>
        </Navigation.Group>

        {#if isAuthenticated}
          {#each navSections as section}
            <Navigation.Group>
              {@const SectionIcon = section.iconComponent}
              {@const active = isSectionActive(section)}
              <button
                type="button"
                class="btn w-full justify-start gap-3 px-2 hover:preset-tonal"
                class:preset-filled-primary-50-950={active}
                class:border={active}
                class:border-solid-secondary-500={active}
                onclick={() => toggleSection(section.id)}
              >
                <SectionIcon class="size-5" />
                <span>{section.label}</span>
                {#if expandedSections[section.id]}
                  <ChevronDown class="h-4 w-4" />
                {:else}
                  <ChevronRight class="h-4 w-4" />
                {/if}
              </button>

              {#if expandedSections[section.id]}
                <Navigation.Menu class="mt-1 ml-4 flex flex-col gap-1 px-2">
                  {#each section.items as subItem}
                    {@const SubIcon = subItem.iconComponent}
                    {@const currentUrl = page.url.pathname + page.url.search}
                    <a
                      href={subItem.href}
                      class="btn w-full justify-start gap-3 px-2 pl-6 text-sm hover:preset-tonal"
                      class:preset-filled-secondary-50-950={currentUrl ===
                        subItem.href}
                      class:border-l-2={currentUrl === subItem.href}
                      class:border-primary-500={currentUrl ===
                        subItem.href}
                      title={getMenuTooltip(subItem.href, subItem.label)}
                      aria-label={subItem.label}
                      target={subItem.external ? "_blank" : undefined}
                      rel={subItem.external ? "noopener noreferrer" : undefined}
                    >
                      <SubIcon class="size-4" />
                      <span>{subItem.label}</span>
                    </a>
                  {/each}
                </Navigation.Menu>
              {/if}
            </Navigation.Group>
          {/each}
        {/if}
      </Navigation.Content>

      <Navigation.Footer class="p-4">
        <div
          class="flex flex-wrap items-center gap-3 text-xs text-surface-800-200"
        >
          <LightSwitch bind:mode={displayMode} />
          {#each footerLinks as link, index}
            <a
              href={link.href}
              class="flex items-center gap-2 hover:text-tertiary-400"
            >
              {#if link.label === "GitHub"}
                <img
                  class="h-4"
                  alt="github logo"
                  src={displayMode === "dark"
                    ? "/github-mark-white.svg"
                    : "/github-mark.svg"}
                />
              {/if}
              {link.label}
            </a>
          {/each}
          <button
            onclick={clearCache}
            class="flex items-center gap-1 hover:text-tertiary-400 cursor-pointer"
            title="Clear browser cache and reload"
          >
            ⚡
          </button>
          <span> © TESOBE 2011-2025 </span>
          {#if data.externalLinks.LEGACY_PORTAL_URL}
            <!-- Legacy Portal Link -->
            <a
              href={data.externalLinks.LEGACY_PORTAL_URL}
              class="w-full justify-start text-xs text-tertiary-700-300 hover:underline"
              aria-label="Switch to Legacy Portal"
            >
              <span>Switch to Legacy Portal</span>
            </a>
          {/if}
        </div>
      </Navigation.Footer>
    </Navigation>
  </div>
  <div
    class="h-full bg-conic-250 from-30% via-40% to-50% dark:from-primary-950 dark:via-tertiary-500/70 dark:to-primary-950"
  >
    <div
      class="flex flex-col backdrop-blur-2xl"
      style="height: calc(100vh - 80px);"
    >
      <div
        class="bg-opacity-0 flex items-center justify-between p-4"
        style="height: 80px; flex-shrink: 0;"
      >
        <div>
          {#if isAuthenticated}
            {#if bankSelectorOpen}
              <div class="flex items-center gap-2">
                <select
                  bind:this={bankSelectEl}
                  class="rounded-md border border-surface-300-700 bg-surface-100-900 px-2 py-1 text-sm"
                  value={currentBank.bankId}
                  onchange={(e) => {
                    currentBank.selectById(e.currentTarget.value);
                    bankSelectorOpen = false;
                  }}
                >
                  <option value="">-- Select a bank --</option>
                  {#each currentBank.banks as bank}
                    <option value={bank.bank_id}>
                      {bank.bank_id} — {bank.bank_code} — {bank.full_name}
                    </option>
                  {/each}
                </select>
                <button
                  type="button"
                  class="text-sm opacity-60 hover:opacity-100"
                  onclick={() => bankSelectorOpen = false}
                  title="Close"
                >&times;</button>
              </div>
            {:else if currentBank.bank}
              <span class="text-sm" class:bank-changed={currentBank.justChanged}>{currentBank.bank.full_name}: {currentBank.bank.bank_id} ({currentBank.bank.bank_code}) <button type="button" class="hover:text-tertiary-400" onclick={openBankSelector} title="Change current bank">&#9998;</button></span>
            {:else}
              <button type="button" class="text-sm opacity-70 hover:text-tertiary-400 hover:opacity-100" onclick={openBankSelector}>Select Bank &#9998;</button>
            {/if}
          {/if}
        </div>
        {#if isAuthenticated}
          <div class="relative mx-4">
            <button
              type="button"
              class="flex items-center gap-1 hover:text-tertiary-400"
              onclick={() => (userMenuOpen = !userMenuOpen)}
              onblur={() => setTimeout(() => (userMenuOpen = false), 150)}
            >
              {data.username}
              <ChevronDown class="size-4" />
            </button>
            {#if userMenuOpen}
              <div class="absolute right-0 z-50 mt-2 min-w-[140px] rounded-md border border-surface-300-700 bg-surface-100-900 py-1 shadow-lg">
                <a
                  href="/user"
                  class="block px-4 py-2 text-sm hover:preset-tonal"
                >
                  My Account
                </a>
                <a
                  href="/logout"
                  class="block px-4 py-2 text-sm hover:preset-tonal"
                >
                  Logout
                </a>
              </div>
            {/if}
          </div>
        {:else}
          <div class="flex items-center">
            <span class="mx-4 hover:text-tertiary-400"
              ><a href="{data.externalLinks.PORTAL_URL}/register">Register</a>
            </span>
            <button type="button" class="btn preset-filled-surface-950-50"
              ><a href="/login">Login</a></button
            >
          </div>
        {/if}
      </div>

      <main
        class="flex flex-col overflow-auto"
        style="height: calc(100vh - 80px);"
      >
        {@render children()}
      </main>
    </div>
  </div>
</div>

<!-- Global Toast Component -->
<Toast />

<!-- Global API Activity Indicator -->
<ApiActivityIndicator />

<style>
  @keyframes bank-highlight {
    0%   { color: #22c55e; }  /* green */
    25%  { color: #3b82f6; }  /* blue */
    50%  { color: #a855f7; }  /* purple */
    75%  { color: #f59e0b; }  /* amber */
    100% { color: inherit; }
  }

  :global(.bank-changed) {
    animation: bank-highlight 1.5s ease-in-out;
    font-weight: 700;
  }
</style>
