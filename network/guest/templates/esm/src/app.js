import { store } from './store.js';
import { html } from './html.js';
import { Counter } from './components/counter.js';

const count = store(0);

const app = document.getElementById('app');
app.append(
	html`
		<header>
			<h1>No build step</h1>
			<p>
				Plain ES modules, loaded straight from the guest filesystem. Edit a file, save, and the
				preview reloads.
			</p>
		</header>
	`,
	Counter(count)
);
