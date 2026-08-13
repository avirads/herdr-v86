import * as std from 'std';
import Page from './page.js';
import { renderPage } from './astro-runtime.js';

const html = await renderPage(Page);
const file = std.open(`${scriptDir()}/../dist/index.html`, 'w');
if (!file) throw new Error('Could not open dist/index.html');
file.puts(html);
file.close();

function scriptDir() {
	const path = scriptArgs[0] || '';
	const slash = path.lastIndexOf('/');
	return slash <= 0 ? '.' : path.slice(0, slash);
}
