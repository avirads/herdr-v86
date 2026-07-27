# PolicyCenter Go Extension Bridge Automation

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this skill as the runtime reference for every PolicyCenter workflow. The
Chrome extension and Go bridge are generic browser automation mechanisms;
PolicyCenter-specific knowledge remains in these domain skills.

## Setup

Put the packaged `bin` directory on `PATH`, then define:

```powershell
$env:BH_CLIENT = 'autobro-extension-client.exe'
$env:BH_ADMIN = 'autobro-extension-admin.exe'
```

Start and verify:

```powershell
& $env:BH_ADMIN start
& $env:BH_ADMIN doctor
& $env:BH_CLIENT health
& $env:BH_CLIENT currentTab
```

The extension must be loaded in Chrome and an HTTP/HTTPS PolicyCenter tab must
be open.

## Generic Commands

```powershell
& $env:BH_CLIENT goto $env:PC_URL
& $env:BH_CLIENT pageInfo
& $env:BH_CLIENT inventoryCurrentPage
& $env:BH_CLIENT extractGrids
& $env:BH_CLIENT visibleActions '["Search|Reset|Desktop|Account|Policy|Administration",240]'
& $env:BH_CLIENT waitForElement 'input[type=password]' 5 true
& $env:BH_CLIENT waitNetworkIdle 10 500
& $env:BH_CLIENT saveScreenshot
```

## Login

Use credentials supplied through the environment. Never store credentials in a
skill:

```powershell
& $env:BH_CLIENT waitForElement 'input[type=password]' 5 true
& $env:BH_CLIENT fillInput "input[name='Login-LoginScreen-LoginDV-username']" $env:PC_USERNAME
& $env:BH_CLIENT fillInput "input[name='Login-LoginScreen-LoginDV-password']" $env:PC_PASSWORD
& $env:BH_CLIENT --json '{"command":"pressKey","key":"Enter"}'
& $env:BH_CLIENT waitNetworkIdle 15 500
& $env:BH_CLIENT loginStatus
```

## Guidewire Click Pattern

Use `gwClick` with the exact visible Guidewire action ID:

```powershell
& $env:BH_CLIENT gwClick 'TabBar-DesktopTab-Desktop_Underwriter_MySummary'
& $env:BH_CLIENT waitNetworkIdle 15 500
& $env:BH_CLIENT pageInfo
& $env:BH_CLIENT inventoryCurrentPage
```

For native dialogs:

```powershell
& $env:BH_CLIENT pendingDialog
& $env:BH_CLIENT acceptDialog true
```

## Safe Navigation IDs

- Desktop summary: `TabBar-DesktopTab-Desktop_Underwriter_MySummary`
- Account search: `TabBar-SearchTab-Search_AccountSearch`
- Producer code search: `TabBar-SearchTab-Search_ProducerCodeSearch`
- Policy search: `TabBar-SearchTab-Search_PolicySearch`
- My submissions: `TabBar-DesktopTab-Desktop_DesktopSubmissions`
- Admin user search: `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminUserSearchPage`

Avoid mutating actions unless the user explicitly requests them:

```text
Update Save Add Remove New Create Edit Quote Bind Issue Cancel Close Withdraw Delete Deactivate Import Export
```
