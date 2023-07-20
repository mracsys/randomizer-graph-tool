const { readFileSync } = require('fs');
const { resolve } = require('path');
const OotrVersion = require('./OotrVersion.js');

class SettingsList {
    constructor(ootr_version) {
        this.settings = {};
        switch(ootr_version.branch) {
            case '':
            case 'R':
                if (ootr_version.greaterThanOrEqual(new OotrVersion('7.1.143'))) {
                    this.readSettingsList_7_1_143();
                } else if (ootr_version.greaterThanOrEqual(new OotrVersion('7.1.117'))) {
                    this.readSettingsList_7_1_117();
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.toString()}`);
        }
    }

    // for some reason, _.merge was mixing starting_items and hint_dist_user,
    // so instead of that, use a custom merge function for base settings and
    // the plando file
    override_settings(override, original=this) {
        let merged_object;
        let merged_settings = {};
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

    readSettingsList_7_1_117() {
        const settingslist = readFileSync(resolve(__dirname, 'ootr-logic', 'SettingsList.py'), 'utf-8');
        const lines = settingslist.split('\n').filter(Boolean);

        var setting = {
            name: '',
            default: null,
            type: 'bool',
        };
        var parsing = false;
        var split_char = ':';
        var info, d, arg_test, args;

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
                            };
                            break;
                        case 'combobox':
                            setting = {
                                name: '',
                                default: false,
                                type: 'str',
                            };
                            break;
                        case 'scale':
                            setting = {
                                name: '',
                                default: false,
                                type: 'int',
                            };
                            break;
                        // all other settings type guaranteed to have a default listed
                        default:
                            setting = {
                                name: '',
                                default: null,
                                type: 'bool',
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

    readSettingsList_7_1_143() {
        const trickslist = readFileSync(resolve(__dirname, 'ootr-logic', 'SettingsListTricks143.py'), 'utf-8');
        const settingslist = readFileSync(resolve(__dirname, 'ootr-logic', 'SettingsList143.py'), 'utf-8');
        const lines = settingslist.split('\n').filter(Boolean);
        const tricklines = trickslist.split('\n').filter(Boolean);

        var setting = {
            name: '',
            default: null,
            type: 'bool',
        };
        var parsing = false;
        var split_char = ':';
        var info, d, arg_test, args;

        for (var line of tricklines) {
            info = line.split(split_char);
            info[0] = info[0].trim().toLowerCase();

            if (info.length > 1) {
                if (info[0] === 'name' || info[0] === "'name'") {
                    setting.name = info[1].trim().replaceAll(/['",]+/g, '');
                    // logic rules always assumed off, no explicit default in dictionary
                    this.settings[setting.name] = false;
                    setting = {
                        name: '',
                        default: null,
                        type: 'bool',
                    };
                }
            }
        }

        let setting_types = {
            'settinginfonone(': {
                'name': '',
                'default': null,
                'type': 'null'
            },
            'settinginfobool(': {
                'name': '',
                'default': false,
                'type': 'bool',
            },
            'settinginfostr(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'settinginfoint(': {
                'name': '',
                'default': 0,
                'type': 'int',
            },
            'settinginfolist(': {
                'name': '',
                'default': [],
                'type': 'list',
            },
            'settinginfodict(': {
                'name': '',
                'default': {},
                'type': 'dict',
            },
            'button(': {
                'name': '',
                'default': null,
                'type': 'null',
            },
            'textbox(': {
                'name': '',
                'default': null,
                'type': 'null',
            },
            'checkbutton(': {
                'name': '',
                'default': false,
                'type': 'bool',
            },
            'combobox(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'radiobutton(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'fileinput(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'directoryinput(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'textinput(': {
                'name': '',
                'default': '',
                'type': 'str',
            },
            'comboboxint(': {
                'name': '',
                'default': 0,
                'type': 'int',
            },
            'scale(': {
                'name': '',
                'default': 0,
                'type': 'int',
            },
            'numberinput(': {
                'name': '',
                'default': 0,
                'type': 'int',
            },
            'multipleselect(': {
                'name': '',
                'default': [],
                'type': 'list',
            },
            'searchbox(': {
                'name': '',
                'default': [],
                'type': 'list',
            },
        }

        split_char = '=';
        for (var line of lines) {
            line = line.trim();
            if (line === 'def get_settings_from_section(section_name: str) -> Iterable[str]:') {
                parsing = false;
            }
            if (parsing) {
                info = line.split('=');
                info[0] = info[0].trim().toLowerCase();
                if (info.length > 1) {
                    if (Object.keys(setting_types).some((prefix) => info[1].trim().toLowerCase().startsWith(prefix))) {
                        if (setting.name !== '' && !(setting.name in this.settings)) {
                            this.settings[setting.name] = setting.default;
                        }
                        setting = setting_types[`${info[1].trim().toLowerCase().split('(')[0]}(`];
                        setting.name = info[0];
                    } else {
                        if (info.length > 1 || info[0] === ')') {
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
                            if (info[0].toLowerCase() === 'default') {
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
            }
            if (line === 'class SettingInfos:') {
                parsing = true;
            }
        }
    }
}



module.exports = SettingsList;