# Guidewire PolicyCenter Skill Pack

Optional domain skills for Guidewire PolicyCenter automation.

These files are intentionally outside `controller/skills/` so the core
web-bridge controller remains generic. Import this pack only when working
against a PolicyCenter instance.

From the controller page console:

```js
const base = '/skill-packs/guidewire-policycenter';
const index = await fetch(`${base}/index.json`).then(r => r.json());
for (const path of index) {
  const content = await fetch(`${base}/skills/${path}`).then(r => r.text());
  await sendToExtension({ command: 'skillsImport', path, content });
}
await sendToExtension({ command: 'skills', q: 'login session health', limit: 4, maxChars: 6000 });
```
