'use strict';

// ── Element refs ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
	title: $('title'),
	frameworkBadge: $('framework-badge'),
	status: $('status'),
	btnBuild: $('btn-build'),
	btnRestart: $('btn-restart'),
	theme: $('theme'),
	refresh: $('refresh'),
	frameworkList: $('framework-list'),
	fileTree: $('file-tree'),
	tabs: $('tabs'),
	editorHost: $('editor-host'),
	editorFallback: $('editor-fallback'),
	editorTextarea: $('editor-textarea'),
	logOutput: $('log-output'),
	outputPane: $('output-pane'),
	consoleTab: $('console-tab'),
	terminalTab: $('terminal-tab'),
	embeddedTerminal: $('embedded-terminal'),
	preview: $('preview'),
	previewReload: $('preview-reload'),
	sidebarToggle: $('sidebar-toggle'),
	sidebar: $('sidebar'),
	sidebarBackdrop: $('sidebar-backdrop'),
	toast: $('toast'),
};

// ── Live VM terminal ────────────────────────────────────────────────────────
// The emulator remains owned by the parent page. This xterm is a second view
// over that same serial session, so opening it never starts or changes a VM.
const embeddedTerm = new Terminal({
	cursorBlink: true,
	convertEol: true,
	scrollOnUserInput: true,
	fontSize: 13,
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
	theme: {
		background: '#090c14',
		foreground: '#c9d1d9',
		cursor: '#fbbf24',
		cursorAccent: '#090c14',
		selectionBackground: '#8b5cf680',
	},
});
embeddedTerm.open(el.embeddedTerminal);
embeddedTerm.onData((data) => parent.postMessage({ type: 'vmvm-terminal-input', data }, location.origin));

function fitEmbeddedTerminal() {
	if (el.embeddedTerminal.hidden) return;
	const cellWidth = Math.max(6, embeddedTerm._core?._renderService?.dimensions?.css?.cell?.width || 8);
	const cellHeight = Math.max(12, embeddedTerm._core?._renderService?.dimensions?.css?.cell?.height || 17);
	const cols = Math.max(20, Math.floor((el.embeddedTerminal.clientWidth - 12) / cellWidth));
	const rows = Math.max(5, Math.floor((el.embeddedTerminal.clientHeight - 8) / cellHeight));
	if (cols !== embeddedTerm.cols || rows !== embeddedTerm.rows) embeddedTerm.resize(cols, rows);
}

function selectOutputView(view) {
	const terminal = view === 'terminal';
	el.logOutput.hidden = terminal;
	el.embeddedTerminal.hidden = !terminal;
	el.consoleTab.classList.toggle('active', !terminal);
	el.terminalTab.classList.toggle('active', terminal);
	el.consoleTab.setAttribute('aria-selected', String(!terminal));
	el.terminalTab.setAttribute('aria-selected', String(terminal));
	if (terminal) {
		fitEmbeddedTerminal();
		embeddedTerm.focus();
	}
}

el.consoleTab.addEventListener('click', () => selectOutputView('console'));
el.terminalTab.addEventListener('click', () => selectOutputView('terminal'));
new ResizeObserver(fitEmbeddedTerminal).observe(el.embeddedTerminal);
addEventListener('message', (event) => {
	if (event.origin !== location.origin || event.source !== parent) return;
	if (event.data?.type === 'vmvm-terminal-output' && event.data.data) {
		embeddedTerm.write(event.data.data, () => {
			embeddedTerm.scrollToBottom();
			if (!el.embeddedTerminal.hidden) embeddedTerm.focus();
		});
	}
});
parent.postMessage({ type: 'vmvm-terminal-ready' }, location.origin);
requestAnimationFrame(() => selectOutputView('terminal'));

let toastTimer = null;
function toast(message, bad = false) {
	el.toast.textContent = message;
	el.toast.hidden = false;
	el.toast.classList.toggle('bad', bad);
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (el.toast.hidden = true), 3200);
}

function setStatus(text, state = '') {
	el.status.textContent = text;
	el.status.className = 'status' + (state ? ' ' + state : '');
}

async function api(path, options = {}) {
	const response = await fetch('api' + path, options);
	if (response.status === 204) return null;
	const text = await response.text();
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		value = text;
	}
	if (!response.ok) throw new Error(typeof value === 'string' ? value : value.message || response.statusText);
	return value;
}

