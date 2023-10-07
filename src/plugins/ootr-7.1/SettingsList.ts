import ExternalFileCache from "./OotrFileCache.js";
import OotrVersion from "./OotrVersion.js";
import type { GraphSettingType } from "../GraphPlugin.js";

type Setting = {
    name: string,
    default: GraphSettingType,
    type: string,
    display_name: string,
    tab: string,
    section: string,
    choices?: {
        [internal_name: string]: string
    },
    minimum?: number,
    maximum?: number,
    cosmetic?: boolean,
    disables?: {
        [opt: string]: {
            settings?: string[],
            sections?: string[],
            tabs?: string[],
        },
    },
    disabled(settings: SettingsDictionary): boolean,
    disabled_default: GraphSettingType,
};
type SettingTypeDictionary = {
    [type_function: string]: Setting
};
export type SettingsDictionary = {
    [key: string]: GraphSettingType,
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
    graphplugin_song_melodies: {
        [song_name: string]: string,
    },
    graphplugin_trials_specific: string[],
    ocarina_songs?: boolean,
    mq_dungeons_specific?: string[],
};

class SettingsList {
    [index: string]: any;
    public settings: SettingsDictionary;
    public setting_definitions: SettingTypeDictionary;

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.settings = {
            world_count: 1,
            graphplugin_trials_specific: [
                'Forest',
                'Fire',
                'Water',
                'Spirit',
                'Shadow',
                'Light',
            ],
            graphplugin_song_melodies: {
                "Zeldas Lullaby": "<^><^>",
                "Eponas Song": "^<>^<>",
                "Sarias Song": "v><v><",
                "Suns Song": ">v^>v^",
                "Song of Time": ">Av>Av",
                "Song of Storms": "Av^Av^",
                "Minuet of Forest": "A^<><>",
                "Bolero of Fire": "vAvA>v>v",
                "Serenade of Water": "Av>><",
                "Requiem of Spirit": "AvA>vA",
                "Nocturne of Shadow": "<>>A<>v",
                "Prelude of Light": "^>^><^",
            }
        };
        this.setting_definitions = {};

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

        this.setting_definitions['graphplugin_trials_specific'] = {
            name: 'graphplugin_trials_specific',
            default: [
                'Forest',
                'Fire',
                'Water',
                'Spirit',
                'Shadow',
                'Light',
            ],
            disabled_default: [
                'Forest',
                'Fire',
                'Water',
                'Spirit',
                'Shadow',
                'Light',
            ],
            type: 'list',
            display_name: 'Enabled Trials',
            tab: this.setting_definitions['trials_random'].tab,
            section: this.setting_definitions['trials_random'].section,
            cosmetic: false,
            choices: {
                'Forest': 'Forest Trial',
                'Fire': 'Fire Trial',
                'Water': 'Water Trial',
                'Spirit': 'Spirit Trial',
                'Shadow': 'Shadow Trial',
                'Light': 'Light Trial',
            },
            disabled: (settings) => { return false },
        };

