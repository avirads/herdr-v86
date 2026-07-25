export class EventEmitter {
  constructor(){ this._e = new Map(); }
  on(n,f){ (this._e.get(n) ?? this._e.set(n,[]).get(n)).push(f); return this; }
  once(n,f){ const g=(...a)=>{this.off(n,g);f(...a);}; return this.on(n,g); }
  off(n,f){ const a=this._e.get(n)||[]; const i=a.indexOf(f); if(i>=0)a.splice(i,1); return this; }
  emit(n,...a){ (this._e.get(n)||[]).slice().forEach(f=>f(...a)); return true; }
  removeAllListeners(n){ n?this._e.delete(n):this._e.clear(); return this; }
}
export default EventEmitter;
