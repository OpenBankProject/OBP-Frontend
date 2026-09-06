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
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Loader2, Landmark, Users } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import * as d3 from "d3";

  interface Customer {
    customer_id: string;
    customer_number: string;
    legal_name: string;
    bank_id: string;
    parent_customer_id?: string;
  }

  interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: "customer" | "account" | "transaction" | "user";
    parent?: string;
    user_id?: string;
    /** extra data for linking / display */
    bank_id?: string;
    account_id?: string;
    relationship_type?: string;
    amount?: string;
    currency?: string;
    date?: string;
    other_account_id?: string;
    other_account_bank_id?: string;
    other_account_routings?: Array<{ scheme: string; address: string }>;
  }

  interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    label?: string;
  }

  let customers = $state<Customer[]>([]);
  let customersLoading = $state(false);
  let customersError = $state<string | null>(null);
  let selectedCustomerId = $state("");

  let graphLoading = $state(false);
  let graphError = $state<string | null>(null);
  let graphWarnings = $state<string[]>([]);

  let nodes = $state<GraphNode[]>([]);
  let links = $state<GraphLink[]>([]);

  let svgEl: SVGSVGElement | undefined = $state();
  let simulation: d3.Simulation<GraphNode, GraphLink> | null = null;

  /** Track which accounts have had their transactions expanded */
  let expandedAccounts = new Set<string>();

  /** Track which customers have had their hierarchy (parent + children) fetched */
  let expandedHierarchy = new Set<string>();

  /** Track which customers have had their user-customer-links fetched */
  let expandedUsers = new Set<string>();

  async function fetchCustomers(bankId: string) {
    if (!bankId) { customers = []; return; }
    customersLoading = true;
    customersError = null;
    selectedCustomerId = "";
    clearGraph();
    try {
      const res = await trackedFetch(`/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/customers?limit=200`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? `HTTP ${res.status}`);
      }
      const d = await res.json();
      customers = d.customers || [];

      // Auto-select customer from query params (e.g. linked from customer detail page)
      const qCustomerId = page.url.searchParams.get("customer_id");
      if (qCustomerId && customers.some((c) => c.customer_id === qCustomerId)) {
        selectedCustomerId = qCustomerId;
      }
    } catch (err) {
      customersError = err instanceof Error ? err.message : String(err);
      customers = [];
    } finally {
      customersLoading = false;
    }
  }

  let customersParsedError = $derived.by(() => {
    if (!customersError) return null;
    const m = customersError.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (m) {
      const roles = m[2].split(",").map((r) => r.trim());
      return { type: "missing_role" as const, code: m[1], roles, message: customersError };
    }
    return { type: "general" as const, message: customersError };
  });

  function clearGraph() {
    nodes = [];
    links = [];
    expandedAccounts = new Set();
    expandedCustomers = new Set();
    expandedHierarchy = new Set();
    expandedUsers = new Set();
    if (simulation) { simulation.stop(); simulation = null; }
  }

  /**
   * Fetch users linked to a customer via user_customer_links and return graph nodes/edges.
   * Each user is enriched with username via /users/user-id/{id} (parallel).
   * Inactive links are skipped.
   */
  async function fetchUsersForCustomer(
    bankId: string,
    customerId: string,
    existingNodeIds: Set<string>,
  ): Promise<{ nodes: GraphNode[]; edges: GraphLink[] }> {
    if (expandedUsers.has(customerId)) return { nodes: [], edges: [] };
    expandedUsers.add(customerId);

    const newNodes: GraphNode[] = [];
    const newEdges: GraphLink[] = [];
    const seen = new Set(existingNodeIds);
    const sourceId = `customer-${customerId}`;

    try {
      const res = await trackedFetch(
        `/proxy/obp/v4.0.0/banks/${encodeURIComponent(bankId)}/user_customer_links/customers/${encodeURIComponent(customerId)}`,
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        graphWarnings = [...graphWarnings, `Users for ${customerId}: ${errData.message ?? `HTTP ${res.status}`}`];
        return { nodes: [], edges: [] };
      }
      const data = await res.json();
      const links_ = (data.user_customer_links || []).filter((l: any) => l.is_active !== false);

      // Resolve usernames in parallel
      const userInfos = await Promise.all(
        links_.map(async (l: any) => {
          try {
            const ures = await trackedFetch(`/proxy/obp/v6.0.0/users/user-id/${encodeURIComponent(l.user_id)}`);
            if (ures.ok) {
              const u = await ures.json();
              return { user_id: l.user_id, label: u.username || u.email || l.user_id };
            }
          } catch {
            // ignore — fall back to user_id below
          }
          return { user_id: l.user_id, label: l.user_id };
        }),
      );

      for (const info of userInfos) {
        const userNodeId = `user-${info.user_id}`;
        if (!seen.has(userNodeId)) {
          newNodes.push({
            id: userNodeId,
            label: info.label,
            type: "user",
            user_id: info.user_id,
          });
          seen.add(userNodeId);
        }
        newEdges.push({ source: userNodeId, target: sourceId });
      }
    } catch {
      // ignore network errors — partial graph is fine
    }

    return { nodes: newNodes, edges: newEdges };
  }

  /**
   * Fetch parent + children for a customer and return graph nodes/edges.
   * - Children come from /customers/{id}/children
   * - Parent is read from parent_customer_id on the in-memory customers list
   *   (fetched once per customer; safe to call repeatedly).
   */
  async function fetchHierarchyForCustomer(
    bankId: string,
    customerId: string,
    existingNodeIds: Set<string>,
  ): Promise<{ nodes: GraphNode[]; edges: GraphLink[] }> {
    if (expandedHierarchy.has(customerId)) return { nodes: [], edges: [] };
    expandedHierarchy.add(customerId);

    const newNodes: GraphNode[] = [];
    const newEdges: GraphLink[] = [];
    const seen = new Set(existingNodeIds);
    const sourceId = `customer-${customerId}`;

    // Parent edge — read from in-memory customers list
    const self = customers.find((c) => c.customer_id === customerId);
    const parentId = self?.parent_customer_id;
    if (parentId) {
      const parent = customers.find((c) => c.customer_id === parentId);
      const parentNodeId = `customer-${parentId}`;
      if (!seen.has(parentNodeId)) {
        newNodes.push({
          id: parentNodeId,
          label: parent?.legal_name || parentId,
          type: "customer",
          bank_id: parent?.bank_id || bankId,
        });
        seen.add(parentNodeId);
      }
      newEdges.push({ source: sourceId, target: parentNodeId, label: "parent" });
    }

    // Children — call /customers/{id}/children
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}/children`,
      );
      if (res.ok) {
        const data = await res.json();
        for (const child of data.customers || []) {
          const childNodeId = `customer-${child.customer_id}`;
          if (!seen.has(childNodeId)) {
            newNodes.push({
              id: childNodeId,
              label: child.legal_name || child.customer_id,
              type: "customer",
              bank_id: child.bank_id,
            });
            seen.add(childNodeId);
          }
          newEdges.push({ source: sourceId, target: childNodeId, label: "child" });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        graphWarnings = [...graphWarnings, `Children of ${customerId}: ${errData.message ?? `HTTP ${res.status}`}`];
      }
    } catch {
      // ignore network errors — partial graph is fine
    }

    return { nodes: newNodes, edges: newEdges };
  }

  async function loadGraph(bankId: string, customerId: string) {
    if (!bankId || !customerId) return;
    graphLoading = true;
    graphError = null;
    graphWarnings = [];
    clearGraph();

    const customer = customers.find((c) => c.customer_id === customerId);
    const customerLabel = customer?.legal_name || customerId;

    try {
      expandedCustomers.add(customerId);

      // Fetch account links and customer links in parallel
      const [accountLinksRes, customerLinksRes] = await Promise.all([
        trackedFetch(`/backend/obp/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}/customer-account-links`),
        trackedFetch(`/backend/obp/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}/customer-links`),
      ]);

      if (!accountLinksRes.ok) {
        const d = await accountLinksRes.json().catch(() => ({}));
        throw new Error(d.message ?? `HTTP ${accountLinksRes.status}`);
      }
      const accountLinksData = await accountLinksRes.json();
      const accountLinks = accountLinksData.links || [];

      // Customer links may fail (missing role) — don't block the graph
      let customerLinks: any[] = [];
      if (customerLinksRes.ok) {
        const clData = await customerLinksRes.json();
        customerLinks = clData.customer_links || [];
      } else {
        const errData = await customerLinksRes.json().catch(() => ({}));
        graphWarnings = [...graphWarnings, `Customer links: ${errData.message ?? `HTTP ${customerLinksRes.status}`}`];
      }

      const customerNode: GraphNode = {
        id: `customer-${customerId}`,
        label: customerLabel,
        type: "customer",
        bank_id: bankId,
      };

      // Account nodes — show routing address, fall back to account_id
      const accountNodes: GraphNode[] = accountLinks.map((l: any) => {
        const routing = l.account_routings?.[0];
        return {
          id: `account-${l.account_id}`,
          label: routing ? routing.address : l.account_id,
          type: "account" as const,
          bank_id: l.bank_id,
          account_id: l.account_id,
          relationship_type: l.relationship_type,
        };
      });

      const accountEdges: GraphLink[] = accountLinks.map((l: any) => ({
        source: `customer-${customerId}`,
        target: `account-${l.account_id}`,
        label: l.relationship_type,
      }));

      // Related customer nodes
      const relatedCustomerNodes: GraphNode[] = customerLinks.map((cl: any) => ({
        id: `customer-${cl.other_customer_id}`,
        label: cl.other_customer_legal_name || cl.other_customer_id,
        type: "customer" as const,
        bank_id: cl.other_bank_id,
      }));

      const relatedCustomerEdges: GraphLink[] = customerLinks.map((cl: any) => ({
        source: `customer-${customerId}`,
        target: `customer-${cl.other_customer_id}`,
        label: cl.relationship_to,
      }));

      nodes = [customerNode, ...accountNodes, ...relatedCustomerNodes];
      links = [...accountEdges, ...relatedCustomerEdges];

      // Enrich all accounts with details + linked customers, fetch transactions, hierarchy, and users — all in parallel
      const existingIds = new Set(nodes.map((n) => n.id));
      const [customerResults, txResults, hierarchyResult, usersResult] = await Promise.all([
        Promise.all(accountNodes.map((n) => fetchCustomersForAccount(n, nodes))),
        Promise.all(accountNodes.map((n) => fetchTransactionsForNode(n))),
        fetchHierarchyForCustomer(bankId, customerId, existingIds),
        fetchUsersForCustomer(bankId, customerId, existingIds),
      ]);

      const extraNodes: GraphNode[] = [...hierarchyResult.nodes, ...usersResult.nodes];
      const extraEdges: GraphLink[] = [...hierarchyResult.edges, ...usersResult.edges];
      for (const result of customerResults) {
        extraNodes.push(...result.nodes);
        extraEdges.push(...result.edges);
      }
      for (const result of txResults) {
        if (result) {
          extraNodes.push(...result.nodes);
          extraEdges.push(...result.edges);
        }
      }

      nodes = [...nodes, ...extraNodes];
      links = [...links, ...extraEdges];

      renderGraph();
    } catch (err) {
      graphError = err instanceof Error ? err.message : "Failed to load graph";
    } finally {
      graphLoading = false;
    }
  }

  /** Fetch transactions for a node and return the graph data without mutating state */
  async function fetchTransactionsForNode(node: GraphNode): Promise<{ nodes: GraphNode[]; edges: GraphLink[] } | null> {
    if (node.type !== "account" || !node.account_id || !node.bank_id) return null;
    if (expandedAccounts.has(node.account_id)) return null;
    expandedAccounts.add(node.account_id);

    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(node.bank_id)}/accounts/${encodeURIComponent(node.account_id)}/owner/transactions?limit=10&sort_direction=DESC`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const transactions = data.transactions || [];

      const txNodes: GraphNode[] = transactions.map((tx: any) => {
        const details = tx.details || {};
        const otherAcc = tx.other_account || {};
        const amount = details.value?.amount || tx.details?.amount || "";
        const currency = details.value?.currency || tx.details?.currency || "";
        const date = details.completed || tx.details?.completed || "";
        const shortDate = date ? new Date(date).toLocaleDateString() : "";
        const description = details.description || "";
        const label = `${amount} ${currency}${description ? " " + description : ""}`;

        return {
          id: `tx-${tx.transaction_id}`,
          label: label.length > 30 ? label.substring(0, 27) + "..." : label,
          type: "transaction" as const,
          parent: node.id,
          amount,
          currency,
          date: shortDate,
          other_account_id: otherAcc.account_id || "",
          other_account_bank_id: otherAcc.bank_id || "",
          other_account_routings: otherAcc.account_routings || [],
        };
      });

      const edges: GraphLink[] = txNodes.map((tn) => ({
        source: node.id,
        target: tn.id,
      }));

      return { nodes: txNodes, edges };
    } catch {
      return null;
    }
  }

  /**
   * Fetch customer-account-links for an account and return customer nodes + edges.
   * Also fetches account details to set a proper label if not already set.
   */
  async function fetchCustomersForAccount(
    accountNode: GraphNode,
    existingNodes: GraphNode[]
  ): Promise<{ nodes: GraphNode[]; edges: GraphLink[] }> {
    if (!accountNode.account_id || !accountNode.bank_id) return { nodes: [], edges: [] };

    const newNodes: GraphNode[] = [];
    const newEdges: GraphLink[] = [];

    try {
      // Fetch account details and customer-account-links in parallel
      const [acctRes, calRes] = await Promise.all([
        trackedFetch(
          `/proxy/obp/v6.0.0/banks/${encodeURIComponent(accountNode.bank_id)}/accounts/${encodeURIComponent(accountNode.account_id)}/owner/account`
        ).catch(() => null),
        trackedFetch(
          `/backend/obp/banks/${encodeURIComponent(accountNode.bank_id)}/accounts/${encodeURIComponent(accountNode.account_id)}/customer-account-links`
        ).catch(() => null),
      ]);

      // Update account label: show routing address, fall back to account_id
      if (accountNode.label === accountNode.account_id || !accountNode.label) {
        let resolved = false;
        if (acctRes?.ok) {
          const acct = await acctRes.json();
          const routing = acct.account_routings?.[0];
          if (routing) {
            accountNode.label = routing.address;
            resolved = true;
          }
        }
        if (!resolved && calRes) {
          // Try from enriched customer-account-links response
          const calData = await calRes.clone().json().catch(() => ({}));
          const routing = calData.account_routings?.[0];
          if (routing) {
            accountNode.label = routing.address;
            resolved = true;
          }
        }
        if (!resolved) {
          accountNode.label = accountNode.account_id || "";
        }
      }

      // Add linked customers
      if (calRes?.ok) {
        const calData = await calRes.json();
        for (const cal of calData.links || []) {
          const custNodeId = `customer-${cal.customer_id}`;
          const allNodes = [...existingNodes, ...newNodes];
          if (!allNodes.some((n) => n.id === custNodeId)) {
            newNodes.push({
              id: custNodeId,
              label: cal.legal_name || cal.customer_id,
              type: "customer",
              bank_id: cal.bank_id,
            });
          }
          // Add edge from customer to account (skip if already linked)
          newEdges.push({ source: custNodeId, target: accountNode.id, label: cal.relationship_type });
        }
      }
    } catch {
      // continue with what we have
    }

    return { nodes: newNodes, edges: newEdges };
  }

  /** Track which customers have been expanded */
  let expandedCustomers = new Set<string>();

  /** Expand a related customer — load their account links, customer links, and transactions */
  async function expandCustomer(node: GraphNode) {
    if (node.type !== "customer" || !node.bank_id) return;
    const custId = node.id.replace("customer-", "");
    if (expandedCustomers.has(custId)) return;
    expandedCustomers.add(custId);

    try {
      const existingIdsSnapshot = new Set(nodes.map((n) => n.id));
      const [alRes, clRes, hierarchy, usersResult] = await Promise.all([
        trackedFetch(`/backend/obp/banks/${encodeURIComponent(node.bank_id)}/customers/${encodeURIComponent(custId)}/customer-account-links`),
        trackedFetch(`/backend/obp/banks/${encodeURIComponent(node.bank_id)}/customers/${encodeURIComponent(custId)}/customer-links`),
        fetchHierarchyForCustomer(node.bank_id, custId, existingIdsSnapshot),
        fetchUsersForCustomer(node.bank_id, custId, existingIdsSnapshot),
      ]);

      const newNodes: GraphNode[] = [...hierarchy.nodes, ...usersResult.nodes];
      const newEdges: GraphLink[] = [...hierarchy.edges, ...usersResult.edges];

      // Account links (start with account_id as label — enriched below)
      if (alRes.ok) {
        const alData = await alRes.json();
        for (const l of alData.links || []) {
          const acctId = `account-${l.account_id}`;
          if (!nodes.some((n) => n.id === acctId)) {
            newNodes.push({
              id: acctId, label: l.account_routings?.[0]?.address || l.account_id, type: "account",
              bank_id: l.bank_id, account_id: l.account_id, relationship_type: l.relationship_type,
            });
          }
          newEdges.push({ source: node.id, target: acctId, label: l.relationship_type });
        }
      }

      // Customer links
      if (clRes.ok) {
        const clData = await clRes.json();
        for (const cl of clData.customer_links || []) {
          const otherId = `customer-${cl.other_customer_id}`;
          if (!nodes.some((n) => n.id === otherId) && !newNodes.some((n) => n.id === otherId)) {
            newNodes.push({
              id: otherId,
              label: cl.other_customer_legal_name || cl.other_customer_id,
              type: "customer",
              bank_id: cl.other_bank_id,
            });
          }
          newEdges.push({ source: node.id, target: otherId, label: cl.relationship_to });
        }
      }

      nodes = [...nodes, ...newNodes];
      links = [...links, ...newEdges];

      // Enrich new accounts with details + linked customers, and fetch transactions
      const newAccountNodes = newNodes.filter((n) => n.type === "account");
      const [custResults, txResults] = await Promise.all([
        Promise.all(newAccountNodes.map((n) => fetchCustomersForAccount(n, nodes))),
        Promise.all(newAccountNodes.map((n) => fetchTransactionsForNode(n))),
      ]);

      const extraNodes: GraphNode[] = [];
      const extraEdges: GraphLink[] = [];
      for (const r of custResults) {
        extraNodes.push(...r.nodes);
        extraEdges.push(...r.edges);
      }
      for (const r of txResults) {
        if (r) { extraNodes.push(...r.nodes); extraEdges.push(...r.edges); }
      }

      nodes = [...nodes, ...extraNodes];
      links = [...links, ...extraEdges];

      renderGraph();
    } catch {
      // silently fail
    }
  }

  /** Interactive click handler — expand a single account and re-render */
  async function expandAccount(node: GraphNode) {
    const result = await fetchTransactionsForNode(node);
    if (!result) return;

    nodes = [...nodes, ...result.nodes];
    links = [...links, ...result.edges];
    renderGraph();
  }

  /** Expand a transaction to show the other account + its customers via customer-account-links */
  async function expandTransaction(node: GraphNode) {
    if (node.type !== "transaction" || !node.other_account_id || !node.other_account_bank_id) return;

    const otherNodeId = `account-${node.other_account_id}`;

    // If the other account already exists in the graph, just add an edge
    const alreadyExists = nodes.some((n) => n.id === otherNodeId);
    if (alreadyExists) {
      const edgeExists = links.some(
        (l) =>
          ((typeof l.source === "string" ? l.source : (l.source as GraphNode).id) === node.id &&
           (typeof l.target === "string" ? l.target : (l.target as GraphNode).id) === otherNodeId)
      );
      if (!edgeExists) {
        links = [...links, { source: node.id, target: otherNodeId }];
        renderGraph();
      }
      return;
    }

    const otherAccountNode: GraphNode = {
      id: otherNodeId,
      label: "",
      type: "account",
      bank_id: node.other_account_bank_id,
      account_id: node.other_account_id,
    };

    nodes = [...nodes, otherAccountNode];
    links = [...links, { source: node.id, target: otherNodeId }];

    // Enrich with details + linked customers, and fetch transactions
    const [custResult, txResult] = await Promise.all([
      fetchCustomersForAccount(otherAccountNode, nodes),
      fetchTransactionsForNode(otherAccountNode),
    ]);

    const extraNodes = [...custResult.nodes];
    const extraEdges = [...custResult.edges];
    if (txResult) {
      extraNodes.push(...txResult.nodes);
      extraEdges.push(...txResult.edges);
    }

    nodes = [...nodes, ...extraNodes];
    links = [...links, ...extraEdges];

    renderGraph();
  }

  function renderGraph() {
    if (!svgEl) return;

    const width = svgEl.clientWidth;
    const height = svgEl.clientHeight;

    // Clear previous
    d3.select(svgEl).selectAll("*").remove();
    if (simulation) simulation.stop();

    const svg = d3.select(svgEl);

    // Zoom
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => g.attr("transform", event.transform)) as any
    );

    // Arrowhead marker
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    // Local copies for D3
    const localNodes = nodes.map((n) => ({ ...n }));
    const localLinks = links.map((l) => ({
      ...l,
      source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
      target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
    }));

    simulation = d3.forceSimulation(localNodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(localLinks).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(localLinks)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Link labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(localLinks.filter((l) => l.label))
      .join("text")
      .attr("font-size", 9)
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .text((d) => d.label || "");

    // Node groups
    const nodeGroup = g.append("g")
      .selectAll("g")
      .data(localNodes)
      .join("g")
      .attr("cursor", (d) => {
        if (d.type === "account") return "pointer";
        if (d.type === "transaction" && d.other_account_id) return "pointer";
        if (d.type === "customer" && !expandedCustomers.has(d.id.replace("customer-", ""))) return "pointer";
        return "default";
      })
      .on("click", (_event, d) => {
        if (d.type === "account") expandAccount(d);
        else if (d.type === "transaction") expandTransaction(d);
        else if (d.type === "customer") expandCustomer(d);
      })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation!.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation!.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    const nodeRadius = (t: GraphNode["type"]) =>
      t === "customer" ? 24 : t === "account" ? 18 : t === "user" ? 16 : 12;
    const nodeFill = (t: GraphNode["type"]) =>
      t === "customer" ? "#6366f1" : t === "account" ? "#0ea5e9" : t === "user" ? "#f97316" : "#22c55e";
    const nodeStroke = (t: GraphNode["type"]) =>
      t === "customer" ? "#4338ca" : t === "account" ? "#0284c7" : t === "user" ? "#c2410c" : "#16a34a";
    const nodeLetter = (t: GraphNode["type"]) =>
      t === "customer" ? "C" : t === "account" ? "A" : t === "user" ? "U" : "T";
    const nodeLabelDy = (t: GraphNode["type"]) =>
      t === "customer" ? 38 : t === "account" ? 30 : t === "user" ? 28 : 24;
    const nodeLetterSize = (t: GraphNode["type"]) =>
      t === "customer" ? 14 : t === "account" ? 11 : t === "user" ? 11 : 9;

    // Node circles
    nodeGroup.append("circle")
      .attr("r", (d) => nodeRadius(d.type))
      .attr("fill", (d) => nodeFill(d.type))
      .attr("stroke", (d) => nodeStroke(d.type))
      .attr("stroke-width", 2);

    // Node labels
    nodeGroup.append("text")
      .attr("dy", (d) => nodeLabelDy(d.type))
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => d.type === "customer" ? 12 : 10)
      .attr("font-weight", (d) => d.type === "customer" ? "600" : "400")
      .attr("fill", "currentColor")
      .text((d) => d.label);

    // Type icons (text inside circles)
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => nodeLetterSize(d.type))
      .attr("fill", "white")
      .attr("pointer-events", "none")
      .text((d) => nodeLetter(d.type));

    // Tooltip on hover for accounts
    nodeGroup.append("title")
      .text((d) => {
        if (d.type === "customer") {
          const custId = d.id.replace("customer-", "");
          return expandedCustomers.has(custId) ? d.label : d.label + "\nClick to expand";
        }
        if (d.type === "account") {
          const tip = `Account: ${d.account_id}\nRelationship: ${d.relationship_type || ""}`;
          return expandedAccounts.has(d.account_id || "") ? tip : tip + "\nClick to load transactions";
        }
        if (d.type === "user") {
          return `User: ${d.label}\nuser_id: ${d.user_id}`;
        }
        const tip = `${d.amount} ${d.currency}\n${d.date}`;
        return d.other_account_id ? tip + "\nClick to show other account & customers" : tip;
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 6);

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }

  $effect(() => {
    const bankId = currentBank.bankId;
    fetchCustomers(bankId);
  });

  $effect(() => {
    if (selectedCustomerId && currentBank.bankId) {
      loadGraph(currentBank.bankId, selectedCustomerId);
    }
  });

  onMount(() => {
    // Re-render on window resize
    const onResize = () => { if (nodes.length > 0) renderGraph(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
</script>

<svelte:head>
  <title>Customer Graph - API Manager II</title>
</svelte:head>

<div class="graph-page">
  <div class="graph-toolbar">
    <h1 class="toolbar-title">Customer Graph</h1>

    {#if !currentBank.bankId}
      <span class="toolbar-hint">Select a bank to begin</span>
    {:else if customersLoading}
      <Loader2 size={16} class="spinner-icon" />
      <span class="toolbar-hint">Loading customers...</span>
    {:else if customersError && customersParsedError?.type !== "missing_role"}
      <span class="toolbar-error">{customersError}</span>
    {:else}
      <select
        name="customer_id"
        data-testid="graph-customer-select"
        class="toolbar-select"
        bind:value={selectedCustomerId}
        disabled={customers.length === 0}
      >
        <option value="">
          {customers.length === 0 ? "No customers available" : "Select a customer..."}
        </option>
        {#each customers as c}
          <option value={c.customer_id}>
            {c.legal_name || c.customer_number || c.customer_id}
          </option>
        {/each}
      </select>

      {#if graphLoading}
        <Loader2 size={16} class="spinner-icon" />
      {/if}
    {/if}

    <div class="toolbar-legend">
      <span class="legend-item"><span class="legend-dot customer"></span> Customer</span>
      <span class="legend-item"><span class="legend-dot account"></span> Account</span>
      <span class="legend-item"><span class="legend-dot user"></span> User</span>
      <span class="legend-item"><span class="legend-dot transaction"></span> Transaction</span>
    </div>
  </div>

  {#if customersParsedError?.type === "missing_role"}
    <div class="missing-role-wrap">
      <MissingRoleAlert
        roles={customersParsedError.roles}
        errorCode={customersParsedError.code}
        message={customersParsedError.message}
        bankId={currentBank.bankId}
      />
    </div>
  {/if}
  {#if graphError}
    <div class="graph-error">{graphError}</div>
  {/if}
  {#if graphWarnings.length > 0}
    <div class="graph-warning">
      {#each graphWarnings as w}
        <div>{w}</div>
      {/each}
    </div>
  {/if}

  <div class="graph-container">
    {#if !currentBank.bankId}
      <div class="graph-empty">
        <Landmark size={48} />
        <p>Select a bank to view the customer graph</p>
      </div>
    {:else if !selectedCustomerId && !customersLoading}
      <div class="graph-empty">
        <Users size={48} />
        <p>Select a customer to see their account network</p>
      </div>
    {:else}
      <svg bind:this={svgEl} class="graph-svg"></svg>
    {/if}
  </div>
</div>

<style>
  .graph-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .graph-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: white;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .graph-toolbar {
    background: rgb(var(--color-surface-800));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .toolbar-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
  }

  .toolbar-hint {
    font-size: 0.813rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .toolbar-hint {
    color: var(--color-surface-400);
  }

  .toolbar-error {
    font-size: 0.813rem;
    color: #dc2626;
  }

  .toolbar-select {
    padding: 0.375rem 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.813rem;
    min-width: 250px;
  }

  .toolbar-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .toolbar-select {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .toolbar-legend {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .toolbar-legend {
    color: var(--color-surface-400);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    white-space: nowrap;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .legend-dot.customer { background: #6366f1; }
  .legend-dot.account { background: #0ea5e9; }
  .legend-dot.user { background: #f97316; }
  .legend-dot.transaction { background: #22c55e; }

  .graph-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .graph-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .graph-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .graph-empty {
    color: var(--color-surface-500);
  }

  .missing-role-wrap {
    padding: 0.75rem 1.5rem;
    flex-shrink: 0;
  }

  .graph-error {
    padding: 0.75rem 1.5rem;
    background: #fef2f2;
    border-bottom: 1px solid #fca5a5;
    font-size: 0.813rem;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .graph-error {
    background: rgba(220, 38, 38, 0.1);
    border-bottom-color: rgba(220, 38, 38, 0.3);
    color: rgb(var(--color-error-300));
  }

  .graph-warning {
    padding: 0.5rem 1.5rem;
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    font-size: 0.75rem;
    color: #92400e;
  }

  :global([data-mode="dark"]) .graph-warning {
    background: rgba(245, 158, 11, 0.1);
    border-bottom-color: rgba(245, 158, 11, 0.3);
    color: rgb(var(--color-warning-300));
  }

  .graph-toolbar :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
