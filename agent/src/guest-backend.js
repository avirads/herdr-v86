/**
 * Map a Deep Agents path onto a workspace-relative guest path.
 *
 * `workspace` is the real guest directory the virtual root stands for. Those
 * two name the same directory, so an agent that says `/root/project/greet.js`
 * and one that says `/greet.js` mean the same file — and the model says the
 * former, because that is the path every prompt in the system quotes at it.
 *
 * Without collapsing it, `/root/project/greet.js` became `root/project/greet.js`
 * and the write landed at `/root/project/root/project/greet.js`. The agent then
 * could not see the file it had just written, concluded the directory was
 * missing, ran `mkdir -p /root/project`, and wrote it again — a two-step loop
 * that ran until LangGraph's 60-step recursion limit cut it off. Ten identical
 * cycles, and every individual step was the right thing to do.
 */
function relativePath(path, workspace = '') {
  const value = String(path || '/').replace(/\\/g, '/');
  if (!value.startsWith('/')) throw new Error(`Deep Agents path must be absolute: ${value}`);
  const root = String(workspace || '').replace(/\/+$/, '');
  const collapsed = root && (value === root || value.startsWith(`${root}/`))
    ? value.slice(root.length) || '/'
    : value;
  const relative = collapsed.replace(/^\/+/, '') || '.';
  if (relative.split('/').includes('..')) throw new Error('path cannot contain ..');
  return relative;
}

function absolutePath(path) {
  const relative = String(path).replace(/\\/g, '/').replace(/^\.\/?/, '');
  return relative ? `/${relative}` : '/';
}

// BusyBox stat does not interpret the \t in the guest's `-c '%F\t%n\t%s'`, so
// it sends the two characters backslash-t rather than a tab. Splitting on a
// real tab left every field after the first undefined, which is why `ls` and
// `glob` returned entries with no path. Accept both forms.
const FIELD_SEPARATOR = /\\t|\t/;

function parseFileInfos(output) {
  return String(output).split('\n').filter(Boolean).map(line => {
    const [type, path, size] = line.split(FIELD_SEPARATOR);
    return { path: absolutePath(path), is_dir: type === 'directory', size: Number(size) || 0 };
  });
}

function mimeType(path) {
  const extension = path.split('.').pop()?.toLowerCase();
  return ({ js: 'text/javascript', ts: 'text/typescript', json: 'application/json', html: 'text/html', css: 'text/css', md: 'text/markdown', sh: 'text/x-shellscript', py: 'text/x-python', c: 'text/x-c', h: 'text/x-c' })[extension] || 'text/plain';
}

export class V86DeepAgentsBackend {
  constructor(guest, { approve = async () => false, onActivity = () => {} } = {}) {
    this.guest = guest;
    this.approve = approve;
    this.onActivity = onActivity;
    this.id = 'vm-guest';
  }

  async permitted(operation, detail) {
    this.onActivity({ backend: operation, detail, approval: true });
    return await this.approve(operation, detail);
  }

  /**
   * Path mapping, aware of which real directory the virtual root stands for.
   *
   * The workspace is read from the guest client rather than fixed here, so
   * `setWorkspace()` keeps working and the two stay in step by construction.
   */
  rel(path) { return relativePath(path, this.guest?.workspace); }

  async ls(path = '/') {
    try { return { files: parseFileInfos(await this.guest.list(this.rel(path))) }; }
    catch (error) { return { error: error.message }; }
  }

  async read(path, offset = 0, limit = 500) {
    try {
      const content = await this.guest.read(this.rel(path));
      return { content: content.split('\n').slice(offset, offset + limit).join('\n'), mimeType: mimeType(path) };
    } catch (error) { return { error: error.message }; }
  }

  async readRaw(path) {
    const result = await this.read(path, 0, Number.MAX_SAFE_INTEGER);
    if (result.error) return { error: result.error };
    const now = new Date().toISOString();
    return { data: { content: result.content, mimeType: result.mimeType, created_at: now, modified_at: now } };
  }

  async grep(pattern, path = '/', glob = null) {
    try {
      const output = await this.guest.grep(pattern, this.rel(path || '/'));
      let matches = output.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        return match ? { path: absolutePath(match[1]), line: Number(match[2]), text: match[3] } : null;
      }).filter(Boolean);
      if (glob) {
        const expression = new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.')}$$`);
        matches = matches.filter(match => expression.test(match.path.slice(1)) || expression.test(match.path.split('/').pop()));
      }
      return { matches };
    } catch (error) { return { error: error.message }; }
  }

  async glob(pattern, path = '/') {
    try { return { files: parseFileInfos(await this.guest.glob(pattern, this.rel(path))) }; }
    catch (error) { return { error: error.message }; }
  }

  async write(path, content) {
    if (!await this.permitted('write_file', { path, bytes: new TextEncoder().encode(content).byteLength })) return { error: 'Operation rejected by user.' };
    try { await this.guest.write(this.rel(path), content); return { path, filesUpdate: null }; }
    catch (error) { return { error: error.message }; }
  }

  async edit(path, oldString, newString, replaceAll = false) {
    if (!await this.permitted('edit_file', { path, replaceAll, oldPreview: oldString.slice(0, 160), newPreview: newString.slice(0, 160) })) return { error: 'Operation rejected by user.' };
    try {
      const current = await this.guest.read(this.rel(path));
      const occurrences = current.split(oldString).length - 1;
      if (!occurrences) return { error: `String not found in ${path}` };
      if (!replaceAll && occurrences > 1) return { error: `String occurs ${occurrences} times; set replace_all or provide more context.` };
      const updated = replaceAll ? current.split(oldString).join(newString) : current.replace(oldString, newString);
      await this.guest.write(this.rel(path), updated);
      return { path, occurrences: replaceAll ? occurrences : 1, filesUpdate: null };
    } catch (error) { return { error: error.message }; }
  }

  async delete(path) {
    if (!await this.permitted('delete_file', { path })) return { error: 'Operation rejected by user.' };
    try { await this.guest.delete(this.rel(path)); return { path }; }
    catch (error) { return { error: error.message }; }
  }

  async execute(command) {
    if (!await this.permitted('execute', { command })) return { output: 'Operation rejected by user.', exitCode: 126, truncated: false };
    try {
      const response = await this.guest.execute(command);
      const match = response.match(/^__V86AGENT_EXIT__(\d+)\n?/);
      const output = match ? response.slice(match[0].length) : response;
      return { output, exitCode: match ? Number(match[1]) : null, truncated: output.length >= 65536 };
    } catch (error) { return { output: error.message, exitCode: null, truncated: false }; }
  }
}
