// jsdom ships no type declarations; only its constructor and window are used here.
declare module 'jsdom' {
	export class JSDOM {
		constructor(html?: string);
		readonly window: any;
	}
}
