/**
 * A ~20-line reactive store. No dependencies, no build step — the browser loads
 * these modules directly from the guest.
 */
export function store(initial) {
	let value = initial;
	const subscribers = new Set();

	return {
		get() {
			return value;
		},
		set(next) {
			if (next === value) return;
			value = next;
			for (const notify of subscribers) notify(value);
		},
		update(change) {
			this.set(change(value));
		},
		subscribe(notify) {
			subscribers.add(notify);
			notify(value);
			return () => subscribers.delete(notify);
		}
	};
}
