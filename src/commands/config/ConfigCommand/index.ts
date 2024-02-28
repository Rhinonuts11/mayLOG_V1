import { Argument, ArgumentType, Command, CommandType } from 'gcommands';
import ActivityQuotas from './activity-quotas';
import ALContactMessage from './al-contact-message';
import ALDirectMessage from './al-dm-message';
import AvatarActions from './avatar-actions';
import DepartmentIcon from './department-icon';
import DischargeDisplay from './discharge-display';
import SetActionRequestChannel from './set-actionreq-channel';
import SetActivityLogChannel from './set-activitylog-channel';
import SetCommandRoles from './set-command-roles';
import SetDepartmentRole from './set-department-role';
import SetDeptCommandRoles from './set-deptcommand-roles';
import SetLoaChannel from './set-loa-channel';
import SetLogChannel from './set-log-channel';
import SetRoles from './set-roles';

interface ICommand {
    name: string;
    description: string;
    arguments?: Argument[];
    run: Function;
}

const SUBCOMMANDS = [
    ActivityQuotas, ALContactMessage, ALDirectMessage, AvatarActions, DepartmentIcon,
    DischargeDisplay, SetActionRequestChannel, SetActivityLogChannel, SetCommandRoles,
    SetDepartmentRole, SetDeptCommandRoles, SetLoaChannel, SetLogChannel, SetRoles
]

function GetSubcommandArguments(): Argument[] {
    const args: Argument[] = [];
    SUBCOMMANDS.forEach((command: ICommand) => {
        args.push(new Argument({
            name: command.name,
            description: command.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: command.arguments ? command.arguments : []
        }));
    });
    return args;
}

new Command({
    name: 'config',
    description: 'Configure mayLOG',
    dmPermission: false,
    defaultMemberPermissions: 'ADMINISTRATOR',
    type: [ CommandType.SLASH ],
    arguments: GetSubcommandArguments(),
    run(context) {
        const subCommand = context.arguments.getSubcommand();
        SUBCOMMANDS.forEach(command => {
            if (command.name === subCommand) {
                command.run(context);
            }
        });
    }
});