const webcrypto = globalThis.crypto;
export const randomUUID = () => webcrypto.randomUUID();
export const getRandomValues = a => webcrypto.getRandomValues(a);
export const randomBytes = n => webcrypto.getRandomValues(new Uint8Array(n));
export { webcrypto };
export default { randomUUID, getRandomValues, randomBytes, webcrypto };
export const createHash = () => { throw new Error('crypto.createHash unavailable in browser (needs a real polyfill)'); };
export const createHmac = createHash;
export const randomFillSync = a => webcrypto.getRandomValues(a);
