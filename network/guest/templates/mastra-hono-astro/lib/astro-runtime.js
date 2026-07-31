const scriptsByFilename = new Map();

export const Fragment = Symbol('Astro.Fragment');

export function createMetadata(filename, metadata = {}) {
	scriptsByFilename.set(filename, metadata.hoisted || []);
	return { ...metadata, filename };
}

export function createAstro() {
	return {};
}

export function createComponent(factory, filename) {
	factory.__astro_component = true;
	factory.__astro_filename = filename;
	return factory;
}

export function render(strings, ...values) {
	return { strings, values, __astro_template: true };
}

async function stringify(value) {
	value = await value;
	if (value == null || value === false) return '';
	if (value?.__astro_html) return value.value;
	if (value?.__astro_template) {
		let output = '';
		for (let index = 0; index < value.strings.length; index += 1) {
			output += value.strings[index];
			if (index < value.values.length) output += await stringify(value.values[index]);
		}
		return output;
	}
	if (Array.isArray(value)) {
		let output = '';
		for (const entry of value) output += await stringify(entry);
		return output;
	}
	return escape(value);
}

export async function renderPage(Component) {
	const result = {
		createAstro(props, slots) {
			return { props, slots, params: {}, url: { href: 'http://vmbro.local/', pathname: '/' } };
		}
	};
	return `<!doctype html>${await stringify(await Component(result, {}, {}))}`;
}

export async function renderComponent(_result, _displayName, Component, props, slots = {}) {
	if (typeof Component === 'string') return '';
	return Component(_result, props || {}, slots);
}

export function renderHead() {
	return raw('');
}
export function maybeRenderHead() {
	return raw('');
}
export function unescapeHTML(value) {
	return raw(value == null ? '' : String(value));
}
export async function renderSlot(slots, name = 'default', fallback = '') {
	return slots?.[name] ? stringify(slots[name]) : stringify(fallback);
}
export function mergeSlots(...slots) {
	return Object.assign({}, ...slots);
}
export function addAttribute(value, name) {
	return value == null || value === false ? '' : value === true ? ` ${name}` : ` ${name}="${escape(value)}"`;
}
export function spreadAttributes(values = {}) {
	return Object.entries(values).map(([name, value]) => addAttribute(value, name)).join('');
}
export function defineStyleVars() {
	return '';
}
export function defineScriptVars() {
	return '';
}
export function renderTransition() {
	return '';
}
export function createTransitionScope() {
	return {};
}
export function renderScript(_result, id) {
	const filename = id.split('?')[0];
	const match = /(?:^|&)index=(\d+)/.exec(id.split('?')[1] || '');
	const index = Number(match?.[1] || 0);
	const script = scriptsByFilename.get(filename)?.[index];
	return raw(script?.value ? `<script>${script.value}</script>` : '');
}

function raw(value) {
	return { __astro_html: true, value };
}

function escape(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
