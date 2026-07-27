# Guidewire PolicyCenter Navigation And Forms

> Runtime: use the Go extension bridge via `BH_CLIENT=autobro-extension-client.exe` and `BH_ADMIN=autobro-extension-admin.exe`. Read `policycenter-extension-bridge.md` for command syntax and execute browser actions as `$env:BH_CLIENT <command> [args]`.

Use this for navigating Guidewire PolicyCenter, discovering forms, and submitting safe search/filter forms through the Go extension bridge.

## Rules

- Use the PolicyCenter UI only.
- Keep the active Chrome tab on the PolicyCenter workflow so the user can watch.
- Do not blindly submit every visible form. Classify each action first:
  - Safe: `Search`, `Reset`, dashboard filters, list filters.
  - Mutating: `Update`, `Save`, `Add`, `Remove`, `Bind`, `Issue`, `Close`, `Cancel`, admin create/edit actions.
- Submit mutating forms only when the user explicitly asks for that business operation or an existing local skill covers the full workflow.
- For account creation, read `policycenter-account-creation.md`.
- For new submission and policy issue, read `policycenter-submission-issue.md`.

## Browser Setup


If the login page appears, use `su` / `gw`.

## Guidewire Helpers

Guidewire controls often ignore plain DOM clicks.


After a click:


If `page_info()` returns a `dialog`, handle it intentionally:


## App Map

Top tabs and important routes:

- Desktop:
  - `TabBar-DesktopTab-Desktop_Underwriter_MySummary` - Summary
  - `TabBar-DesktopTab-Desktop_DesktopActivities` - My Activities
  - `TabBar-DesktopTab-Desktop_DesktopAccounts` - My Accounts
  - `TabBar-DesktopTab-Desktop_DesktopSubmissions` - My Submissions
  - `TabBar-DesktopTab-Desktop_DesktopRenewals` - My Renewals
  - `TabBar-DesktopTab-Desktop_DesktopOtherWorkOrders` - Other Policy Transactions
  - `TabBar-DesktopTab-Desktop_DesktopAssignableQueues` - My Queues
- Account:
  - `TabBar-AccountTab-AccountTab_NewAccount` - New Account
  - `TabBar-AccountTab-AccountTab_AccountNumberSearchItem` - account number quick search input
  - `TabBar-AccountTab-AccountTab_AccountNumberSearchItem_Button` - account quick search
- Policy:
  - `TabBar-PolicyTab-PolicyTab_NewSubmission` - New Submission
  - `TabBar-PolicyTab-PolicyTab_SubmissionNumberSearchItem` - submission quick search input
  - `TabBar-PolicyTab-PolicyTab_SubmissionNumberSearchItem_Button` - submission quick search
  - `TabBar-PolicyTab-PolicyTab_PolicyRetrievalItem` - policy number quick search input
  - `TabBar-PolicyTab-PolicyTab_PolicyRetrievalItem_Button` - policy quick search
- Contact:
  - `TabBar-ContactTab-NewContact-NewCompany` - New Company
  - `TabBar-ContactTab-NewContact-NewPerson` - New Person
  - `TabBar-ContactTab-Search` - Contact Search
- Search:
  - `TabBar-SearchTab-Search_PolicySearch` - Policies
  - `TabBar-SearchTab-Search_AccountSearch` - Accounts
  - `TabBar-SearchTab-Search_ProducerCodeSearch` - Producer Codes
  - `TabBar-SearchTab-Search_ActivitySearch` - Activities
  - `TabBar-SearchTab-Search_ContactSearch` - Contacts
- Team:
  - `TabBar-TeamTab` - Team page
