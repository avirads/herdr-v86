# Guidewire PolicyCenter Producer Setup Discovery

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to discover producer organizations, producer codes, statuses, and availability through the PolicyCenter UI.

## Rules

- Search and inspect only.
- Do not create, edit, activate, deactivate, or delete producer setup unless the user explicitly asks.
- Prefer producer code search over name-only search.

## Known Local Producer

The local test setup that has worked:

- Organization: `Codex Test Agency 236200`
- Producer code: `BH236200`

## Open Producer Code Search


If the search tab menu is hidden, open `TabBar-SearchTab` first.

## Search


## Extract Results

Use `policycenter-table-grid-extraction.md` to read result rows. Record:

- producer code
- organization
- status
- branch code if visible
- row action IDs

## Verify For Account Creation

On Create Account, after selecting an organization, verify:

