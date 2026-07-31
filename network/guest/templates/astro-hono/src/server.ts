import { installWebGlobals } from '../lib/web.js';
import { Hono } from '../lib/hono.js';

installWebGlobals();

const app = new Hono();

app.get('/api/hello', (c) =>
	c.json({
		message: 'Hello from Hono',
		frontend: 'Astro',
		runtime: 'QuickJS behind native Chi'
	})
);

app.post('/api/echo', async (c) => c.json({ youSent: await c.req.text() }, 201));

export default app;
