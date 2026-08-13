/**
 * Minimal HTTP/1.1 plumbing for a QuickJS request handler.
 *
 * The server model here is CGI: `nc -lk -e` accepts a connection and runs this
 * program with the socket as stdin and stdout. One process per request, so
 * nothing persists between requests — keep state in files if you need it.
 */
import * as std from 'std';

const MIME = {
	html: 'text/html; charset=utf-8',
	htm: 'text/html; charset=utf-8',
	js: 'text/javascript; charset=utf-8',
	mjs: 'text/javascript; charset=utf-8',
	css: 'text/css; charset=utf-8',
	json: 'application/json; charset=utf-8',
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	ico: 'image/vnd.microsoft.icon',
	woff2: 'font/woff2',
	txt: 'text/plain; charset=utf-8',
	md: 'text/plain; charset=utf-8'
};

/** UTF-8 byte length; QuickJS has no TextEncoder. */
function byteLength(text) {
	let bytes = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.codePointAt(index);
		if (code > 0xffff) index += 1;
		bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
	}
	return bytes;
}

/**
 * Reads the request from stdin.
 *
 * Stops at the end of the headers (plus a declared body) rather than reading to
 * EOF: the client may hold the connection open, and reading past the request
 * would block until its timeout.
 */
export function readRequest() {
	let head = '';
	while (!head.endsWith('\r\n\r\n')) {
		const byte = std.in.getByte();
		if (byte < 0) break;
		head += String.fromCharCode(byte);
		if (head.length > 65536) break;
	}

	const lines = head.split('\r\n');
	const parts = (lines[0] || '').split(' ');
	const headers = {};
	for (const line of lines.slice(1)) {
		const colon = line.indexOf(':');
		if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
	}

	const target = parts[1] || '/';
	const split = target.indexOf('?');
	let body = '';
	const declared = Number(headers['content-length'] || 0);
	for (let index = 0; index < declared; index += 1) {
		const byte = std.in.getByte();
		if (byte < 0) break;
		body += String.fromCharCode(byte);
	}

	return {
		method: parts[0] || 'GET',
		target,
		path: split < 0 ? target : target.slice(0, split),
		query: split < 0 ? '' : target.slice(split + 1),
		headers,
		body
	};
}

function writeHead(status, type, length, extra) {
	let head = `HTTP/1.1 ${status}\r\nContent-Type: ${type}\r\nContent-Length: ${length}\r\n`;
	head += 'Cache-Control: no-store\r\nConnection: close\r\n';
	for (const name in extra || {}) head += `${name}: ${extra[name]}\r\n`;
	std.out.puts(`${head}\r\n`);
}

export function send(status, type, body, extra) {
	writeHead(status, type, byteLength(body), extra);
	std.out.puts(body);
	std.out.flush();
}

export function sendText(status, body) {
	send(status, MIME.txt, body);
}

export function sendHtml(status, body) {
	send(status, MIME.html, body);
}

export function sendJson(status, value) {
	send(status, MIME.json, JSON.stringify(value, null, 2));
}

export function contentTypeFor(path) {
	const dot = path.lastIndexOf('.');
	const extension = dot < 0 ? '' : path.slice(dot + 1).toLowerCase();
	return MIME[extension] || 'application/octet-stream';
}

/** Streams a file from disk. Returns false when it is not there. */
export function sendFile(path) {
	const file = std.open(path, 'rb');
	if (!file) return false;
	file.seek(0, std.SEEK_END);
	const size = file.tell();
	file.seek(0, std.SEEK_SET);
	const buffer = new ArrayBuffer(size);
	if (size > 0) file.read(buffer, 0, size);
	file.close();
	writeHead('200 OK', contentTypeFor(path), size);
	if (size > 0) std.out.write(buffer, 0, size);
	std.out.flush();
	return true;
}

/** Serves `path` from `root`, mapping a trailing slash to index.html. */
export function serveStatic(root, path) {
	if (path.indexOf('..') >= 0) return false;
	let file = root + path;
	if (path.endsWith('/')) file += 'index.html';
	return sendFile(file);
}
