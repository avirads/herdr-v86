// Node fs is unreachable in a browser tab. Anything that actually calls it is
// a LocalFilesystem/LocalSandbox code path we are replacing with V86*.
const fail = name => () => { throw new Error(`node:fs.${name} unavailable in browser`); };
const handler = { get: (_t, prop) => fail(String(prop)) };
const fs = new Proxy({}, handler);
export default fs;
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };
export const existsSync = () => false;
export const statSync = fail('statSync');
export const readFileSync = fail('readFileSync');
export const realpathSync = fail('realpathSync');
export const promises = fs;
export const mkdirSync = fail('mkdirSync');
export const mkdtemp = fail('mkdtemp');
export const readdirSync = fail('readdirSync');
export const renameSync = fail('renameSync');
export const rmSync = fail('rmSync');
export const writeFileSync = fail('writeFileSync');
export const rm = fail("rm");
export const writeFile = fail("writeFile");
