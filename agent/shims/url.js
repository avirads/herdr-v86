export const fileURLToPath = u => String(u).replace(/^file:\/\//,'');
export const pathToFileURL = p => new URL(`file://${p}`);
export const URL = globalThis.URL;
export default { fileURLToPath, pathToFileURL, URL };
