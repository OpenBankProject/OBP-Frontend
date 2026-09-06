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
        `/proxy/obp/v4.0.0/banks/${encodeURIComponent(selectedBankId)}/user-invitations`,
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
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      User Invitations
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
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
          <p>No bank selected. Please select a bank in <a href="/user" style="color: #3b82f6; text-decoration: underline;">My Account</a> to view invitations.</p>
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
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
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
    color: #374151;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-300);
  }

  .required {
    color: #ef4444;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    color: #111827;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .form-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  :global([data-mode="dark"]) .form-input:disabled {
    background: rgb(var(--color-surface-800));
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
    background: #667eea;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
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
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-200));
    border-color: rgba(16, 185, 129, 0.4);
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-200));
    border-color: rgba(239, 68, 68, 0.4);
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
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .invitations-table th {
    color: var(--color-surface-300);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .invitations-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .invitations-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .invitations-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .invitations-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
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
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .purpose-developer {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-200));
  }

  .purpose-customer {
    background: #e0e7ff;
    color: #3730a3;
  }

  :global([data-mode="dark"]) .purpose-customer {
    background: rgba(99, 102, 241, 0.2);
    color: rgb(147, 197, 253);
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
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .status-created {
    background: rgba(251, 191, 36, 0.2);
    color: rgb(253, 224, 71);
  }

  .status-finished {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .status-finished {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-200));
  }

  .status-expired {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-expired {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-200));
  }

  .status-unknown {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .status-unknown {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: #6b7280;
    gap: 1rem;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-state :global(svg) {
    opacity: 0.5;
  }
</style>
