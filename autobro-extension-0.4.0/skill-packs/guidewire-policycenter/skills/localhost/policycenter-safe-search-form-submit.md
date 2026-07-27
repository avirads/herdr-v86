# Guidewire PolicyCenter Safe Search Form Submit

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this to fill and submit non-mutating PolicyCenter search or filter forms.

## Rules

- Submit only search, reset, filter, and lookup forms.
- Do not click `Update`, `Save`, `Add`, `Remove`, `Bind`, `Issue`, `Cancel`, `Withdraw`, or admin edit actions.
- If validation asks for more criteria, add the smallest stable criterion and retry.

## Find Search Button


## Submit


## Read Results

Use `policycenter-table-grid-extraction.md` after search. Also read visible messages:

