import ExternalFileCache from "./OotrFileCache.js";
import OotrVersion from "./OotrVersion.js";

type SettingType = boolean | string | number | string[] | object | null | undefined;
type Setting = {
    name: string,
    default: SettingType,
    type: string,
    tab: string,
    section: string,
    choices?: {
        [internal_name: string]: string
    },
    minimum?: number,
    maximum?: number,
    cosmetic?: boolean,
};
type SettingTypeDictionary = {
    [type_function: string]: Setting
};
export type SettingsDictionary = {
    [key: string]: SettingType,
    starting_items?: {
        [item_name: string]: number,
    },
    spawn_positions?: string[],
    shuffle_child_trade?: string[],
    adult_trade_start?: string[],
    triforce_goal_per_world?: number,
    dungeon_shortcuts?: string[],
    shuffle_ganon_bosskey?: string,
    key_rings?: string[],
    world_count: number,
    debug_parser?: boolean,
};

class SettingsList {
    [index: string]: any;
    public settings: SettingsDictionary;
    public setting_definitions: SettingTypeDictionary = {};

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.settings = { world_count: 1 };
        switch(ootr_version.branch) {
            case '':
            case 'R':
                if (ootr_version.gte('7.1.143')) {
                    this.readSettingsList_7_1_143(file_cache);
                } else if (ootr_version.gte('7.1.117')) {
                    this.readSettingsList_7_1_117(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }
    }

    // for some reason, _.merge was mixing starting_items and hint_dist_user,
    // so instead of that, use a custom merge function for base settings and
    // the plando file
    override_settings(override: any, original: any=this): any {
        let merged_object: any;
        let merged_settings: any = {};
        // override settings
        for (let [k, v] of Object.entries(original)) {
            if (Object.keys(override).includes(k)) {
                if (typeof(v) === 'object') {
                    if (Array.isArray(v)) {
                        merged_settings[k] = override[k];
                    } else {
                        merged_object = this.override_settings(override[k], v);
                        merged_settings[k] = merged_object;
                    }
                } else {
                    merged_settings[k] = override[k];
                }
            } else {
                merged_settings[k] = v;
            }
        }

        // override default logic tricks
        if (Object.keys(override).includes('settings')) {
            if (Object.keys(override.settings).includes('allowed_tricks')) {
                for (let trick of override.settings.allowed_tricks) {
                    merged_settings.settings[trick] = true;
                }
            }
        }

        // append other overrides (locations, entrances, dungeon types, etc)
        for (let [k, v] of Object.entries(override)) {
            if (!(Object.keys(merged_settings).includes(k))) {
                merged_settings[k] = v;
            }
        }

        // apply overrides if at top level of recursion
        if (original === this) {
            for (let [k, v] of Object.entries(merged_settings)) {
                this[k] = v;
            }
        }

        return merged_settings;
    }

    readSettingsList_7_1_117(file_cache: ExternalFileCache): void {
        const settingslist: string = file_cache.files['SettingsList.py'];
        const lines: string[] = settingslist.split('\n').filter(Boolean);

        var setting: Setting = {
            name: '',
            default: null,
            type: 'bool',
            tab: '',
            section: '',
        };
        var parsing: boolean = false;
        var split_char: string = ':';
        var info: string[], d: string | null = null, arg_test: string[], args: string[];

        for (var line of lines) {
            line = line.trim();
            if (line === 'si_dict = {si.name: si for si in setting_infos}') {
                parsing = false;
            }
            if (parsing) {
                if (['setting_info(', 'checkbutton(', 'combobox(', 'scale('].some((prefix) => line.toLowerCase().startsWith(prefix))) {
                    split_char = '=';
                    if (setting.name !== '' && !(setting.name in this.settings)) {
                        if (setting.default === null) {
                            switch(setting.type) {
                                case 'bool':
                                    this.settings[setting.name] = false;
                                    break;
                                case 'str':
                                    this.settings[setting.name] = '';
                                    break;
                                case 'int':
                                    this.settings[setting.name] = 0;
                                    break;
                                case 'list':
                                    this.settings[setting.name] = [];
                                    break;
                                case 'dict':
                                    this.settings[setting.name] = {};
                                    break;
                            }
                        } else {
                            this.settings[setting.name] = setting.default;
                        }
                    }
                    arg_test = line.split('(');
                    switch(arg_test[0].toLowerCase()) {
                        // checkbuttons don't always list an explicit default, class assumes false
                        case 'checkbutton':
                            setting = {
                                name: '',
                                default: false,
                                type: 'bool',
                                tab: '',
                                section: '',
                            };
                            break;
                        case 'combobox':
                            setting = {
                                name: '',
                                default: false,
                                type: 'str',
                                tab: '',
                                section: '',
                            };
                            break;
                        case 'scale':
                            setting = {
                                name: '',
                                default: false,
                                type: 'int',
                                tab: '',
                                section: '',
                            };
                            break;
                        // all other settings type guaranteed to have a default listed
                        default:
                            setting = {
                                name: '',
                                default: null,
                                type: 'bool',
                                tab: '',
                                section: '',
                            };
                            break;
                    }
                    if (arg_test[1] !== '') {
                        args = arg_test[1].split(',');
                        setting.name = args[0].trim().replaceAll(/['",]+/g, '');
                        if (args.length > 1) {
                            setting.type = args[1].trim();
                        }
                    }
                } else {
                    info = line.split(split_char);
                    info[0] = info[0].trim().toLowerCase();
                    if (info.length > 1 || info[0] === '),') {
                        if (d) {
                            d = d.replaceAll(/[']+/g, '"');
                            // lists won't parse if they're wrapped in quotes
                            if (d === 'True' || d === 'False') {
                                d = d.toLowerCase();
                            }
                            try {
                                setting.default = JSON.parse(d);
                            } catch {
                                setting.default = d.replaceAll(/['",]+/g, '');
                            }
                            d = null;
                        }
                    }
                    if (info.length > 1) {
                        if (info[0] === 'name' || info[0] === "'name'") {
                            setting.name = info[1].trim().replaceAll(/['",]+/g, '');
                            // logic rules always assumed off, no explicit default in dictionary
                            if (split_char === ':') {
                                this.settings[setting.name] = false;
                                setting = {
                                    name: '',
                                    default: null,
                                    type: 'bool',
                                    tab: '',
                                    section: '',
                                };
                            }
                        } else if (info[0] === 'type') {
                            setting.type = info[1].trim().replaceAll(/['",]+/g, '');
                        } else if (info[0] === 'multiple_select') {
                            setting.type = info[1].trim().replaceAll(/['",]+/g, '') == 'True' ? 'list' : 'str';
                        } else if (info[0].toLowerCase() === 'default') {
                            d = info[1].trim();
                            if (d.endsWith(',')) {
                                d = d.slice(0, -1);
                            }
                        }
                    } else {
                        if (d) {
                            // long defaults can be spread across multiple lines
                            d += ',' + line.trim();
                            if (d.endsWith(',')) {
                                d = d.slice(0, -1);
                            }
                        }
                    }
                }
            }
            if (line === 'logic_tricks = {') {
                parsing = true;
            }
        }
    }

    readSettingsList_7_1_143(file_cache: ExternalFileCache): void {
        const trickslist: string = file_cache.files['SettingsListTricks.py'];
        const settingslist: string = file_cache.files['SettingsList.py'];
        const settings_categories: any = JSON.parse(file_cache.files['data/settings_mapping.json']);
        const lines: string[] = settingslist.split('\n').filter(Boolean);
        const tricklines: string[] = trickslist.split('\n').filter(Boolean);

        var setting: Setting = {
            name: '',
            default: false,
            type: 'bool',
            tab: '',
            section: '',
        };
        var parsing: boolean = false;
        var split_char: string = ':';
        var info: string[], d: string | null = null, c: {[s: string]: string} | null = null, trick_desc: string = '';

        let trick_list: {[trick: string]: string} = {};
        for (let line of tricklines) {
            info = line.split(split_char);
            if (info.length > 1) {
                if (info[0].startsWith("    '")) {
                    trick_desc = info[0].trim().replaceAll(/['"\\]+/g, '');
                }
                if (info[0].trim().toLowerCase() === 'name' || info[0].trim().toLowerCase() === "'name'") {
                    setting.name = info[1].trim().replaceAll(/['",]+/g, '');
                    // logic rules always assumed off, no explicit default in dictionary
                    this.settings[setting.name] = false;
                    trick_list[setting.name] = trick_desc;
                    setting = {
                        name: '',
                        default: false,
                        type: 'bool',
                        tab: '',
                        section: '',
                    };
                    trick_desc = '';
                }
            }
        }
        this.setting_definitions['allowed_tricks'] = {
            name: 'allowed_tricks',
            default: [],
            type: 'list',
            tab: '',
            section: '',
            cosmetic: false,
            choices: trick_list,
        };
        this.settings['allowed_tricks'] = [];

        let setting_types: SettingTypeDictionary = {
            'settinginfonone(': {
                name: '',
                default: null,
                type: 'null',
                tab: '',
                section: '',
            },
            'settinginfobool(': {
                name: '',
                default: false,
                type: 'bool',
                tab: '',
                section: '',
            },
            'settinginfostr(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'settinginfoint(': {
                name: '',
                default: 0,
                type: 'int',
                tab: '',
                section: '',
            },
            'settinginfolist(': {
                name: '',
                default: [],
                type: 'list',
                tab: '',
                section: '',
            },
            'settinginfodict(': {
                name: '',
                default: {},
                type: 'dict',
                tab: '',
                section: '',
            },
            'button(': {
                name: '',
                default: null,
                type: 'null',
                tab: '',
                section: '',
            },
            'textbox(': {
                name: '',
                default: null,
                type: 'null',
                tab: '',
                section: '',
            },
            'checkbutton(': {
                name: '',
                default: false,
                type: 'bool',
                tab: '',
                section: '',
            },
            'combobox(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'radiobutton(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'fileinput(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'directoryinput(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'textinput(': {
                name: '',
                default: '',
                type: 'str',
                tab: '',
                section: '',
            },
            'comboboxint(': {
                name: '',
                default: 0,
                type: 'int',
                tab: '',
                section: '',
            },
            'scale(': {
                name: '',
                default: 0,
                type: 'int',
                tab: '',
                section: '',
            },
            'numberinput(': {
                name: '',
                default: 0,
                type: 'int',
                tab: '',
                section: '',
            },
            'multipleselect(': {
                name: '',
                default: [],
                type: 'list',
                tab: '',
                section: '',
            },
            'searchbox(': {
                name: '',
                default: [],
                type: 'list',
                tab: '',
                section: '',
            },
        }

        let dynamic_choice_settings = [
            'hint_dist',
            'model_adult',
            'model_child',
            'sfx_link_child',
            'sfx_link_adult',
            'allowed_tricks',
        ];

        split_char = '=';
        for (let line of lines) {
            line = line.trim();
            if (line === 'def get_settings_from_section(section_name: str) -> Iterable[str]:') {
                parsing = false;
            }
            if (parsing) {
                info = line.split('=');
                info[0] = info[0].trim();
                if (info.length > 1) {
                    if (d) {
                        d = d.replaceAll(/[']+/g, '"');
                        // lists won't parse if they're wrapped in quotes
                        if (d === 'True' || d === 'False') {
                            d = d.toLowerCase();
                        }
                        try {
                            setting.default = JSON.parse(d);
                        } catch {
                            setting.default = d.replaceAll(/['",]+/g, '');
                        }
                        d = null;
                    }
                    if (Object.keys(setting_types).some((prefix) => info[1].trim().toLowerCase().startsWith(prefix))) {
                        if (setting.name !== '' && !(setting.name in this.settings) && !setting.cosmetic) {
                            this.settings[setting.name] = setting.default;
                            this.setting_definitions[setting.name] = Object.assign({}, setting);
                        }
                        setting = setting_types[`${info[1].trim().toLowerCase().split('(')[0]}(`];
                        setting.name = info[0];
                        setting.cosmetic = false;
                    } else {
                        if (info[0].toLowerCase() === 'default') {
                            d = info[1].trim();
                            if (d.endsWith(',')) {
                                d = d.slice(0, -1);
                            }
                        }
                        // filter dynamic choices, small enough list to hard code for now
                        if (info[0].toLowerCase() === 'choices' && !(dynamic_choice_settings.includes(setting.name))) {
                            c = {};
                        }
                        if (info[0].toLowerCase() === 'minimum') {
                            let m = info[1].trim();
                            if (m.endsWith(',')) {
                                m = m.slice(0, -1);
                            }
                            setting.minimum = JSON.parse(m);
                        }
                        if (info[0].toLowerCase() === 'maximum') {
                            let m = info[1].trim();
                            if (m.endsWith(',')) {
                                m = m.slice(0, -1);
                            }
                            setting.maximum = JSON.parse(m);
                        }
                        if (info[0].toLowerCase() === 'cosmetic') {
                            let m = info[1].trim().toLowerCase();
                            if (m.endsWith(',')) {
                                m = m.slice(0, -1);
                            }
                            setting.cosmetic = JSON.parse(m);
                        }
                    }
                } else {
                    if (d) {
                        // long defaults can be spread across multiple lines
                        // e.g. adult_trade_start
                        d += ',' + line.trim();
                        if (d.endsWith(',')) {
                            d = d.slice(0, -1);
                        }
                    }
                    if (c !== null && line.split(':').length > 1) {
                        let i = line.split(':');
                        if (i[1].trim().endsWith(',')) {
                            i[1] = i[1].trim().slice(0, -1);
                        }
                        c[i[0].trim().replaceAll(/['",]+/g, '')] = i[1].trim().replaceAll(/['",]+/g, '');
                    } else if (c !== null) {
                        setting.choices = Object.assign({}, c);
                        c = null;
                    }
                }
            }
            if (line === 'class SettingInfos:') {
                parsing = true;
            }
        }

        for (let [s, data] of Object.entries(this.setting_definitions)) {
            for (let tab of settings_categories.Tabs) {
                for (let section of tab.sections) {
                    for (let entry of section.settings) {
                        if (s === entry) {
                            data.tab = tab.text;
                            data.section = section.text;
                            break;
                        }
                    }
                    if (data.tab !== '' || data.section !== '') break;
                }
                if (data.tab !== '' || data.section !== '') break;
            }
        }
    }
}

export default SettingsList;