// ── State ────────────────────────────────────────────────────────────────────
let frameworks = [];
let currentFramework = null;
let tree = [];
let selectedPath = null;
const openTabs = new Map(); // path -> {path, content, saved, dirty}
let activeTab = null;
let editor = null; // Monaco editor
let editorMode = 'monaco';
let autoSaveTimer = null;

// ── Preview URL ──────────────────────────────────────────────────────────────
function previewUrl() {
	// When the page is reached through the /ide/ reverse proxy, the app is at
	// /preview/ on the same origin. Reached directly on the guest, it is the
	// separate :3100 app server.
	if (location.pathname === '/' || location.pathname === '') {
		return location.protocol + '//' + location.hostname + ':3100/';
	}
	return location.origin + '/preview/';
}

function reloadPreview() {
	// A cache-busting query makes a same-URL reload actually re-fetch the app
	// server, so the iframe always reflects the freshly built output.
	el.preview.src = previewUrl() + (previewUrl().includes('?') ? '&' : '?') + 't=' + Date.now();
}

// ── Frameworks ───────────────────────────────────────────────────────────────
async function loadFrameworks() {
	frameworks = await api('/frameworks');
	el.frameworkList.textContent = '';
	for (const fw of frameworks) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'framework';
		button.dataset.id = fw.id;
		button.innerHTML =
			'<span class="f-name"></span><span class="f-blurb"></span>';
		button.querySelector('.f-name').textContent = fw.label;
		button.querySelector('.f-blurb').textContent = fw.blurb;
		button.addEventListener('click', () => scaffold(fw));
		el.frameworkList.appendChild(button);
	}
	markActiveFramework();
}

function markActiveFramework() {
	for (const button of el.frameworkList.querySelectorAll('.framework')) {
		button.classList.toggle('active', button.dataset.id === currentFramework);
	}
	el.frameworkBadge.textContent = currentFramework || '—';
	const fw = frameworks.find((f) => f.id === currentFramework);
	el.title.textContent = fw ? fw.label : 'Project';
}

// ── File tree ────────────────────────────────────────────────────────────────
async function listDir(path) {
	return api('/fs/list?path=' + encodeURIComponent(path || ''));
}

async function buildTree() {
	tree = [];
	el.fileTree.textContent = '';
	const rootNode = makeRow('', { type: 'dir', name: '' }, true);
	el.fileTree.appendChild(rootNode);
	await toggleDir(rootNode, rootNode.querySelector('.tree-row'));
}

// makeRow builds a node: a row div plus (for directories) a lazy child container.
function makeRow(base, entry, isRoot) {
	const path = base ? base + '/' + entry.name : entry.name;
	const node = document.createElement('div');
	node.className = 'tree-node';

	const row = document.createElement('div');
	row.className = 'tree-row' + (entry.type === 'dir' ? ' dir' : '');
	row.dataset.path = path;
	row.dataset.type = entry.type;

	const twist = document.createElement('span');
	twist.className = 'twist';
	const icon = document.createElement('span');
	icon.className = 'icon';
	if (entry.type === 'dir') {
		twist.textContent = '▸';
		icon.textContent = '▸';
	} else {
		twist.textContent = '';
		icon.textContent = fileIcon(entry.name);
	}
	const label = document.createElement('span');
	label.className = 'label';
	label.textContent = isRoot ? 'project' : entry.name;
	label.title = path;

	row.append(twist, icon, label);
	node.appendChild(row);

	let children = null;
	if (entry.type === 'dir') {
		children = document.createElement('div');
		children.className = 'tree-children';
		node.appendChild(children);
		row.addEventListener('click', () => toggleDir(node, row));
	} else {
		row.addEventListener('click', () => openFile(path, row));
	}
	return node;
}

async function toggleDir(node, row) {
	const children = node.querySelector('.tree-children');
	const twist = row.querySelector('.twist');
	if (!children) return;
	if (row.classList.contains('open')) {
		row.classList.remove('open');
		twist.textContent = '▸';
		children.textContent = '';
		return;
	}
	row.classList.add('open');
	twist.textContent = '▾';
	children.textContent = '';
	const path = row.dataset.path;
	const entries = await listDir(path);
	for (const child of entries) {
		children.appendChild(makeRow(path, child, false));
	}
	if (!entries.length) {
		const empty = document.createElement('p');
		empty.className = 'muted';
		empty.textContent = 'empty';
		children.appendChild(empty);
	}
}

