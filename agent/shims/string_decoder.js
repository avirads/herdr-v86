export class StringDecoder {
  constructor(enc='utf8'){ this._d = new TextDecoder(enc==='utf8'?'utf-8':enc); }
  write(buf){ return this._d.decode(buf, { stream: true }); }
  end(buf){ return buf ? this._d.decode(buf) : ''; }
}
export default { StringDecoder };
