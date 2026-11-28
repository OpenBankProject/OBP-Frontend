<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import type { PageData } from "./$types";
  import { Mail, Building2, Users, CheckCircle, Clock } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  // Form state
  let selectedBankId = $state(currentBank.bankId);
  let firstName = $state("");

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });
  let lastName = $state("");
  let email = $state("");
  let company = $state("");
  let country = $state("");
  let purpose = $state<"DEVELOPER" | "CUSTOMER" | "">("");

  let isSubmitting = $state(false);
  let submitError = $state("");
  let submitSuccess = $state("");

  // Invitations list state
  let invitations = $state<any[]>([]);
  let isLoadingInvitations = $state(false);
  let invitationsError = $state("");

  // Watch for bank selection changes to load invitations
  $effect(() => {
    if (selectedBankId) {
      loadInvitations();
    } else {
      invitations = [];
    }
  });

  async function loadInvitations() {
    if (!selectedBankId) return;

    isLoadingInvitations = true;
    invitationsError = "";

    try {
      const response = await trackedFetch(
        `/proxy/obp/v5.1.0/banks/${encodeURIComponent(selectedBankId)}/user-invitations`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      invitations = result.user_invitations || [];
    } catch (err) {
      console.error("Error loading invitations:", err);
      invitationsError =
        err instanceof Error ? err.message : "Failed to load invitations";
      invitations = [];
    } finally {
      isLoadingInvitations = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    submitError = "";
    submitSuccess = "";

    // Validate form
    if (
      !selectedBankId ||
      !firstName ||
      !lastName ||
      !email ||
      !company ||
      !country ||
      !purpose
    ) {
      submitError = "All fields are required";
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      submitError = "Please enter a valid email address";
      return;
    }

    isSubmitting = true;

    try {
      const response = await trackedFetch("/backend/user-invitations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bank_id: selectedBankId,
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          country,
          purpose,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();

      // Show success message
      submitSuccess = `User Invitation for ${firstName} ${lastName} at Bank(${selectedBankId}) has been CREATED!`;

      // Reset form
      firstName = "";
      lastName = "";
      email = "";
      company = "";
      country = "";
      purpose = "";

      // Reload invitations list
      await loadInvitations();

      // Clear success message after 5 seconds
      setTimeout(() => {
        submitSuccess = "";
      }, 5000);
    } catch (err) {
      console.error("Error creating invitation:", err);
      submitError =
        err instanceof Error ? err.message : "Failed to create invitation";
    } finally {
      isSubmitting = false;
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      return "N/A";
    }
  }

  function isExpired(invitation: any): boolean {
    if (!invitation.created || invitation.status !== "CREATED") return false;

    try {
      const created = new Date(invitation.created);
      const now = new Date();
      const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hoursDiff > 24; // 24 hours expiration
    } catch {
      return false;
    }
  }
</script>

<svelte:head>
  <title>User Invitations - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold ui-text">
      User Invitations
    </h1>
    <p class="mt-1 ui-muted">
      Create and manage user invitations for your banks
    </p>
  </div>

  <!-- Create Invitation Panel -->
  <div class="panel mb-6">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <Mail size={20} />
        <h2 class="panel-title">Create New Invitation</h2>
      </div>
      <div class="panel-subtitle">Send an invitation email to a new user</div>
    </div>
    <div class="panel-content">
      <!-- Success Alert -->
      {#if submitSuccess}
        <div class="alert alert-success mb-4">
          <CheckCircle size={20} />
          <span>{submitSuccess}</span>
        </div>
      {/if}

      <!-- Error Alert -->
      {#if submitError}
        <div class="alert alert-error mb-4">
          <strong>Error:</strong>
          {submitError}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="form">
        <div class="form-grid">
          <!-- First Name -->
          <div class="form-group">
            <label for="first-name" class="form-label">
              First Name
              <span class="required">*</span>
            </label>
            <input
              type="text"
              id="first-name"
              bind:value={firstName}
              disabled={isSubmitting}
              placeholder="John"
              class="form-input"
              required
            />
          </div>

          <!-- Last Name -->
          <div class="form-group">
            <label for="last-name" class="form-label">
              Last Name
              <span class="required">*</span>
            </label>
            <input
              type="text"
              id="last-name"
              bind:value={lastName}
              disabled={isSubmitting}
              placeholder="Doe"
              class="form-input"
              required
            />
          </div>

          <!-- Email -->
          <div class="form-group full-width">
            <label for="email" class="form-label">
              <Mail size={16} />
              Email
              <span class="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              bind:value={email}
              disabled={isSubmitting}
              placeholder="john.doe@example.com"
              class="form-input"
              required
            />
          </div>

          <!-- Company -->
          <div class="form-group">
            <label for="company" class="form-label">
              Company
              <span class="required">*</span>
            </label>
            <input
              type="text"
              id="company"
              bind:value={company}
              disabled={isSubmitting}
              placeholder="TESOBE"
              class="form-input"
              required
            />
          </div>

          <!-- Country -->
          <div class="form-group">
            <label for="country" class="form-label">
              Country
              <span class="required">*</span>
            </label>
            <input
              type="text"
              id="country"
              bind:value={country}
              disabled={isSubmitting}
              placeholder="Germany"
              class="form-input"
              required
            />
          </div>

          <!-- Purpose -->
          <div class="form-group full-width">
            <label for="purpose" class="form-label">
              <Users size={16} />
              Purpose
              <span class="required">*</span>
            </label>
            <select
              id="purpose"
              bind:value={purpose}
              disabled={isSubmitting}
              class="form-input"
              required
            >
              <option value="">Select purpose...</option>
              <option value="DEVELOPER">Developer</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isSubmitting || !selectedBankId}
          >
            {isSubmitting ? "Creating Invitation..." : "Create Invitation"}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Invitations List Panel -->
  {#if selectedBankId}
    <div class="panel">
      <div class="panel-header">
        <div class="flex items-center gap-2">
          <Users size={20} />
          <h2 class="panel-title">Invitations for Bank: {selectedBankId}</h2>
        </div>
        <div class="panel-subtitle">
          {invitations.length} invitation{invitations.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div class="panel-content">
        {#if invitationsError}
          <div class="alert alert-error">
            <strong>Error:</strong>
            {invitationsError}
          </div>
        {:else if isLoadingInvitations}
          <div class="empty-state">
            <Clock size={48} class="animate-spin" />
            <p>Loading invitations...</p>
          </div>
        {:else if invitations.length === 0}
          <div class="empty-state">
            <Mail size={48} />
            <p>No invitations found for this bank</p>
            <p class="text-sm">
              Create your first invitation using the form above
            </p>
          </div>
        {:else}
          <div class="table-wrapper">
            <table class="invitations-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Purpose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each invitations as invitation}
                  <tr class:expired={isExpired(invitation)}>
                    <td class="font-medium">
                      {invitation.first_name}
                      {invitation.last_name}
                    </td>
                    <td>{invitation.email}</td>
                    <td>{invitation.company}</td>
                    <td>{invitation.country}</td>
                    <td>
                      <span
                        class="purpose-badge purpose-{invitation.purpose?.toLowerCase()}"
                      >
                        {invitation.purpose || "N/A"}
                      </span>
                    </td>
                    <td>
                      {#if invitation.status === "CREATED"}
                        {#if isExpired(invitation)}
                          <span class="status-badge status-expired">
                            <Clock size={14} />
                            Expired
                          </span>
                        {:else}
                          <span class="status-badge status-created">
                            <Clock size={14} />
                            Pending
                          </span>
                        {/if}
                      {:else if invitation.status === "FINISHED"}
                        <span class="status-badge status-finished">
                          <CheckCircle size={14} />
                          Completed
                        </span>
                      {:else}
                        <span class="status-badge status-unknown">
                          {invitation.status || "Unknown"}
                        </span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="panel">
      <div class="panel-content">
        <div class="empty-state">
          <Building2 size={48} />
          <p>No bank selected. Please select a bank in <a class="ui-link" href="/user" style="text-decoration: underline;">My Account</a> to view invitations.</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-text);
  }

  .required {
    color: var(--ui-error);
  }

  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--ui-card);
    color: var(--ui-text);
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .form-input:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .alert {
    padding: 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .alert-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: 1px solid var(--ui-tone-success-border);
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .invitations-table {
    width: 100%;
    border-collapse: collapse;
  }

  .invitations-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ui-text);
    border-bottom: 2px solid var(--ui-border);
  }

  .invitations-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .invitations-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .invitations-table tbody tr.expired {
    opacity: 0.6;
  }

  .purpose-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .purpose-developer {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .purpose-customer {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-created {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .status-finished {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-expired {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .status-unknown {
    background: var(--ui-panel);
    color: var(--ui-muted);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--ui-muted);
    gap: 1rem;
  }

  .empty-state :global(svg) {
    opacity: 0.5;
  }
</style>