function fileIcon(name) {
	const ext = (name.split('.').pop() || '').toLowerCase();
	if (['js', 'mjs', 'cjs'].includes(ext)) return '📄';
	if (['ts', 'tsx', 'mts'].includes(ext)) return '🟦';
	if (['css', 'scss', 'less'].includes(ext)) return '🎨';
	if (['html', 'htm'].includes(ext)) return '🌐';
	if (['json'].includes(ext)) return '{}';
	if (['md'].includes(ext)) return '📝';
	if (name === 'server.js') return '🖥️';
	return '📄';
}

// ── Editor ───────────────────────────────────────────────────────────────────
const LANGUAGE_BY_EXT = {
	svelte: 'html',
	vue: 'html',
	html: 'html',
	htm: 'html',
	ts: 'typescript',
	tsx: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	css: 'css',
	scss: 'scss',
	less: 'less',
	json: 'json',
	md: 'markdown',
	markdown: 'markdown',
	yaml: 'yaml',
	yml: 'yaml',
	xml: 'xml',
	svg: 'xml',
};
function languageFor(path) {
	const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
	return LANGUAGE_BY_EXT[ext] || 'plaintext';
}

function loadMonaco() {
	return new Promise((resolve) => {
		if (window.monaco) return resolve(window.monaco);
		const style = document.createElement('link');
		style.rel = 'stylesheet';
		style.href =
			'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/editor/editor.main.min.css';
		document.head.appendChild(style);
		const loader = document.createElement('script');
		loader.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
		loader.onload = () => {
			window.require.config({
				paths: {
					vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs',
				},
			});
			window.require(['vs/editor/editor.main'], () => resolve(window.monaco));
		};
		loader.onerror = () => resolve(null);
		document.head.appendChild(loader);
		setTimeout(() => resolve(window.monaco || null), 15000);
	});
}

async function initEditor() {
	const monaco = await loadMonaco();
	if (!monaco) {
		editorMode = 'textarea';
		el.editorHost.hidden = true;
		el.editorFallback.hidden = false;
		return;
	}
	editorMode = 'monaco';
	monaco.editor.defineTheme('vmvm-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [],
		colors: {
			'editor.background': '#0d1322',
			'editor.foreground': '#e8edf7',
			'editorCursor.foreground': '#8b5cf6',
			'editor.lineHighlightBackground': '#ffffff0a',
			'editor.selectionBackground': '#8b5cf64d',
			'editorLineNumber.foreground': '#5d6b85',
			'editorLineNumber.activeForeground': '#b8c5dc',
			'editorIndentGuide.background1': '#ffffff0d',
			'editorWidget.background': '#131a2c',
			'editorWidget.border': '#253050',
			'editorGutter.background': '#0d1322',
		},
	});
	monaco.editor.defineTheme('vmvm-light', {
		base: 'vs',
		inherit: true,
		rules: [],
		colors: {
			'editor.background': '#ffffff',
			'editor.foreground': '#18202f',
			'editorCursor.foreground': '#7c3aed',
			'editor.lineHighlightBackground': '#18202f0d',
			'editor.selectionBackground': '#7c3aed26',
			'editorLineNumber.foreground': '#93a0b8',
			'editorLineNumber.activeForeground': '#4b5568',
			'editorIndentGuide.background1': '#18202f14',
			'editorWidget.background': '#ffffff',
			'editorWidget.border': '#d3dbe8',
			'editorGutter.background': '#ffffff',
		},
	});
	editor = monaco.editor.create(el.editorHost, {
		theme: document.documentElement.dataset.theme === 'light' ? 'vmvm-light' : 'vmvm-dark',
		automaticLayout: true,
		fontSize: 13,
		minimap: { enabled: false },
		scrollBeyondLastLine: false,
		tabSize: 2,
		wordWrap: 'on',
	});
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveActive);
	editor.onDidChangeModelContent(() => {
		if (!activeTab) return;
		const tab = openTabs.get(activeTab);
		if (!tab) return;
		tab.content = editor.getValue();
		tab.dirty = tab.content !== tab.saved;
		renderTabs();
		clearTimeout(autoSaveTimer);
		const path = activeTab;
		autoSaveTimer = setTimeout(() => {
			if (activeTab === path && openTabs.get(path)?.dirty) saveActive();
		}, 700);
	});
}

