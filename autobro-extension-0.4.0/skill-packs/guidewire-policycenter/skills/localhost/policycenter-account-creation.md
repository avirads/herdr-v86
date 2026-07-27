# Guidewire PolicyCenter Account Creation

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for creating accounts in Guidewire PolicyCenter through the Go extension bridge.

## Rules

- Create the account through the PolicyCenter UI only.
- Do not use SOAP, REST, database writes, or backend APIs for the account creation step.
- If setup data such as a producer organization is missing, prefer creating or selecting it through the UI. If a prior run already created usable producer setup, it is acceptable to select it through the UI.
- Keep the active Chrome tab on the PolicyCenter workflow so the user can watch.

## Defaults

- Login: `su` / `gw`.
- Known producer setup that works in this local environment:
  - Organization: `Codex Test Agency 236200`
  - Producer code: `BH236200`
- Reliable test account data:
  - First name: `Codex`
  - Last name: generate a unique value such as `Test<timestamp suffix>`
  - Address 1: `100 Market St`
  - City: `San Francisco`
  - State: `CA`
  - ZIP: `94105`
  - Address Type: `home`
  - Email: `codex.test@example.com`
  - Nickname: `Codex Test Account`

## Go Bridge Commands

```powershell
& $env:BH_CLIENT gwClick 'Some-Guidewire-Widget-ID'
& $env:BH_CLIENT waitNetworkIdle 20 500
& $env:BH_CLIENT setSelect 'FIELD_NAME' 'value'
& $env:BH_CLIENT extractMessages
```

Always wait for network idle and inspect messages after a Guidewire click.

## Flow

1. Open or reuse PolicyCenter:


If the login page appears, fill username `su`, password `gw`, and submit.

2. Start a new account:


If the menu item is hidden under Account, first click/open the Account tab menu, then fire the same item ID.

3. Fill the Enter Account Information search page:

Use the Go client `fillInput` command for visible inputs. Typical input names:

- First name: `NewAccount-NewAccountScreen-NewAccountSearchDV-GlobalPersonNameInputSet-FirstName`
- Last name: `NewAccount-NewAccountScreen-NewAccountSearchDV-GlobalPersonNameInputSet-LastName`
- City: `NewAccount-NewAccountScreen-NewAccountSearchDV-AddressOwnerAddressInputSet-globalAddressContainer-GlobalAddressInputSet-City`
- ZIP: `NewAccount-NewAccountScreen-NewAccountSearchDV-AddressOwnerAddressInputSet-globalAddressContainer-GlobalAddressInputSet-PostalCode`

Set country/state selects with JavaScript and dispatch `change`:


Run search:


4. If no matching account appears, create a Person account:


5. Fill the Create account page:

Common input names:

- Address 1: `CreateAccount-CreateAccountScreen-CreateAccountDV-AddressInputSet-globalAddressContainer-GlobalAddressInputSet-AddressLine1`
- City: `CreateAccount-CreateAccountScreen-CreateAccountDV-AddressInputSet-globalAddressContainer-GlobalAddressInputSet-City`
- ZIP: `CreateAccount-CreateAccountScreen-CreateAccountDV-AddressInputSet-globalAddressContainer-GlobalAddressInputSet-PostalCode`
- Email: `CreateAccount-CreateAccountScreen-CreateAccountDV-CreateAccountContactInputSet-EmailAddress1`
- Nickname: `CreateAccount-CreateAccountScreen-CreateAccountDV-Nickname`

Set country/state/address type:


6. Select producer organization through the UI picker:


Search by producer code, because name-only searches can return no rows:


Select the first result:


Back on Create account, verify:


Expected producer is `Codex Test Agency 236200`; expected producer code contains `BH236200`.

7. Submit:

Normalize ZIP to `94105` if the UI mask changed it, then update:


8. Verify success from the account summary page:


Success shows `Account Summary: <name>` and an `Account No` value with no visible error messages.

## Troubleshooting

- `Organization : Missing required field "Organization"` means the picker result was not selected. Open the picker again and search by producer code `BH236200`, then select the row.
- If the producer organization field is populated but the old error remains, submit again. The old message can remain after selection until the next validation cycle.
- If `ProducerCode` select is empty after selecting the organization, the organization has no usable active producer code for the current user. Use Administration UI to inspect producer codes before creating the account.
- If direct clicks do nothing, use the Go client `gwClick` command with the exact action ID.
