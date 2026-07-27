// In-browser port of the Go bridge's GET /skills (server.go:568-665).
// Skill markdown lives in OPFS under /domain-skills; the side panel imports
// files there. Search is the same token-containment scoring.

const SKILLS_DIR = 'domain-skills';

function tokenize(value) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 2);
}

function skillScore(haystack, query) {
  const lower = haystack.toLowerCase();
  return tokenize(query).reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
}

async function* walk(dir, prefix = '') {
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') yield* walk(handle, path);
    else if (name.toLowerCase().endsWith('.md')) yield { path, handle };
  }
}

async function skillsRoot(create = false) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(SKILLS_DIR, { create });
}

export async function importSkill(path, content) {
  const dir = await skillsRoot(true);
  const parts = path.split('/');
  let current = dir;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  const file = await current.getFileHandle(parts.at(-1), { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function loadSkills(query = '', limit = 4, maxChars = 6000) {
  let dir;
  try {
    dir = await skillsRoot();
  } catch {
    return []; // nothing imported yet — mirrors ErrNotExist tolerance in Go
  }
  const skills = [];
  for await (const { path, handle } of walk(dir)) {
    let content = await (await handle.getFile()).text();
    const score = skillScore(`${path}\n${content}`, query);
    if (query && score === 0) continue;
    if (maxChars >= 0 && content.length > maxChars) content = content.slice(0, maxChars);
    skills.push({ path: `${SKILLS_DIR}/${path}`, score, content });
  }
  skills.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return skills.slice(0, Math.max(0, limit));
}
