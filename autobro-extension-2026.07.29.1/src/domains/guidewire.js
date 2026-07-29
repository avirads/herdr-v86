export const GUIDEWIRE_COMMANDS = new Set(['gwClick', 'gwOpenMenu']);

export function mainGwClick(id) {
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const visible = element => Boolean(element?.offsetWidth || element?.offsetHeight || element?.getClientRects().length);
  const query = String(id || '');
  const tokens = clean(query).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2);
  const exact = document.getElementById(query);
  const element = exact || [...document.querySelectorAll('[id], [data-gw-click], [role="button"], [role="menuitem"], button, a')]
    .map(candidate => {
      const root = candidate.id ? candidate : candidate.closest('[id]');
      if (!root?.id) return null;
      const target = root.querySelector?.('[data-gw-click]') || root;
      const text = clean(root.innerText || root.textContent || candidate.getAttribute('aria-label') || candidate.title || '');
      const dataGwClick = target.getAttribute?.('data-gw-click') || '';
      const haystack = `${root.id} ${text} ${root.className || ''} ${dataGwClick}`.toLowerCase();
      const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 4 : 0), 0);
      const actionScore = /gw-action|MenuItem|Button|TabBarLink|data-gw-click|fireEvent/i.test(`${root.className || ''} ${dataGwClick}`) ? 2 : 0;
      const visibleScore = visible(root) ? 1 : 0;
      const score = tokenScore + actionScore + visibleScore;
      return score ? { root, score, visible: visible(root) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || Number(b.visible) - Number(a.visible))[0]?.root;
  const target = element?.querySelector('[data-gw-click]') || element;
  if (!target) return { fired: false, reason: 'missing', id };
  if (globalThis.gwEvents?.abstractOnEvent) {
    globalThis.gwEvents.abstractOnEvent(target, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }), false);
    return { fired: true, mode: 'gwEvents', id: element.id, text: clean(element.innerText), resolvedFrom: exact ? 'id' : 'query' };
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return { fired: true, mode: 'dom', id: element.id, text: clean(element.innerText), resolvedFrom: exact ? 'id' : 'query' };
}

export function mainGwOpenMenu(id) {
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const root = document.getElementById(String(id || ''));
  if (!root) return { fired: false, reason: 'missing', id };
  const target = root.querySelector('[data-gw-click="toggleSubMenu"], .gw-action--expand-button')
    || root.querySelector('[class*="expand"]');
  if (!target) return { fired: false, reason: 'missing-expand-button', id: root.id, text: clean(root.innerText) };
  if (globalThis.gwEvents?.abstractOnEvent) {
    globalThis.gwEvents.abstractOnEvent(target, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }), false);
    return { fired: true, mode: 'gwEvents', id: root.id, text: clean(root.innerText), targetClass: String(target.className || '') };
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return { fired: true, mode: 'dom', id: root.id, text: clean(root.innerText), targetClass: String(target.className || '') };
}

export async function handleGuidewireCommand(message, { executeMain, tabId }) {
  switch (message.command) {
    case 'gwClick':
      return await executeMain(tabId, mainGwClick, message.args || []);
    case 'gwOpenMenu':
      return await executeMain(tabId, mainGwOpenMenu, message.args || []);
    default:
      return undefined;
  }
}
