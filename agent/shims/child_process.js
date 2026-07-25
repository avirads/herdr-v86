const fail = n => () => { throw new Error(`child_process.${n} unavailable in browser`); };
export const execFile = fail('execFile');
export const exec = fail('exec');
export const spawn = fail('spawn');
export const spawnSync = fail('spawnSync');
export default { execFile, exec, spawn, spawnSync };
export const execFileSync = fail("execFileSync");