function renderTabs() {
	el.tabs.textContent = '';
	for (const tab of openTabs.values()) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'tab' + (tab.path === activeTab ? ' active' : '');
		button.title = tab.path;
		if (tab.dirty) {
			const dot = document.createElement('span');
			dot.className = 'tab-dot';
			button.appendChild(dot);
		}
		const label = document.createElement('span');
		label.textContent = basename(tab.path);
		button.appendChild(label);
		const close = document.createElement('button');
		close.type = 'button';
		close.className = 'tab-close';
		close.textContent = '×';
		close.title = 'Close';
		close.addEventListener('click', (event) => {
			event.stopPropagation();
			closeTab(tab.path);
		});
		button.appendChild(close);
		button.addEventListener('click', () => selectTab(tab.path));
		el.tabs.appendChild(button);
	}
}

function basename(path) {
	return path.split('/').pop() || path;
}

async function openFile(path, row) {
	let tab = openTabs.get(path);
	if (!tab) {
		let content;
		try {
			content = await api('/fs/read?path=' + encodeURIComponent(path));
		} catch (error) {
			toast(error.message, true);
			return;
		}
		tab = { path, content, saved: content, dirty: false };
		openTabs.set(path, tab);
	}
	selectTab(path);
	highlightRow(path, row);
	if (window.innerWidth <= 900) toggleSidebar(false);
}

function selectTab(path) {
	activeTab = path;
	renderTabs();
	const tab = openTabs.get(path);
	if (!tab) return;
	if (editorMode === 'monaco' && editor) {
		const uri = window.monaco.Uri.file(path);
		const model =
			window.monaco.editor.getModel(uri) ||
			window.monaco.editor.createModel(tab.content, languageFor(path), uri);
		editor.setModel(model);
	} else {
		el.editorTextarea.value = tab.content;
		el.editorTextarea.oninput = () => {
			tab.content = el.editorTextarea.value;
			tab.dirty = tab.content !== tab.saved;
			renderTabs();
		};
	}
	highlightRow(path);
}

function closeTab(path) {
	openTabs.delete(path);
	if (window.monaco) window.monaco.editor.getModel(window.monaco.Uri.file(path))?.dispose();
	if (activeTab === path) {
		activeTab = openTabs.size ? openTabs.keys().next().value : null;
		if (activeTab) selectTab(activeTab);
		else if (editorMode === 'monaco' && editor) editor.setModel(null);
		else el.editorTextarea.value = '';
	}
	renderTabs();
}

function highlightRow(path, explicit) {
	selectedPath = path;
	el.fileTree.querySelectorAll('.tree-row.selected').forEach((r) => r.classList.remove('selected'));
	if (explicit) explicit.classList.add('selected');
	else {
		const row = el.fileTree.querySelector(`.tree-row[data-path="${CSS.escape(path)}"]`);
		row?.classList.add('selected');
	}
}

function currentContent() {
	if (editorMode === 'monaco' && editor) return editor.getValue();
	return el.editorTextarea.value;
}

async function saveActive() {
	clearTimeout(autoSaveTimer);
	if (!activeTab) return;
	const tab = openTabs.get(activeTab);
	if (!tab) return;
	const content = currentContent();
	tab.content = content;
	tab.saved = content;
	tab.dirty = false;
	renderTabs();
	try {
		await api('/fs/write', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: tab.path, content }),
		});
		toast('Saved ' + tab.path);
	} catch (error) {
		toast(error.message, true);
	}
}

// ── Project actions ──────────────────────────────────────────────────────────
async function scaffold(fw) {
	if (currentFramework === fw.id) return;
	const confirmed = confirm(
		`Create a new ${fw.label} project? This replaces the current workspace files.`
	);
	if (!confirmed) return;
	setStatus('Scaffolding ' + fw.label + '…');
	try {
		const result = await api('/project/scaffold', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ framework: fw.id }),
		});
		currentFramework = result.framework;
		markActiveFramework();
		closeAllTabs();
		await buildTree();
		await refreshLogs();
		openDefaultFile();
		reloadPreview();
		setStatus('Ready — ' + currentFramework, 'ok');
		toast('Scaffolded ' + fw.label);
	} catch (error) {
		setStatus('Scaffold failed', 'bad');
		toast(error.message, true);
	}
}

