import { installWebGlobals } from '../lib/web.js';
import { Hono } from '../lib/hono.js';

installWebGlobals();

const app = new Hono();

app.get('/api/health', (c) =>
	c.json({
		ok: true,
		frontend: 'Astro (WASM compiler)',
		api: 'Hono',
		agent: 'Mastra browser runtime',
		inference: 'LiteRT-LM on browser WebGPU'
	})
);

app.get('/api/model-config', (c) =>
	c.json({
		model: 'gemma-4-e2b',
		runtime: 'LiteRT-LM + WebGPU',
		framework: '@mastra/core',
		mode: 'local'
	})
);

export default app;
