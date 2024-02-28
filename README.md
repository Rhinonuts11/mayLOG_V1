This repository holds maylog V1. The README is the (at the time) documentation for mayLOG. Some elements of the bot have been removed.
You are free to mess around with the project as you wish lol. Just follow the license guidelines.






---------------



mayLOG was created by DevAX1T after depFLOW was confirmed to be taken offline. Below you'll find detailed information on stuff. All content is subject to change.

## Why use mayLOG?
mayLOG has a variety of features, with the most notable of such being action logs. mayLOG supports using a `Roblox username`, `#userId`, `@Mention` or `Discord UserId` when a username is requested.

:::spoiler Benefits for Noah's Remade
mayLOG is developer supported, meaning that departments that utilize mayLOG have access to unique features, such as activity logs.
:::

## How do I get access?
mayLOG is available for public use but will be capped when a limit of 90 guilds is met; following this, the bot will go back into invite-only mode. Access may be requested during this time.
- Servers from Noah's Remade have priority over other servers.

Servers may be removed if any of the following conditions are met:
- A developer believes your server is a "test" server;
- The bot is no longer being used;
    - A command has not been run in the last 7 days;
    - A command has never been ran in the server.
- The server is not related to Mayflower;
- The server has less than 15 members;
- Any other reason a developer deems suitable;

## Usage Guidelines
- All guilds that use mayLOG must have RoVer present in the server. No other forms of Roblox verification bots are allowed.
    - Attempting to bypass this rule will result in a permanent server blacklist.
- mayLOG must be actively used to avoid servers that attempt to "save" the bot for later use.
    - Refer to "How do I get access?"
- All servers that utilize mayLOG must have a server icon; it cannot be the default server "icon" where the server initials show up in the server list.
- Reasonable measures must be taken to prevent the bot from being abused.
    - If an individual purposely utilizes the bot to cause errors, crash it, etc., the server must take action against the user or face a potential blacklist.
- mayLOG can be removed at the discretion of a developer.


---
## Configuration

Configuration is required to use mayLOG. Below you will find all configurable options with an explanation of their mechanics and such. The commands below (officially reffered to as "subcommands") utilize the primary `/config` command unless otherwise noted.

### General Mechanics
This is a section dedicated to general mechanics of mayLOG.

