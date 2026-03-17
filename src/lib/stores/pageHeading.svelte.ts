/**
 * A simple reactive store for the current page's entity heading.
 * Pages set this to the name/title of the entity being viewed
 * (e.g. "Singapore BioTech Solutions Pte Ltd" on a customer page).
 *
 * The Opey Insight Bar reads this to enrich its display and "Ask Opey" prompt.
 *
 * Usage from any page:
 *   import { pageHeading } from '$lib/stores/pageHeading.svelte';
 *   pageHeading.set("Singapore BioTech Solutions Pte Ltd");
 */

let heading = $state("");

export const pageHeading = {
	get value() { return heading; },
	set(text: string) { heading = text; },
	clear() { heading = ""; },
};
