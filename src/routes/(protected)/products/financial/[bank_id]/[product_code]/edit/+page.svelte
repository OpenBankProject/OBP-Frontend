<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  const ATTRIBUTE_TYPES = ["STRING", "INTEGER", "DOUBLE", "DATE_WITH_DAY"] as const;

  interface Attribute {
    product_attribute_id?: string;
    name: string;
    type: string;
    value: string;
  }

  const bankId = $page.params.bank_id!;
  const productCode = $page.params.product_code!;

  let name = $state("");
  let parentProductCode = $state("");
  let description = $state("");
  let moreInfoUrl = $state("");
  let termsAndConditionsUrl = $state("");
  let originalAttributes = $state<Attribute[]>([]);
  let attributes = $state<Attribute[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  let isSubmitting = $state(false);

  onMount(async () => {
    await loadProduct();
  });

  async function parseOrThrow(response: Response, what: string) {
    const bodyText = await response.text();
    let body: any = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      throw new Error(
        `Unexpected non-JSON response from OBP (HTTP ${response.status}): ${bodyText}`,
      );
    }
    if (!response.ok) {
      if (!body || typeof body.message !== "string") {
        throw new Error(
          `Unexpected error format from OBP (HTTP ${response.status}): ${bodyText}`,
        );
      }
      const code = body.code != null ? String(body.code) : "";
      throw new Error(code ? `${code}: ${body.message}` : body.message);
    }
    return body;
  }

  async function loadProduct() {
    isLoading = true;
    loadError = "";
    try {
      const response = await trackedFetch(
        `/proxy/obp/v4.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}`,
      );
      const product = await parseOrThrow(response, "load product");

      name = product.name ?? "";
      parentProductCode = product.parent_product_code ?? "";
      description = product.description ?? "";
      moreInfoUrl = product.more_info_url ?? "";
      termsAndConditionsUrl = product.terms_and_conditions_url ?? "";

      const loaded: Attribute[] = (product.attributes ?? []).map((a: any) => ({
        product_attribute_id: a.product_attribute_id,
        name: a.name ?? "",
        type: a.type || "STRING",
        value: a.value ?? "",
      }));
      originalAttributes = loaded.map((a) => ({ ...a }));
      attributes = loaded;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load product";
    } finally {
      isLoading = false;
    }
  }

  function addAttribute() {
    attributes = [...attributes, { name: "", type: "STRING", value: "" }];
  }

  function removeAttribute(index: number) {
    attributes = attributes.filter((_, i) => i !== index);
  }

  function hasAttributeChanged(attr: Attribute) {
    if (!attr.product_attribute_id) return true;
    const orig = originalAttributes.find(
      (o) => o.product_attribute_id === attr.product_attribute_id,
    );
    if (!orig) return true;
    return (
      orig.name !== attr.name || orig.type !== attr.type || orig.value !== attr.value
    );
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Validation Error", "Name is required");
      return;
    }

    isSubmitting = true;
    try {
      const response = await trackedFetch(
        `/proxy/obp/v5.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            parent_product_code: parentProductCode.trim(),
            description: description.trim(),
            more_info_url: moreInfoUrl.trim(),
            terms_and_conditions_url: termsAndConditionsUrl.trim(),
          }),
        },
      );
      await parseOrThrow(response, "update product");

      const failedAttributes: Array<{ name: string; error: string }> = [];
      for (const attr of attributes) {
        if (!attr.name.trim()) continue;
        if (!hasAttributeChanged(attr)) continue;

        try {
          let attrResponse: Response;
          if (attr.product_attribute_id) {
            attrResponse = await trackedFetch(
              `/proxy/obp/v4.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}/attributes/${attr.product_attribute_id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: attr.name,
                  type: attr.type,
                  value: attr.value,
                  is_active: true,
                }),
              },
            );
          } else {
            attrResponse = await trackedFetch(
              `/proxy/obp/v4.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}/attribute`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: attr.name,
                  type: attr.type,
                  value: attr.value,
                  is_active: true,
                }),
              },
            );
          }
          await parseOrThrow(attrResponse, "save attribute");
        } catch (err) {
          failedAttributes.push({
            name: attr.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (failedAttributes.length > 0) {
        const details = failedAttributes
          .map((f) => `${f.name}: ${f.error}`)
          .join("; ");
        toast.warning(
          "Product Updated with Warnings",
          `Product updated but these attributes failed — ${details}`,
        );
      } else {
        toast.success("Product Updated", `Successfully updated "${productCode}"`);
      }

      setTimeout(() => {
        goto(`/products/financial/${bankId}/${encodeURIComponent(productCode)}`);
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update product";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Edit {productCode} - Financial Product - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/products/financial"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Financial Products
      </a>
      <span class="text-gray-400">/</span>
      <a
        href="/products/financial/{bankId}/{productCode}"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {productCode}
      </a>
      <span class="text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-400">Edit</span>
    </div>
  </div>

  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Edit Financial Product
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Bank <code class="rounded bg-gray-100 px-1 dark:bg-gray-700">{bankId}</code>,
      Product <code class="rounded bg-gray-100 px-1 dark:bg-gray-700">{productCode}</code>
    </p>
  </div>

  {#if loadError}
    <div
      class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      data-testid="load-error"
    >
      <h3 class="font-semibold text-red-800 dark:text-red-300">Error Loading Product</h3>
      <p class="mt-1 text-sm text-red-700 dark:text-red-400">{loadError}</p>
    </div>
  {:else if isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <svg class="mb-4 h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400">Loading product...</p>
    </div>
  {:else}
    <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <form onsubmit={handleSubmit} class="p-6" data-testid="financial-product-edit-form">
        <div class="space-y-6">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name <span class="text-red-600">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              bind:value={name}
              disabled={isSubmitting}
              required
              data-testid="input-name"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label for="parent-product-code" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Parent Product Code
            </label>
            <input
              id="parent-product-code"
              name="parent_product_code"
              type="text"
              bind:value={parentProductCode}
              disabled={isSubmitting}
              data-testid="input-parent-product-code"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              bind:value={description}
              rows="3"
              disabled={isSubmitting}
              data-testid="input-description"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
            ></textarea>
          </div>

          <div>
            <label for="more-info-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              More Info URL
            </label>
            <input
              id="more-info-url"
              name="more_info_url"
              type="url"
              bind:value={moreInfoUrl}
              disabled={isSubmitting}
              data-testid="input-more-info-url"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label for="terms-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Terms and Conditions URL
            </label>
            <input
              id="terms-url"
              name="terms_and_conditions_url"
              type="url"
              bind:value={termsAndConditionsUrl}
              disabled={isSubmitting}
              data-testid="input-terms-url"
              class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Attributes
              </label>
              <button
                type="button"
                onclick={addAttribute}
                disabled={isSubmitting}
                data-testid="add-attribute"
                class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
              >
                <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Attribute
              </button>
            </div>

            {#if attributes.length > 0}
              <div class="mt-2 space-y-3">
                {#each attributes as attr, index (attr.product_attribute_id ?? `new-${index}`)}
                  <div class="flex items-start gap-3" data-testid={`attribute-row-${index}`}>
                    <div class="flex-1">
                      <input
                        type="text"
                        bind:value={attr.name}
                        placeholder="Name"
                        disabled={isSubmitting}
                        data-testid={`attribute-name-${index}`}
                        class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
                      />
                    </div>
                    <div class="w-40">
                      <select
                        bind:value={attr.type}
                        disabled={isSubmitting}
                        data-testid={`attribute-type-${index}`}
                        class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
                      >
                        {#each ATTRIBUTE_TYPES as type}
                          <option value={type}>{type}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="flex-1">
                      <input
                        type="text"
                        bind:value={attr.value}
                        placeholder="Value"
                        disabled={isSubmitting}
                        data-testid={`attribute-value-${index}`}
                        class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="button"
                      onclick={() => removeAttribute(index)}
                      disabled={isSubmitting}
                      data-testid={`remove-attribute-${index}`}
                      class="mt-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                No attributes. Click "Add Attribute" to add one.
              </p>
            {/if}
          </div>
        </div>

        <div class="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
          <a
            href="/products/financial/{bankId}/{productCode}"
            data-testid="cancel"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="submit"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>
