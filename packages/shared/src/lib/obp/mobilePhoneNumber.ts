// Mirrors the check OBP applies to a user's own mobile phone number
// (InvalidPhoneNumber in v7.0.0: POST /users, PUT /my/user/mobile-phone-number):
// an optional leading "+", then 5-50 characters of digits, spaces, dashes,
// dots and parentheses. Kept as a source string so the same rule can feed both
// an HTML `pattern` attribute (which anchors implicitly) and a RegExp.
//
// Browsers compile `pattern` with the RegExp `v` flag, under which "(" ")" and
// "." inside a character class must be escaped — an unescaped one makes the
// whole pattern invalid and the browser silently skips validation.
export const MOBILE_PHONE_NUMBER_PATTERN_SOURCE = '\\+?[0-9\\-\\s\\(\\)\\.]{5,50}';
export const MOBILE_PHONE_NUMBER_PATTERN = new RegExp(`^${MOBILE_PHONE_NUMBER_PATTERN_SOURCE}$`);

export function isMobilePhoneNumberValid(value: string): boolean {
	return MOBILE_PHONE_NUMBER_PATTERN.test(value);
}
