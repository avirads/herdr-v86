import {
  Fragment,
  render as $$render,
  createAstro as $$createAstro,
  createComponent as $$createComponent,
  renderComponent as $$renderComponent,
  renderHead as $$renderHead,
  maybeRenderHead as $$maybeRenderHead,
  unescapeHTML as $$unescapeHTML,
  renderSlot as $$renderSlot,
  mergeSlots as $$mergeSlots,
  addAttribute as $$addAttribute,
  spreadAttributes as $$spreadAttributes,
  defineStyleVars as $$defineStyleVars,
  defineScriptVars as $$defineScriptVars,
  renderTransition as $$renderTransition,
  createTransitionScope as $$createTransitionScope,
  renderScript as $$renderScript,
  createMetadata as $$createMetadata
} from "./astro-runtime.js";


export const $$metadata = $$createMetadata("/src/pages/index.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [{ type: 'inline', value: `
			const status = document.querySelector('#status');
			const progress = document.querySelector('#progress');
			const messages = document.querySelector('#messages');
			const form = document.querySelector('#chat-form');
			const prompt = document.querySelector('#prompt');
			const send = document.querySelector('#send');
			const modelFile = document.querySelector('#model-file');
			let client;
			let agent;
			let generating = false;
			const history = [];

			const addMessage = (role, text = '') => {
				const item = document.createElement('li');
				item.className = \`message \${role}\`;
				item.textContent = text;
				messages.append(item);
				item.scrollIntoView({ behavior: 'smooth', block: 'end' });
				return item;
			};

			const setReady = (modelName) => {
				status.textContent = 'Ready · Mastra';
				progress.textContent = \`\${modelName} is loaded locally. Prompts remain on this device.\`;
				send.disabled = false;
				prompt.focus();
			};

			const createAgent = async () => {
				if (agent) return agent;
				status.textContent = 'Loading Mastra…';
				const { Agent, createLiteRt } = await import('/vmmastra/agent/mastra-agent.js');
				agent = new Agent({
					id: 'weather-agent',
					name: 'Weather Agent',
					instructions: [
						'You are a concise weather and trip-planning assistant.',
						'You have no live weather service, so never invent current conditions, alerts, or forecasts.',
						'Give useful general guidance and ask the user to verify time-sensitive facts with an official weather service.'
					].join(' '),
					model: createLiteRt({ client })(client.modelName || 'gemma-4-e2b')
				});
				return agent;
			};

			const boot = async () => {
				if (!('gpu' in navigator)) throw new Error('WebGPU is unavailable. Use a current WebGPU-enabled browser.');
				const { LiteRtLmClient } = await import('/vmmastra/shared/litert-lm-client.js');
				client = new LiteRtLmClient();
				client.addEventListener('activity', (event) => {
					progress.textContent = event.detail?.message || 'Working…';
				});
				// Deployments may host the model at this conventional URL. If it
				// is absent, retain the portable file-picker + OPFS workflow.
				const bundledModelUrl = '/vmmastra/models/gemma-4-E2B-it-web.litertlm';
				const bundledModel = await fetch(bundledModelUrl, { method: 'HEAD' });
				const result = await client.initialize({
					bundledModelUrl: bundledModel.ok ? bundledModelUrl : ''
				});
				if (result.modelName) setReady(result.modelName);
				else {
					status.textContent = 'Choose a model';
					progress.textContent = 'Import the downloaded .litertlm file. It will be cached for later visits.';
				}
			};

			modelFile.addEventListener('change', async () => {
				const file = modelFile.files?.[0];
				if (!file) return;
				modelFile.disabled = true;
				status.textContent = 'Importing model…';
				try {
					await client.importModel(file);
					agent = undefined;
					setReady(client.modelName);
				} catch (error) {
					status.textContent = 'Model error';
					progress.textContent = error instanceof Error ? error.message : String(error);
				} finally {
					modelFile.disabled = false;
					modelFile.value = '';
				}
			});

			form.addEventListener('submit', async (event) => {
				event.preventDefault();
				if (generating || !client?.modelName) return;
				const text = prompt.value.trim();
				if (!text) return;
				addMessage('user', text);
				history.push({ role: 'user', content: text });
				const reply = addMessage('assistant');
				prompt.value = '';
				generating = true;
				send.disabled = true;
				status.textContent = 'Mastra is generating…';
				try {
					const weatherAgent = await createAgent();
					const result = await weatherAgent.stream(history);
					for await (const chunk of result.textStream) reply.textContent += chunk;
					const responseText = reply.textContent || 'No text was generated.';
					reply.textContent = responseText;
					history.push({ role: 'assistant', content: responseText });
					status.textContent = 'Ready · Mastra';
				} catch (error) {
					reply.textContent = error instanceof Error ? error.message : String(error);
					status.textContent = 'Generation error';
				} finally {
					generating = false;
					send.disabled = false;
					prompt.focus();
				}
			});

			boot().catch((error) => {
				status.textContent = 'Runtime unavailable';
				progress.textContent = error instanceof Error ? error.message : String(error);
			});
		` }] });

const $$Index = $$createComponent(async ($$result, $$props, $$slots) => {

const title = 'Mastra Weather Agent';


return $$render`<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${title}</title>
		<link rel="stylesheet" href="/styles.css">
	${$$renderHead($$result)}</head>
	<body>
		<main class="shell">
			<header>
				<div>
					<p class="eyebrow">ASTRO · HONO · VMM ASTRA · WEBGPU</p>
					<h1>${title}</h1>
					<p class="subtitle">Mastra streaming through Gemma 4 E2B, entirely in your browser.</p>
				</div>
				<span id="status" class="status">Starting LiteRT-LM…</span>
			</header>

			<section class="connection" aria-label="Local model">
				<div class="row">
					<div class="model">
						<strong>Gemma 4 E2B</strong>
						<small id="progress">Checking browser storage for a cached model…</small>
					</div>
					<label class="button secondary" for="model-file">Import .litertlm</label>
					<input id="model-file" class="sr-only" type="file" accept=".litertlm">
				</div>
				<p class="model-help">
					Model weights are not bundled.
					<a href="https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm?download=true">Download Gemma 4 E2B</a>,
					then import it once; LiteRT-LM caches it in OPFS.
				</p>
			</section>

			<ol id="messages" class="messages" aria-live="polite">
				<li class="message assistant">Import the Gemma model, then ask about weather or trip planning.</li>
			</ol>

			<form id="chat-form" class="composer">
				<label class="sr-only" for="prompt">Message</label>
				<input id="prompt" autocomplete="off" placeholder="How should I prepare for monsoon weather?" required>
				<button id="send" type="submit" disabled>Send</button>
			</form>
		</main>

		${$$renderScript($$result,"/src/pages/index.astro?astro&type=script&index=0&lang.ts")}
	</body>
</html>`;
}, '/src/pages/index.astro', undefined);
export default $$Index;
