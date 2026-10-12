/** Native sign-in remains compatible; browser responses must carry their attempt nonce. */
export const googleNonceMatches = (actual: unknown, expected?: string) => !expected || actual === expected;
