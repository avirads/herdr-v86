import { html } from '../html.js';

/** A component is a function that returns an element and wires its own events. */
export function Counter(count) {
	const view = html`
		<section class="card">
			<h2>Counter</h2>
			<p class="value" data-value>${count.get()}</p>
			<div class="row">
				<button data-dec type="button">−</button>
				<button data-inc type="button">+</button>
				<button data-reset type="button" class="ghost">Reset</button>
			</div>
		</section>
	`;

	const value = view.querySelector('[data-value]');
	count.subscribe((next) => {
		value.textContent = String(next);
	});

	view.querySelector('[data-inc]').addEventListener('click', () => count.update((n) => n + 1));
	view.querySelector('[data-dec]').addEventListener('click', () => count.update((n) => n - 1));
	view.querySelector('[data-reset]').addEventListener('click', () => count.set(0));

	return view;
}
