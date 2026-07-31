/**
 * Tagged-template markup: interpolations are escaped, so values cannot inject
 * HTML. Returns the first element of the parsed fragment.
 */
export function html(strings, ...values) {
	const markup = strings.reduce(
		(out, part, index) => out + part + (index < values.length ? escape(values[index]) : ''),
		''
	);
	const template = document.createElement('template');
	template.innerHTML = markup.trim();
	return template.content.firstElementChild;
}

function escape(value) {
	return String(value).replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
	);
}
