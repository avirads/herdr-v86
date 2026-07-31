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
			const output = document.querySelector('#output');
			document.querySelector('#hello').addEventListener('click', async () => {
				const response = await fetch('/api/hello');
				output.textContent = JSON.stringify(await response.json(), null, 2);
			});
		` }] });

const $$Astro = $$createAstro();
const Astro = $$Astro;
const $$Index = $$createComponent(async ($$result, $$props, $$slots) => {
const Astro = $$result.createAstro($$props, $$slots);
Astro.self = $$Index;

const title = 'Astro + Hono';


return $$render`<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width">
		<title>${title}</title>
		<link rel="stylesheet" href="/styles.css">
	${$$renderHead($$result)}</head>
	<body>
		<main>
			<p class="eyebrow">ASTRO FRONTEND · HONO API</p>
			<h1>${title}</h1>
			<p>Static Astro output in front, Hono routes behind native Chi.</p>
			<button id="hello">Call the API</button>
			<pre id="output">Ready.</pre>
		</main>
		${$$renderScript($$result,"/src/pages/index.astro?astro&type=script&index=0&lang.ts")}
	</body>
</html>`;
}, '/src/pages/index.astro', undefined);
export default $$Index;
