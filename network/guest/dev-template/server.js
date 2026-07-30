import * as std from 'std';
import app from './dist/server.js';

const envelope = JSON.parse(std.in.readAsString());
const request = new Request(`http://vmbro.local${envelope.path}${envelope.query ? `?${envelope.query}` : ''}`, {
	method: envelope.method,
	headers: envelope.headers,
	body: envelope.body
});
const response = await app.fetch(request);
const headers = {};
response.headers.forEach((value, name) => (headers[name] = value));
std.out.puts(
	JSON.stringify({
		status: response.status,
		headers,
		body: await response.text()
	})
);
std.out.flush();
