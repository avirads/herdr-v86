/**
 * Express-style application routes executed by QuickJS.
 *
 * vmbro-httpd owns the socket, HTTP parsing, static files and error recovery.
 * It starts this module for an /api request and exchanges one JSON document over
 * stdin/stdout, so saving this file changes the next request without a restart.
 */
import * as std from 'std';

const routes = [];
const app = {
	get(path, handler) {
		routes.push({ method: 'GET', path, handler });
	},
	post(path, handler) {
		routes.push({ method: 'POST', path, handler });
	}
};

app.get('/api/hello', (request) => ({
	json: {
		message: 'Hello from Chi + QuickJS',
		method: request.method,
		query: request.query,
		runtime: 'Chi handles HTTP; your application routes stay editable JavaScript'
	}
}));

app.post('/api/echo', (request) => ({
	status: 201,
	json: { youSent: request.body }
}));

const request = JSON.parse(std.in.readAsString());
const route = routes.find((entry) => entry.method === request.method && entry.path === request.path);
const result = route ? route.handler(request) : { status: 404, text: `No route for ${request.path}\n` };
const body = result.json === undefined ? result.text || '' : JSON.stringify(result.json, null, 2);
const response = {
	status: result.status || 200,
	headers: {
		'content-type':
			result.json === undefined ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
		...(result.headers || {})
	},
	body
};
std.out.puts(JSON.stringify(response));
std.out.flush();