- Administration:
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminUserSearchPage` - Users
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminGroupSearchPage` - Groups
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_Roles` - Roles
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_Regions` - Regions
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_OrganizationSearchPage` - Organizations
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_AdminProducerCodeSearch` - Producer Codes
  - `TabBar-AdminTab-Admin_UsersAndSecurity-UsersAndSecurity_UWAuthorityProfiles` - Authority Profiles
  - `TabBar-AdminTab-Admin_BusinessSettings-BusinessSettings_ActivityPatterns` - Activity Patterns
  - `TabBar-AdminTab-Admin_BusinessSettings-BusinessSettings_Holidays` - Holidays
  - `TabBar-AdminTab-Admin_BusinessSettings-BusinessSettings_BizRules-BizRules_UWRules` - Underwriting Rules
  - `TabBar-AdminTab-Admin_BusinessSettings-BusinessSettings_FormPatterns` - Policy Form Patterns
  - `TabBar-AdminTab-Admin_BusinessSettings-BusinessSettings_PolicyHolds` - Policy Holds
  - `TabBar-AdminTab-Admin_Monitoring-Monitoring_MessageSearch` - Messages
  - `TabBar-AdminTab-Admin_Monitoring-Monitoring_MessagingDestinationControlList` - Message Queues
  - `TabBar-AdminTab-Admin_Monitoring-Monitoring_WorkflowSearch` - Workflows
  - `TabBar-AdminTab-Admin_Monitoring-Monitoring_WorkflowStats` - Workflow Statistics
  - `TabBar-AdminTab-Admin_Utilities-Utilities_ImportWizard` - Import Data
  - `TabBar-AdminTab-Admin_Utilities-Utilities_ExportData` - Export Data
  - `TabBar-AdminTab-Admin_Utilities-Utilities_ScriptParametersPage` - Script Parameters
  - `TabBar-AdminTab-Admin_Utilities-Utilities_DataFlowMasks` - Spreadsheet Export Formats
  - `TabBar-AdminTab-Admin_Utilities-Utilities_DataChangePage` - Data Change
  - `TabBar-AdminTab-Admin_Utilities-Utilities_Properties` - Runtime Properties
  - `TabBar-AdminTab-Admin_Utilities-Utilities_InboundFileSearch` - Inbound Files
  - `TabBar-AdminTab-Admin_Utilities-Utilities_OutboundFileSearch` - Outbound Files

## Discover Current Page

Use this to inventory a page before interacting:


## Submit Safe Search Forms

For search pages, fill only the needed criteria, then click the visible Search action ending in `SearchAndResetInputSet-SearchLinksInputSet-Search`.

Generic search submit:


Useful known search fields:

- Search Policies:
  - Policy number: `PolicySearch-PolicySearchScreen-DatabasePolicySearchPanelSet-PolicySearchDV-PolicyNumberCriterion`
  - Account number: `PolicySearch-PolicySearchScreen-DatabasePolicySearchPanelSet-PolicySearchDV-AccountNumber`
  - First name: `PolicySearch-PolicySearchScreen-DatabasePolicySearchPanelSet-PolicySearchDV-GlobalPersonNameInputSet-FirstName`
  - Last name: `PolicySearch-PolicySearchScreen-DatabasePolicySearchPanelSet-PolicySearchDV-GlobalPersonNameInputSet-LastName`
- Search Accounts:
  - First name: names end with `GlobalPersonNameInputSet-FirstName`
  - Last name: names end with `GlobalPersonNameInputSet-LastName`
  - City: names end with `GlobalAddressInputSet-City`
  - ZIP: names end with `GlobalAddressInputSet-PostalCode`
- Search/Admin Producer Codes:
  - Producer code: names often end with `ProducerCode` or `ProducerCodeSearchDV-Code`
  - Status: names often end with `Status`
  - Branch code: names often end with `BranchCode`
- Search Contacts:
  - Company/person name fields follow `GlobalContactNameInputSet` or `GlobalPersonNameInputSet`.

If a required search criterion error appears, fill the smallest stable criterion such as account number, policy number, last name, producer code, or status.

## Fill Mandatory Fields

Guidewire does not expose a universal HTML `required` attribute. Detect mandatory fields from validation messages after an attempted save or from labels/classes around the input.

Preferred loop:

1. Inventory visible controls and current messages.
2. Fill obvious business data.
3. Click safe submit (`Search`) or explicit workflow submit (`Update`, `Quote`, `Issue`) only if the task calls for it.
4. Read validation messages.
5. Navigate to pages named in `Errors located on another page: ...`.
6. Fill only the named blockers.
7. Retry.

Validation extraction:


## Mutating Workflows

Use targeted skills for workflows that change data:

- New Account: `policycenter-account-creation.md`
- New Submission + Issue Policy: `policycenter-submission-issue.md`

For new mutating forms not covered by a skill:

- First navigate and inventory the page.
- Do not submit `Update`, `Save`, `Add`, `Remove`, `Bind`, `Issue`, or admin actions until the user asks for that exact operation.
- After successfully completing a repeatable workflow, create a new localhost domain skill with:
  - route ID
  - visible required fields
  - picker/search popup IDs
  - submit button ID
  - validation messages encountered
  - success verification text

## Quick Search

Use tab search widgets when the user gives a known identifier.




If the tab search input is hidden, first call `gwClick` with
`TabBar-AccountTab` or `TabBar-PolicyTab`, then call `fillInput`.

## Skill Creation Pattern

When the user asks to create a skill for a newly explored form:

1. Create a Markdown file under `agent-workspace/domain-skills/localhost/`.
2. Name it `policycenter-<workflow>.md`.
3. Include only UI steps and Go bridge client commands.
4. Include the `gw_click` helper.
5. Include success verification.
6. Keep backend/API/database shortcuts out of the skill.
