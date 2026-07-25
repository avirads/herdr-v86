const fail = n => { throw new Error(`node stream.${n} unavailable in browser`); };
export class Transform { constructor(){ fail('Transform'); } }
export class PassThrough { constructor(){ fail('PassThrough'); } }
export class Readable { constructor(){ fail('Readable'); } }
export class Writable { constructor(){ fail('Writable'); } }
export default { Transform, PassThrough, Readable, Writable };