function closeAllTabs() {
	for (const path of [...openTabs.keys()]) closeTab(path);
}

function openDefaultFile() {
	const fw = frameworks.find((f) => f.id === currentFramework);
	if (!fw || !fw.defaultFile) return;
	const row = el.fileTree.querySelector(`.tree-row[data-path="${CSS.escape(fw.defaultFile)}"]`);
	openFile(fw.defaultFile, row);
}

async function runAction(name, endpoint, doneMessage) {
	setStatus(name + '…');
	el.btnBuild.disabled = true;
	el.btnRestart.disabled = true;
	try {
		await api('/project/' + endpoint, { method: 'POST' });
		await refreshLogs();
		reloadPreview();
		setStatus(doneMessage, 'ok');
	} catch (error) {
		setStatus(name + ' failed', 'bad');
		toast(error.message, true);
	} finally {
		el.btnBuild.disabled = false;
		el.btnRestart.disabled = false;
	}
}

async function refreshLogs() {
	try {
		const status = await api('/project/status');
		el.logOutput.textContent = (status.logTail || []).join('\n') || 'No output yet.';
	} catch {
		/* keep last output */
	}
}

// ── Live reload (SSE) ────────────────────────────────────────────────────────
// The supervisor broadcasts a "reload" event after it detects a workspace edit
// and (for frameworks with a build step) finishes rebuilding. The preview and
// console then refresh automatically, no manual Build needed.
let eventsSource = null;

function connectEvents() {
	if (eventsSource || typeof EventSource === 'undefined') return;
	eventsSource = new EventSource('api/events');
	eventsSource.onopen = () => setStatus('watching for changes', 'ok');
	eventsSource.addEventListener('ready', () => setStatus('watching for changes', 'ok'));
	eventsSource.addEventListener('reload', async () => {
		setStatus('change detected — reloading preview…');
		await refreshLogs();
		reloadPreview();
		setStatus('preview updated', 'ok');
	});
	eventsSource.onerror = () => {
		if (eventsSource && eventsSource.readyState !== EventSource.CONNECTING) {
			setStatus('live reload reconnecting…');
			eventsSource.close();
			eventsSource = null;
			setTimeout(connectEvents, 3000);
		}
	};
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
	reloadPreview();
	try {
		await loadFrameworks();
	} catch (error) {
		setStatus('API unreachable', 'bad');
		toast(error.message, true);
		return;
	}
	try {
		const status = await api('/project/status');
		currentFramework = status.framework;
		markActiveFramework();
		await refreshLogs();
		setStatus(status.running ? 'server running' : 'server stopped', status.running ? 'ok' : '');
	} catch {
		setStatus('status unavailable');
	}
	await buildTree();
	await initEditor();
	openDefaultFile();
	connectEvents();
}

function toggleSidebar(open) {
	document.body.classList.toggle('sidebar-open', open);
	el.sidebarToggle.setAttribute('aria-expanded', String(open));
	el.sidebarBackdrop.hidden = !open;
}

el.sidebarToggle.addEventListener('click', () => {
	toggleSidebar(!document.body.classList.contains('sidebar-open'));
});
el.sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

el.btnBuild.addEventListener('click', async () => {
	await saveActive();
	runAction('Building', 'build', 'Build complete');
});
el.btnRestart.addEventListener('click', () => runAction('Restarting', 'restart', 'Server restarted'));
el.previewReload.addEventListener('click', reloadPreview);
el.theme.addEventListener('click', () => {
	const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
	document.documentElement.dataset.theme = next;
	localStorage.setItem('dev.theme', next);
	if (editor) {
		editor.updateOptions({ theme: next === 'light' ? 'vmvm-light' : 'vmvm-dark' });
	}
});
el.refresh.addEventListener('click', () => location.reload());
window.addEventListener('keydown', (event) => {
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
		event.preventDefault();
		saveActive();
	}
});
// Live reload of the preview after edits: rebuild on save when the build is quick.
el.editorTextarea.addEventListener('blur', () => {
	if (activeTab) {
		const tab = openTabs.get(activeTab);
		if (tab && tab.dirty) saveActive();
	}
});

boot();