#### Timestamps
Dates use ISO 8601 format, e.g. `2023-06-20T23:08:20.000Z` or `2023-06-20` and are converted to UTC time before being displayed. For `YYYY-MM-DD`, this typically sets the hour used. If you would like to be specific, you can use  a website such as [timestamp-converter.com](https://www.timestamp-converter.com/) for dates.

### Department Role

Servers are requested to use the `/config set-department-role` command; This ensures that only department members can access the command.

### Command roles

There are two notable subcommands:
- `set-command-roles`
    - This command is used to configure which roles can utilize mayLOG, most notably the `/deptaction` command.
- `set-deptcommand-roles`
    - This command is used to configure which roles can run some configuration commands. This role has the ability to set activity quotas and exempt units.

If we used the Mayflower State Police as an example, it would be recommended to register the ranks from Sergeant - Colonel as "command" roles and the ranks from Lieutenant - Colonel as "department command" roles. This will allow for bureau command to modify the quota for their bureau.


### Discharges
Discharges have two configuration options:
- Discharge
- Termination

For an agency like the National Guard, it makes sense to refer to terminations as "discharges" (e.g. general discharge, preliminary discharge, dishonorable discharge, etc.), but for some law enforcement agencies and private businesses, it makes more sense to refer to terminations as "terminations." For this reason, there is a way to configure what the log message will look like when using the `/deptaction discharge` command.

The command found below can configure which type the bot will use:
![](https://hackmd.io/_uploads/rk7psjwD2.png)

**With `discharge-display` being set to "discharge," the following log messages will be shown:**
![](https://hackmd.io/_uploads/Byym0sPv2.png)

![](https://hackmd.io/_uploads/rkffAjvwn.png)

![](https://hackmd.io/_uploads/Hy7l0oDvh.png)

![](https://hackmd.io/_uploads/BJsp6svDh.png)


**With `discharge-display` being set to "terminate," the following messages will be shown:**
![](https://hackmd.io/_uploads/S1zURjwvh.png)

![](https://hackmd.io/_uploads/rkvPAiwDh.png)

All other discharge types are unsupported and you'll receive an error if you try to use them.


![](https://hackmd.io/_uploads/r1Jz5sDwh.png)

---
![](https://hackmd.io/_uploads/ByHitovv2.png)

![](https://hackmd.io/_uploads/SJ-0YjDD3.png)









![](https://hackmd.io/_uploads/BkUqcovP2.png)

![](https://hackmd.io/_uploads/Byy05svw3.png)

---

### Administrative Leave
Different departments utilize mayLOG, and as such, each department has different needs.

![](https://hackmd.io/_uploads/HkNEl2wvn.png)
Contact text for administrative leave messages can be changed to one of the four options:
- Contact IA Command and High Command if seen on-team.
- Contact Department Command if seen on-team.
- Contact Human Resources and Department Command if seen on-team.
- Contact MP and MIS if seen on-team.

This can be done with `/config al-contact-message`.

To satisfy legal requirements of informing a subject after they're placed on Administrative Leave (because you can't send a message without a ping in a channel and expect them to see it), mayLOG automatically sends a direct message to anyone placed on Administrative Leave. As all departments are different, this message can be fully customized.

**attach screenshot with the INVESTIGATOR field changed**
Using the `/config al-dm-message` command, departments can configure:
- What message is sent to the user;
- If the individual who placed the subject on Administrative Leave shows up in the administrative leave direct message embed.

![](https://hackmd.io/_uploads/ryyySn2Ph.png)

This message is sent to everyone placed on administrative leave
![](https://hackmd.io/_uploads/ByG6Vn2D3.png)



---

### Channels
Departments must configure their channels appropriately; whether this be the department logs channel, the LOA Request channel, or the activity logs submission channel.

**todo: provide examples when added**


---

### Activity Quotas
Departments may set quotas for specific units, divisions, bureaus, etc. The `/quota` command can be used to alter patrol quotas for all units. To exclude a user (or rank) from the activity quota, simply create a "Log Exemption" role and use the `/quota` command to exempt the role from the quota.

mayLOG can determine who's in-game and who's on-team at the same time; this feature can be integrated with quotas to remove the need for manual activity log submission (although the option will still be available). As servers can crash and unexpected issues can arise, it's recommended to have both options enabled.

The feature can be enabled using the `/config bot-verified-logs` command. There are prohibitions for usage:
- The department must have an in-game team used to conduct operations (e.g. Mayflower National Guard, Transit Authority, Mayflower State Police, etc)
    - Departments with in-game teams with no in-game activity requirements such as "State Government", "Department of State", "Department of Justice", etc. are forbidden from enabling this feature.
    - All private businesses are not allowed to enable this feature.
    - In the future, private businesses may be allowed to utilize this command, although it will only check if someone is on the "Citizen" team and nothing else. This purely depends on demand.


#### Configuring cycles
Activity cycles are a period of time which mayLOG collects log for. An example is Sunday to Saturday. Configuring an activity cycle could be difficult if the user doesn't understand the setup command.

The `/cycle` command requests a `start_date` and `end_date`. In these examples, the patrol cycle will be Sunday to Saturday. There are two ways to set a cycle, although the second option is recommended instead of the first.

It may seem like you're only setting one cycle, but in reality, the bot measures the distance between both dates and goes on from that point. If you set the start_date to 2023-06-01 and the end_date to 2023-06-02, a new cycle would be started every day from that point on.

`2023-06-11` - `2023-06-18`
- The bot would register the activity cycle as already being started; this could potentially be unfair to current department members and is unrecommended.

`2023-06-18` - `2023-06-25`
- The bot would start the cycle on June 18, 2023 (Sunday) and it would would end on June 25, 2023 (Sunday). This cycle would continue until changed, meaning the next cycle would start on June 25, 2023 (Sunday) and end on June 2, 2023 (Sunday).

Reference:
![](https://hackmd.io/_uploads/BkwOGXYP2.png)



#### Setting a quota
Department command may set a quota utilizing the `/quota` command.

todo: go into detail about how u can give Log Exemption role an exemption, etc










---
### Embed Colors
Embeds have many colors; using the custom color command, you can get a color (or use `#hex/#ff000`):
`mayLOG`
`red`
`pink`
`maroon`
`coral`
`blue`
`dodgerBlue`
`lightBlue`
`steelBlue` (Primary dark-blue color used by mayLOG; e.g. `/deptaction transfer`)
`deepOrange`
`green`
`limeGreen`
`darkAqua`
`lightGreen`
`darkGreen`
`black`
`white`
`orange`
`gold`
`metallicGold`
`darkGrey`
`grey`
`lightBlack`
`yellow`
`blurple`

### Update History

:::spoiler View update log

#### Version 1.9.0 [####-##-##]
Commands:
- The department action command is now significantly faster and more optimized. (completely re-written)
- The department action command has better names for subcommands and better descriptions for arguments
- The department action command has recieved a new subcommand: `/deptaction remove_probation`
- Department action commands (suspend/probation/loa) now use text instead of timestamps
- Using the administrative leave subcommand will now notify you 100% of the time if the subject hsa been sent a DM or not.
- Sent logs should no longer duplicate
- The Activity logs section has been completely rewritten;
 - The /check command now works as expected

#### Version 1.8.0 [2023-07-14]
<!-- Leave of Absence: -->
- 

Commands:
- Added activity logs (strictly for usage in Noah's Remade). This is an experimental feature and it may be unstable. At the moment, only select departments will get access to this feature. Please refer to the "Activity Quotas" section for more information.
- Added action requests; command members can request that one of the following actions be taken against an employee
    - Recorded warning
    - Verbal warning
    - Discharge
    - Suspension
<!-- - Added LOA Requests
    - Employees can use the `/reqloa` command to request a LOA. Command members can approve the LOA, and if auto role is enabled, the member will automatically be given the LOA role.
    - todo: Change LOA role to /loa @user to give them the role and have it auto-unrole when LOA is over -->
<!-- - Added request action commands. Department command can now request an action be taken on a user. -->
- Added "auto role"
    - You can automatically apply the respective roles (probation, suspend, administrative leave, loa) when a command is run.
- Added support for using `#userId` for the `subject` field.
- Added further validation to button/modal submissions.
- Added a `/suggest` command.
- Added the `/bug_report` command.
- Added a notes field to `/deptaction admin_leave`.
- Added more guild details to the embed sent by `/deptaction admin_leave`.
- Changed the `info` command embed to display more information.
- Changed the department action message ("Successfully logged department action") to include a link to the posted message.
- Changed `/config` commands to display an embed upon success/error instead of text.
- Changed department action embeds (footer) to display cached Roblox usernames instead of relying on Discord usernames.
- Changed the `ping` command to display `ms` in its response.
- Changed the `/ping` and `/info` command so they can no longer be run in DMs.
- `/deptaction accept` has been added.
- Changed the username display on department action embeds when using a mention. The bot now uses both Roblox and RoVer to cache Roblox usernames. Old Roblox usernames will no longer be displayed when using the @mention option. Accounts are cached for roughly six hours before being refreshed.
- Changed dates to use UTC (e.g. if you use 2023-06-18, it may have a risk of showing up as 2023-06-19 depending on your timezone).
    - You can be very specific though; mayLOG uses ISO8601 so you can also use `2023-06-20T23:08:20.000Z` for time. See https://www.timestamp-converter.com/
- Changed the `/deptaction probation` command to use bold for "probation" instead of normal text.
- Changed the `/deptaction demote` command to show a red embed instead of green.
- Various other unlisted improvements & additions.

#### Version 1.7.2 [2023-05-31]
Commands:
- Fixed internal issues (yeah.. not much detail)
- URL Validation

#### Version 1.7.1 [2023-05-30]
Commands:
- Fixed deptaction bold issue

#### Version 1.7.0 [2023-05-30]
Commands:
- The backend for DeptAction has been greatly improved. There should be faster load response times for interactions.
- Info command updated to reflect public usage being available.
- Info command made ephemeral.
- *Once again* updated developer commands

#### Version 1.6.6 [2023-05-23]
Commands:
- Updated developer commands
Main bot:
- The bot now leaves a server it's added to if RoVer is not in the server.

#### Version 1.6.5 [2023-05-23]
Main bot:
- Updated internal logging

#### Version 1.6.4 [2023-05-23]
Commands:
- Bug fixes (descriptive, I know)
#### Version 1.6.3 [2023-05-21]
Commands:
- Updated internal developer commands (and more internal stuff)
- mayLOG now tells you if it might need the `Send Messages` permission
- mayLOG now displays an error message when the `YYYY-MM-DD` format isn't used for dates.
- Code improvements

#### Version 1.6.2 [2023-05-11]
Commands:
- Updated internal developer commands
- Updated nearly all /deptaction command colors

#### Version 1.6.1 [2023-05-09]
Commands:
- Fixed non-ephemeral messages in `/deptaction` commands.

#### Version 1.6.0 [2023-05-09]
Commands:
- Added the ability to use a pre-set color list (or hex color) with the `/deptaction custom` command.
- Updated internal developer commands

#### Version 1.5.1 [2023-05-09]
Commands:
- Fixed the issue where the `/deptaction admin_leave` command would sometimes give a "This interaction failed" response
- Fixed the `/deptaction custom` command.

#### Version 1.5.0 [2023-05-08]
Commands:
- Added a `preliminary` option to discharges.
    - Discharge display must be set to `discharge`.
- Fixed an issue where /deptaction admin_leave would error

#### Version 1.4.0 [2023-05-08]
Commands:
- Modified the `/deptaction` command to support both mentions and raw usernames.
    - You no longer need to mention a user to create an action log. It is recommended though.

#### Version 1.3.0 [2023-05-08]
Commands:
- Added `/configure department-icon`
    - Departments can set the icon (URL) to be displayed in the embed message
- Added proper custom department action colors
    - Using `/deptaction custom`, you can select from a list of preset embed colors or use hex colors.
- Added notes to the `/deptaction custom` command.

#### Version 1.2.1 [2023-05-08]
Commands:
- Updated the thumbnail size for department logs
- Updated the `/deptaction transfer` command action color

#### Version 1.2.0 [2023-05-07]

Commands:
- Added a ping command
- Added an info command that displays bot information
    - System uptime
    - Bot developer
    - Bot version
    - Usage information (who qualifies)
    - Documentation
- Modified the `/deptaction admin_leave` command to allow command to place users on Administrative Leave without DMing them.

#### Version 1.1.0 [2023-05-07]

Commands:
- Added the ability to configure if avatars should show in department action messages
 

:::# mayLOG_V1
