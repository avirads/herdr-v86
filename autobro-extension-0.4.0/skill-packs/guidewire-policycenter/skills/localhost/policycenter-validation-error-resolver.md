# Guidewire PolicyCenter Validation Error Resolver

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to read PolicyCenter validation messages, map them to pages and fields, fill blockers, and retry a requested workflow action.

## Rules

- Use only after the user requested the workflow action that produced the validation.
- Do not invent business values silently; use obvious test defaults only in local test workflows.
- If a validation points to a page not yet discovered, inventory that page before filling.

## Extract Messages


## Resolve Loop

1. Read visible messages.
2. Identify exact missing fields or referenced wizard pages.
3. Navigate to the referenced page using visible sidebar/wizard links.
4. Run `policycenter-generic-form-inventory.md`.
5. Fill only the missing blocker fields.
6. Retry the same requested action.
7. Stop if the next error requires a business decision.

## Common Local Test Defaults

- ZIP: `94105`
- State: `CA`
- Address type: `home`
- Email: `codex.test@example.com`
- Effective date: use the default UI date unless validation requires a change.

## Record

When a validation is resolved, add the message, field ID/name, value used, and retry action to the relevant workflow skill.
