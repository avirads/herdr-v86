export class AsyncLocalStorage {
  constructor(){ this._s = undefined; }
  getStore(){ return this._s; }
  run(store, fn, ...args){ const p=this._s; this._s=store; try { return fn(...args); } finally { this._s=p; } }
  enterWith(store){ this._s = store; }
}
export class AsyncResource { constructor(){} runInAsyncScope(fn,thisArg,...a){ return fn.apply(thisArg,a); } }
export default { AsyncLocalStorage, AsyncResource };
