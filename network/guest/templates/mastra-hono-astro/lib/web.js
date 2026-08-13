/** Minimal Fetch objects required by Hono's core routing and response helpers. */
export class Headers {
	#values = new Map();

	constructor(init = undefined) {
		if (init instanceof Headers) {
			for (const [name, value] of init.entries()) this.set(name, value);
		} else if (Array.isArray(init)) {
			for (const [name, value] of init) this.append(name, value);
		} else if (init) {
			for (const name of Object.keys(init)) this.set(name, init[name]);
		}
	}
	append(name, value) {
		const key = String(name).toLowerCase();
		const old = this.#values.get(key);
		this.#values.set(key, old ? `${old}, ${value}` : String(value));
	}
	delete(name) {
		this.#values.delete(String(name).toLowerCase());
	}
	get(name) {
		return this.#values.get(String(name).toLowerCase()) ?? null;
	}
	has(name) {
		return this.#values.has(String(name).toLowerCase());
	}
	set(name, value) {
		this.#values.set(String(name).toLowerCase(), String(value));
	}
	entries() {
		return this.#values.entries();
	}
	keys() {
		return this.#values.keys();
	}
	values() {
		return this.#values.values();
	}
	forEach(callback, thisArg) {
		for (const [name, value] of this.#values) callback.call(thisArg, value, name, this);
	}
	[Symbol.iterator]() {
		return this.entries();
	}
}

class Body {
	constructor(body = null) {
		this.body = body;
		this.bodyUsed = false;
	}
	async text() {
		this.bodyUsed = true;
		return this.body == null ? '' : String(this.body);
	}
	async json() {
		return JSON.parse(await this.text());
	}
	async arrayBuffer() {
		const text = await this.text();
		const buffer = new ArrayBuffer(text.length);
		const bytes = new Uint8Array(buffer);
		for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 255;
		return buffer;
	}
}

export class Request extends Body {
	constructor(input, init = {}) {
		const source = input instanceof Request ? input : null;
		super(init.body ?? source?.body ?? null);
		this.url = source?.url ?? String(input);
		this.method = String(init.method ?? source?.method ?? 'GET').toUpperCase();
		this.headers = new Headers(init.headers ?? source?.headers);
		this.signal = init.signal ?? source?.signal ?? { aborted: false };
		this.raw = this;
	}
	clone() {
		return new Request(this);
	}
}

export class Response extends Body {
	constructor(body = null, init = {}) {
		super(body);
		if (init instanceof Response) {
			this.status = init.status;
			this.statusText = init.statusText;
			this.headers = new Headers(init.headers);
		} else {
			this.status = init.status ?? 200;
			this.statusText = init.statusText ?? '';
			this.headers = new Headers(init.headers);
		}
		this.ok = this.status >= 200 && this.status < 300;
	}
	clone() {
		return new Response(this.body, this);
	}
	static json(value, init = {}) {
		const headers = new Headers(init.headers);
		if (!headers.has('content-type')) headers.set('content-type', 'application/json');
		return new Response(JSON.stringify(value), { ...init, headers });
	}
	static redirect(url, status = 302) {
		return new Response(null, { status, headers: { location: String(url) } });
	}
}

export function installWebGlobals() {
	globalThis.Headers = Headers;
	globalThis.Request = Request;
	globalThis.Response = Response;
}
