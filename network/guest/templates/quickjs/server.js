/**
 * A QuickJS request handler — this project's "dev server".
 *
 * It is run once per connection by `nc -lk -e`, with the socket as stdin and
 * stdout, so there is no long-lived process and no ports to manage here. Routes
 * are just code; static files come from ./public.
 *
 * Edit and save: the next request runs the new code, no restart needed.
 */
import { readRequest, sendJson, sendText, serveStatic } from './lib/http.js';

const PUBLIC = `${scriptDir()}/public`;

const request = readRequest();

if (request.path === '/api/hello') {
	sendJson(200, {
		message: 'Hello from QuickJS',
		method: request.method,
		query: request.query,
		runtime: 'QuickJS on 32-bit Alpine, emulated in your browser tab'
	});
} else if (request.path === '/api/echo' && request.method === 'POST') {
	sendJson(200, { youSent: request.body });
} else if (!serveStatic(PUBLIC, request.path === '/' ? '/' : request.path)) {
	sendText('404 Not Found', `No route or file for ${request.path}\n`);
}

/** Directory this script lives in, so the handler works from any cwd. */
function scriptDir() {
	const path = scriptArgs[0] || '';
	const slash = path.lastIndexOf('/');
	return slash <= 0 ? '.' : path.slice(0, slash);
}