        for (let def of Object.values(this.setting_definitions)) {
            if (def.disables) {
                for (let [option, disabling] of Object.entries(def.disables)) {
                    let negative = false;
                    let remote_option = option;
                    if (option.startsWith('!')) {
                        negative = true;
                        remote_option = option.slice(1);
                    }
                    if (disabling.settings) {
                        for (let affected_setting of disabling.settings) {
                            if (Object.keys(this.setting_definitions).includes(affected_setting)) {
                                this.create_dependency(this.setting_definitions[affected_setting], def, remote_option, negative);
                            }
                        }
                    }
                }
            }
        }
    }

    create_dependency(affected_setting: Setting, remote_setting: Setting, remote_option: GraphSettingType, negative: boolean = false): void {
        let old_dependency = affected_setting.disabled;
        if (negative) {
            affected_setting.disabled = (settings) => { return settings[remote_setting.name] !== remote_option || old_dependency(settings) }
        } else {
            affected_setting.disabled = (settings) => { return settings[remote_setting.name] === remote_option || old_dependency(settings) }
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
        if (file_cache.files['SettingsList.py'] === undefined) return;
        const settingslist: string = file_cache.files['SettingsList.py'];
        const lines: string[] = settingslist.split('\n').filter(Boolean);

        let setting = new_setting('bool');
        let parsing: boolean = false;
        let split_char: string = ':';
        let info: string[], d: string | null = null, arg_test: string[], args: string[];

        for (let line of lines) {
            let code_line = line.trim();
            code_line = code_line.split('#')[0];
            if (code_line === 'si_dict = {si.name: si for si in setting_infos}') {
                parsing = false;
            }
            if (parsing) {
                if (['setting_info(', 'checkbutton(', 'combobox(', 'scale('].some((prefix) => code_line.toLowerCase().startsWith(prefix))) {
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
                    arg_test = code_line.split('(');
                    switch(arg_test[0].toLowerCase()) {
                        // checkbuttons don't always list an explicit default, class assumes false
                        case 'checkbutton':
                            setting = new_setting('bool');
                            break;
                        case 'combobox':
                            setting = new_setting('str');
                            break;
                        case 'scale':
                            setting = new_setting('int');
                            break;
                        // all other settings type guaranteed to have a default listed
                        default:
                            setting = new_setting('bool');
                            break;
                    }
                    if (arg_test[1] !== '') {
                        args = arg_test[1].split(',');
                        setting.name = args[0].trim().replaceAll(/['",]+/g, '');
                        setting.display_name = setting.name;
                        if (args.length > 1) {
                            setting.type = args[1].trim();
                        }
                    }
                } else {
                    info = code_line.split(split_char);
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
                            setting.display_name = setting.name;
                            // logic rules always assumed off, no explicit default in dictionary
                            if (split_char === ':') {
                                this.settings[setting.name] = false;
                                setting = new_setting('bool');
                            }
                        } else if (info[0] === 'gui_text') {
                            setting.display_name = info[1].trim().replaceAll(/['",]+/g, '');
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
                            d += ',' + code_line.trim();
                            if (d.endsWith(',')) {
                                d = d.slice(0, -1);
                            }
                        }
                    }
                }
            }
            if (code_line === 'logic_tricks = {') {
                parsing = true;
            }
        }
    }

    readSettingsList_7_1_143(file_cache: ExternalFileCache): void {
        if (file_cache.files['SettingsList.py'] === undefined
            || file_cache.files['SettingsListTricks.py'] === undefined
            || file_cache.files['data/settings_mapping.json'] === undefined) return;
        const trickslist: string = file_cache.files['SettingsListTricks.py'];
        const settingslist: string = file_cache.files['SettingsList.py'];
        let settings_categories: any;
        try {
            settings_categories = JSON.parse(file_cache.files['data/settings_mapping.json']);
        } catch {
            console.log(`Could not parse setting_mapping.json: ${file_cache.files['data/settings_mapping.json']}`);
        }
        const lines: string[] = settingslist.split('\n').filter(Boolean);
        const tricklines: string[] = trickslist.split('\n').filter(Boolean);

        let setting = new_setting('bool');
        let parsing: boolean = false;
        let split_char: string = ':';
        let info: string[], d: string | null = null, c: {[s: string]: string} | null = null, disable: string | null = null;

        let trick_list: {[trick: string]: string} = {};
        for (let line of tricklines) {
            let code_line = line.split('#')[0];
            info = code_line.split(split_char);
            if (info.length > 1) {
                if (info[0].startsWith("    '")) {
                    setting.display_name = info[0].trim().replaceAll(/['"\\]+/g, '');
                }
                if (info[0].trim().toLowerCase() === 'name' || info[0].trim().toLowerCase() === "'name'") {
                    setting.name = info[1].trim().replaceAll(/['",]+/g, '');
                    // logic rules always assumed off, no explicit default in dictionary
                    this.settings[setting.name] = false;
                    trick_list[setting.name] = setting.display_name;
                    setting = {
                        name: '',
                        default: false,
                        disabled_default: false,
                        type: 'bool',
                        display_name: '',
                        tab: '',
                        section: '',
                        disabled: (settings) => { return false },
                    };
                }
            }
        }
        this.setting_definitions['allowed_tricks'] = new_setting('list');
        this.setting_definitions['allowed_tricks'].name = 'allowed_tricks';
        this.setting_definitions['allowed_tricks'].display_name = 'Enable Tricks';
        this.setting_definitions['allowed_tricks'].cosmetic = false;
        this.setting_definitions['allowed_tricks'].choices = trick_list;
        this.settings['allowed_tricks'] = [];

        let setting_types: SettingTypeDictionary = {
            'settinginfonone(': new_setting('null'),
            'settinginfobool(': new_setting('bool'),
            'settinginfostr(':  new_setting('str'),
            'settinginfoint(':  new_setting('int'),
            'settinginfolist(': new_setting('list'),
            'settinginfodict(': new_setting('dict'),
            'button(':          new_setting('null'),
            'textbox(':         new_setting('null'),
            'checkbutton(':     new_setting('bool'),
            'combobox(':        new_setting('str'),
            'radiobutton(':     new_setting('str'),
            'fileinput(':       new_setting('str'),
            'directoryinput(':  new_setting('str'),
            'textinput(':       new_setting('str'),
            'comboboxint(':     new_setting('int'),
            'scale(':           new_setting('int'),
            'numberinput(':     new_setting('int'),
            'multipleselect(':  new_setting('list'),
            'searchbox(':       new_setting('list'),
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
            let code_line = line.split('#')[0];
            code_line = code_line.trim();
            if (code_line === 'def get_settings_from_section(section_name: str) -> Iterable[str]:') {
                parsing = false;
            }
            if (parsing) {
                info = code_line.split('=');
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
                    if (disable) {
                        disable = disable.replaceAll(/[']+/g, '"');
                        let sanitized_str = '';
                        for (let i = 0; i < disable.length; i++) {
                            let chr = disable.charAt(i);
                            if (chr !== ',' && chr !== ')') {
                                sanitized_str += chr;
                            } else if (chr === ',') {
                                if (i !== disable.length - 1) {
                                    let lookahead = disable.charAt(i + 1);
                                    if (!([']', '}', ')'].includes(lookahead))) {
                                        sanitized_str += chr;
                                    }
                                }
                            }
                        }
                        setting.disables = JSON.parse(sanitized_str);
                        disable = null;
                    }
                    if (Object.keys(setting_types).some((prefix) => info[1].trim().toLowerCase().startsWith(prefix))) {
                        if (setting.name !== '' && !(setting.name in this.settings) && !setting.cosmetic) {
                            this.settings[setting.name] = setting.default;
                            this.setting_definitions[setting.name] = Object.assign({}, setting);
                        }
                        setting = setting_types[`${info[1].trim().toLowerCase().split('(')[0]}(`];
                        setting.name = info[0];
                        setting.display_name = setting.name;
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
                        if (info[0].toLowerCase() === 'gui_text') {
                            let m = info[1].trim().replaceAll(/['",]+/g, '');
                            if (m.endsWith(',')) {
                                m = m.slice(0, -1);
                            }
                            setting.display_name = m;
                        }
                        if (info[0].toLowerCase() === 'disable') {
                            disable = info[1].trim();
                            if (disable.endsWith(',')) {
                                disable = disable.slice(0, -1);
                            }
                        }
                    }
                } else {
                    if (d) {
                        // long defaults can be spread across multiple lines
                        // e.g. adult_trade_start
                        d += ',' + code_line.trim();
                        if (d.endsWith(',')) {
                            d = d.slice(0, -1);
                        }
                    }
                    if (c !== null && code_line.split(':').length > 1) {
                        let i = code_line.split(':');
                        if (i[1].trim().endsWith(',')) {
                            i[1] = i[1].trim().slice(0, -1);
                        }
                        c[i[0].trim().replaceAll(/['",]+/g, '')] = i[1].trim().replaceAll(/['",]+/g, '');
                    } else if (c !== null) {
                        setting.choices = Object.assign({}, c);
                        c = null;
                    }
                    if (disable) {
                        let disable_line: string;
                        if (code_line.trim().toLowerCase().startsWith('true')) {
                            disable_line = `"true"${code_line.trim().slice(4)}`;
                        } else if (code_line.trim().toLowerCase().startsWith('false')) {
                            disable_line = `"false"${code_line.trim().slice(5)}`;
                        } else {
                            disable_line = code_line.trim();
                        }
                        disable += disable_line;
                    }
                }
            }
            if (code_line === 'class SettingInfos:') {
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

function new_setting(type: string): Setting {
    let setting: Setting = {
        name: '',
        default: false,
        disabled_default: false,
        type: 'bool',
        display_name: '',
        tab: '',
        section: '',
        disabled: (settings) => { return false },
    };
    if (type === 'str') {
        setting.type = 'str';
        setting.default = '';
        setting.disabled_default = '';
    } else if (type === 'int') {
        setting.type = 'int';
        setting.default = 0;
        setting.disabled_default = 0;
    } else if (type === 'null') {
        setting.type = 'null';
        setting.default = null;
        setting.disabled_default = null;
    } else if (type === 'list') {
        setting.type = 'list';
        setting.default = [];
        setting.disabled_default = [];
    } else if (type === 'dict') {
        setting.type = 'dict';
        setting.default = {};
        setting.disabled_default = {};
    }

    return setting;
}

export default SettingsList;