export type LoadErrorCategory =
	| 'access'
	| 'not_found'
	| 'unauthorized'
	| 'rate_limit'
	| 'timeout'
	| 'other';

export interface LoadError {
	status: number;
	message: string;
	obpCode: string | null;
	category: LoadErrorCategory;
}
