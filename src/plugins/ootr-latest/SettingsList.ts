import ExternalFileCache from "./OotrFileCache.js";
import OotrVersion from "./OotrVersion.js";
import type { GraphSettingType, GraphSettingsLayout } from "../GraphPlugin.js";


// Most of these are simple space -> _ and all lowercase replacements,
// but for some godawful reason not all of them are consistent
const starting_inventory_items: {[old_starting_item_name: string]: string} = {
    "bombs": "Bomb Bag",
    "bow": 'Bow',
    "fire_arrow": "Fire Arrows",
    "dins_fire": "Dins Fire",
    "slingshot": 'Slingshot',
    "ocarina": 'Ocarina',
    "hookshot": "Progressive Hookshot",
    "ice_arrow": "Ice Arrows",
    "farores_wind": "Farores Wind",
    "boomerang": 'Boomerang',
    "lens": "Lens of Truth",
    "beans": "Magic Bean Pack",
    "megaton_hammer": "Megaton Hammer",
    "light_arrow": "Light Arrows",
    "nayrus_love": "Nayrus Love",
    "bottle": 'Bottle',
    "letter": "Rutos Letter",
    "pocket_egg":    "Pocket Egg",
    "pocket_cucco":  "Pocket Cucco",
    "cojiro":        "Cojiro",
    "odd_mushroom":  "Odd Mushroom",
    "odd_potion":    "Odd Potion",
    "poachers_saw":  "Poachers Saw",
    "broken_sword":  "Broken Sword",
    "prescription":  "Prescription",
    "eyeball_frog":  "Eyeball Frog",
    "eyedrops":      "Eyedrops",
    "claim_check":   "Claim Check",
    "weird_egg":     "Weird Egg",
    "chicken":       "Chicken",
    "zeldas_letter": "Zeldas Letter",
    "keaton_mask":   "Keaton Mask",
    "skull_mask":    "Skull Mask",
    "spooky_mask":   "Spooky Mask",
    "bunny_hood":    "Bunny Hood",
    "goron_mask":    "Goron Mask",
    "zora_mask":     "Zora Mask",
    "gerudo_mask":   "Gerudo Mask",
    "mask_of_truth": "Mask of Truth",
    "ocarina_a_button":       "Ocarina A Button",
    "ocarina_c_up_button":    "Ocarina C up Button",
    "ocarina_c_down_button":  "Ocarina C down Button",
    "ocarina_c_left_button":  "Ocarina C left Button",
    "ocarina_c_right_button": "Ocarina C right Button",
}

const starting_songs_items: {[old_starting_item_name: string]: string} = {
    "lullaby": "Zeldas Lullaby",
    "eponas_song": "Eponas Song",
    "sarias_song": "Sarias Song",
    "suns_song": "Suns Song",
    "song_of_time": "Song of Time",
    "song_of_storms": "Song of Storms",
    "minuet": "Minuet of Forest",
    "bolero": "Bolero of Fire",
    "serenade": "Serenade of Water",
    "requiem": "Requiem of Spirit",
    "nocturne": "Nocturne of Shadow",
    "prelude": "Prelude of Light",
}

const starting_equipment_items: {[old_starting_item_name: string]: string} = {
    "kokiri_sword": "Kokiri Sword",
    "giants_knife": "Giants Knife",
    "biggoron_sword": "Biggoron Sword",
    "deku_shield": "Deku Shield",
    "hylian_shield": "Hylian Shield",
    "mirror_shield": "Mirror Shield",
    "goron_tunic": "Goron Tunic",
    "zora_tunic": "Zora Tunic",
    "iron_boots": "Iron Boots",
    "hover_boots": "Hover Boots",
    "magic": "Magic Meter",
    "strength": "Progressive Strength Upgrade",
    "scale": "Progressive Scale",
    "wallet": "Progressive Wallet",
    "stone_of_agony": "Stone of Agony",
    "defense": "Double Defense",
}

// Some settings have a value assigned when disabled that is outside
// the range of the normal options. This causes unexpected behavior
// when the setting is no longer disabled. This function is called
// when undisabling settings to check if this is the case, and also
// when disabling settings in order to save a sane value to revert to
// after the setting is no longer disabled.
export const setting_options_include_value = (setting_definition: Setting, setting_value: GraphSettingType): boolean => {
    if (setting_value === null && setting_definition.type === 'null') return true;
    if (setting_value === undefined || setting_value === null) return false;
    if (setting_definition.type === 'bool') return typeof setting_value === 'boolean';
    if (setting_definition.type === 'int') {
        if (typeof setting_value !== 'number') return false;
        if (!!setting_definition.minimum && setting_value < setting_definition.minimum) return false;
        if (!!setting_definition.maximum && setting_value > setting_definition.maximum) return false;
        return true;
    }
    if (setting_definition.type === 'str') {
        if (typeof setting_value !== 'string') return false;
        if (setting_definition.choices === undefined) return true; // no choices to validate against
        return Object.keys(setting_definition.choices).includes(setting_value);
    }
    // no validation for list/dict setting types
    return true;
}

export type Setting = {
    name: string,
    default: GraphSettingType,
    type: string,
    display_name: string,
    tab: string,
    section: string,
    order: number,
    choices?: {
        [internal_name: string]: string
    },
    minimum?: number,
    maximum?: number,
    cosmetic?: boolean,
    disable_map?: {
        [opt: string]: {
            settings?: string[],
            sections?: string[],
            tabs?: string[],
        },
    },
    disables: Setting[],
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
    disabled_locations?: string[],
    shuffle_dungeon_rewards?: string,
    mix_entrance_pools?: string[],
    tokensanity?: string,
    starting_inventory?: string[],
    starting_equipment?: string[],
    starting_songs?: string[],
};

export type SettingsPresets = {
    [preset_name: string]: SettingsDictionary,
}

type SettingLayout = {
    [tab: string]: {
        settings: Setting[],
        sections: {
            [section: string]: Setting[],
        }
    }
};

// Settings that should never be used as they override
// the "specific" options for other settings. This library
// doesn't handle random selection and expects explicit settings.
export var global_settings_overrides: {[setting_name: string]: GraphSettingType} = {
    mq_dungeons_mode: 'specific',
    trials_random: false,
    chicken_count_random: false,
    big_poe_count_random: false,
}

class SettingsList {
    [index: string]: any;
    public settings: SettingsDictionary;
    public setting_definitions: SettingTypeDictionary;
    public settings_layout: SettingLayout;
    public settings_presets: SettingsPresets;
    public ootr_version: OotrVersion;

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.ootr_version = ootr_version;
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
        this.settings_layout = {};
        this.settings_presets = {};

        switch(ootr_version.branch) {
            case '':
            case 'R':
            case 'Rob':
            case 'fenhl':
                if (ootr_version.gte('7.1.143')) {
                    this.readSettingsList_7_1_143(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.143 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }

        // skip the rest of initialization if loading an empty graph with no file cache
        if (Object.keys(this.setting_definitions).length === 0) return;

        this.create_extra_settings();
        this.override_setting_definitions();
        this.create_setting_dependencies();
        this.sort_settings_layout();
        this.load_settings_presets(file_cache);
    }

    create_extra_settings(): void {
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
            order: 10000,
            cosmetic: false,
            choices: {
                'Forest': 'Forest Trial',
                'Fire': 'Fire Trial',
                'Water': 'Water Trial',
                'Spirit': 'Spirit Trial',
                'Shadow': 'Shadow Trial',
                'Light': 'Light Trial',
            },
            disables: [],
            disabled: (settings) => { return false },
        };
        this.setting_definitions['graphplugin_song_melodies'] = {
            name: 'graphplugin_song_melodies',
            default: {
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
            },
            disabled_default: {
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
            },
            type: 'dict',
            display_name: 'Known Ocarina Melodies',
            tab: this.setting_definitions['ocarina_songs'].tab,
            section: this.setting_definitions['ocarina_songs'].section,
            order: 10000,
            cosmetic: false,
            disables: [],
            disabled: (settings) => { return false },
        };
        this.setting_definitions['graphplugin_viewable_unshuffled_items'] = {
            name: 'graphplugin_viewable_unshuffled_items',
            default: [],
            disabled_default: [
                'Gold Skulltula Tokens',
                'Adult Trade Items',
                'Child Trade Items',
                'Dungeon Small Keys',
                'Dungeon Boss Key',
                'Dungeon Maps',
                'Dungeon Compasses',
                'Save Epona',
                "Malon's Obstacle Course",
                'Set Scarecrow Song',
            ],
            type: 'list',
            display_name: 'Shown Unshuffled Items',
            tab: this.setting_definitions['trials_random'].tab,
            section: this.setting_definitions['trials_random'].section,
            order: 10001,
            cosmetic: false,
            choices: {
                'Gold Skulltula Tokens': 'Gold Skulltula Tokens',
                'Adult Trade Items': 'Adult Trade Items',
                'Child Trade Items': 'Child Trade Items',
                'Dungeon Small Keys': 'Dungeon Small Keys',
                'Dungeon Boss Key': 'Dungeon Boss Key',
                'Dungeon Maps': 'Dungeon Maps',
                'Dungeon Compasses': 'Dungeon Compasses',
                'Save Epona': 'Save Epona',
                "Malon's Obstacle Course": "Malon's Obstacle Course",
                'Set Scarecrow Song': 'Set Scarecrow Song',
            },
            disables: [],
            disabled: (settings) => { return false },
        };
        this.setting_definitions['debug_parser'] = {
            name: 'debug_parser',
            default: false,
            disabled_default: false,
            type: 'bool',
            display_name: 'Debug Rule Parser',
            tab: '',
            section: '',
            order: 0,
            cosmetic: false,
            disables: [],
            disabled: (settings) => { return false },
        };
    }

    override_setting_definitions(): void {
        // Consolidate some settings to custom section
        if (Object.keys(this.setting_definitions).includes('logic_rules')) {
            this.setting_definitions.logic_rules.section = 'Logic';
            this.setting_definitions.logic_rules.order = 0;
        }
        if (Object.keys(this.setting_definitions).includes('allowed_tricks')) {
            this.setting_definitions.allowed_tricks.tab = 'Main Rules';
            this.setting_definitions.allowed_tricks.section = 'Logic';
            this.setting_definitions.allowed_tricks.order = 1;
        }
        if (Object.keys(this.setting_definitions).includes('logic_no_night_tokens_without_suns_song')) {
            this.setting_definitions.logic_no_night_tokens_without_suns_song.tab = 'Main Rules';
            this.setting_definitions.logic_no_night_tokens_without_suns_song.section = 'Logic';
            this.setting_definitions.logic_no_night_tokens_without_suns_song.order = 2;
        }
        if (Object.keys(this.setting_definitions).includes('disabled_locations')) {
            this.setting_definitions.disabled_locations.tab = 'Main Rules';
            this.setting_definitions.disabled_locations.section = 'Logic';
            this.setting_definitions.disabled_locations.order = 3;
        }
    }

    create_setting_dependencies(): void {
        for (let def of Object.values(this.setting_definitions)) {
            if (def.disable_map) {
                def.disables = []; // not sure why this is necessary, but otherwise settings inherit the list from past settings
                for (let [option, disabling] of Object.entries(def.disable_map)) {
                    let negative = false;
                    let remote_option: string | boolean | number = option;
                    if (option.startsWith('!')) {
                        negative = true;
                        remote_option = option.slice(1);
                    }
                    if (def.type === 'int' && typeof remote_option === 'string') remote_option = parseInt(remote_option);
                    if (def.type === 'bool' && (remote_option === 'true' || remote_option === 'false')) remote_option = remote_option === 'true';
                    if (disabling.settings) {
                        for (let affected_setting of disabling.settings) {
                            if (Object.keys(this.setting_definitions).includes(affected_setting)) {
                                this.create_dependency(this.setting_definitions[affected_setting], this.setting_definitions[def.name], remote_option, negative);
                            }
                        }
                    }
                }
            }
            if (def.tab) {
                if (!(Object.keys(this.settings_layout).includes(def.tab))) {
                    this.settings_layout[def.tab] = {
                        settings: [],
                        sections: {},
                    };
                }
                if (def.section) {
                    if (!(Object.keys(this.settings_layout[def.tab].sections).includes(def.section))) {
                        this.settings_layout[def.tab].sections[def.section] = [];
                    }
                    this.settings_layout[def.tab].sections[def.section].push(def);
                } else {
                    this.settings_layout[def.tab].settings.push(def);
                }
            }
        }
    }

    sort_settings_layout(): void {
        for (let [tab_name, tab] of Object.entries(this.settings_layout)) {
            if (tab.settings.length > 0) {
                this.settings_layout[tab_name].settings = tab.settings.sort((a, b) => a.order - b.order);
            }
            for (let [section_name, section] of Object.entries(tab.sections)) {
                if (section.length > 0) {
                    this.settings_layout[tab_name].sections[section_name] = section.sort((a, b) => a.order - b.order);
                }
            }
        }
    }

    copy(): SettingsList {
        let s = new SettingsList(this.ootr_version, { files: {} });
        if (this.settings.world_count > 1) {
            s.dungeons = {};
            s.empty_dungeons = {};
            s.entrances = {};
            s.locations = {};
            s.randomized_settings = {};
            s.songs = {};
            s.trials = {};
            s.gossip_stones = {};
            for (let i = 0; i < this.settings.world_count; i++) {
                s.dungeons[`World ${i + 1}`] = Object.assign({}, this.dungeons[`World ${i + 1}`]);
                s.empty_dungeons[`World ${i + 1}`] = Object.assign({}, this.empty_dungeons[`World ${i + 1}`]);
                s.songs[`World ${i + 1}`] = Object.assign({}, this.songs[`World ${i + 1}`]);
                s.trials[`World ${i + 1}`] = Object.assign({}, this.trials[`World ${i + 1}`]);
                s.gossip_stones[`World ${i + 1}`] = Object.assign({}, this.gossip_stones[`World ${i + 1}`]);
                s.entrances[`World ${i + 1}`] = this.copy_entry(this.entrances[`World ${i + 1}`]);
                s.locations[`World ${i + 1}`] = this.copy_entry(this.locations[`World ${i + 1}`]);
            }
        } else {
            s.dungeons = Object.assign({}, this.dungeons);
            s.empty_dungeons = Object.assign({}, this.empty_dungeons);
            s.randomized_settings = Object.assign({}, this.randomized_settings);
            s.songs = Object.assign({}, this.songs);
            s.trials = Object.assign({}, this.trials);
            s.gossip_stones = Object.assign({}, this.gossip_stones);
            s.entrances = this.copy_entry(this.entrances);
            s.locations = this.copy_entry(this.locations);
        }
        s.settings = this.copy_entry(this.settings);
        s.setting_definitions = this.copy_entry(this.setting_definitions);
        return s;
    }

    copy_entry(entry_object: any): any {
        let ret: any = {};
        if (!!entry_object) {
            for (let [key, val] of Object.entries(entry_object)) {
                if (Array.isArray(val)) {
                    ret[key] = [...val];
                } else if (typeof(val) === 'object') {
                    ret[key] = Object.assign({}, val);
                } else {
                    ret[key] = val;
                }
            }
        }
        return ret;
    }

    create_dependency(affected_setting: Setting, remote_setting: Setting, remote_option: GraphSettingType, negative: boolean = false): void {
        if (!(remote_setting.disables.includes(affected_setting))) remote_setting.disables.push(affected_setting);
        let old_dependency = affected_setting.disabled;
        if (negative) {
            affected_setting.disabled = (settings) => settings[remote_setting.name] !== remote_option || old_dependency(settings);
        } else {
            affected_setting.disabled = (settings) => settings[remote_setting.name] === remote_option || old_dependency(settings);
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
                    } else if (!!v) {
                        merged_object = this.override_settings(override[k], v);
                        merged_settings[k] = merged_object;
                    } else {
                        merged_settings[k] = override[k];
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

    set_to_defaults(): void {
        for (let setting of Object.keys(this.settings)) {
            if (!!(this.setting_definitions.allowed_tricks.choices) && Object.keys(this.setting_definitions.allowed_tricks.choices).includes(setting)) {
                this.settings[setting] = false;
            } else {
                this.settings[setting] = this.setting_definitions[setting].default;
            }
        }
    }

    load_settings_presets(file_cache: ExternalFileCache): void {
        if (file_cache.files['data/presets_default.json'] === undefined) return;
        try {
            this.settings_presets = JSON.parse(file_cache.files['data/presets_default.json']);
            for (let [preset_name, preset_settings] of Object.entries(this.settings_presets)) {
                // convert old-style starting items lists to dictionary format
                if (preset_settings.starting_items === null || preset_settings.starting_items === undefined) preset_settings.starting_items = {};
                if (Object.keys(preset_settings).includes('starting_inventory') && Array.isArray(preset_settings['starting_inventory'])) {
                    let inventory = preset_settings['starting_inventory'] as string[];
                    for (let i of inventory) {
                        if (Object.keys(starting_inventory_items).includes(i)) {
                            let real_name = starting_inventory_items[i];
                            if (Object.keys(preset_settings.starting_items).includes(real_name)) {
                                preset_settings.starting_items[real_name] += 1;
                            } else {
                                preset_settings.starting_items[real_name] = 1;
                            }
                        } else {
                            throw `Could not load settings presets: ${preset_name} has unknown starting inventory item ${i}`;
                        }
                    }
                    preset_settings['starting_inventory'] = [];
                }
                if (Object.keys(preset_settings).includes('starting_songs') && Array.isArray(preset_settings['starting_songs'])) {
                    let inventory = preset_settings['starting_songs'] as string[];
                    for (let i of inventory) {
                        if (Object.keys(starting_songs_items).includes(i)) {
                            let real_name = starting_songs_items[i];
                            if (Object.keys(preset_settings.starting_items).includes(real_name)) {
                                preset_settings.starting_items[real_name] += 1;
                            } else {
                                preset_settings.starting_items[real_name] = 1;
                            }
                        } else {
                            throw `Could not load settings presets: ${preset_name} has unknown starting song item ${i}`;
                        }
                    }
                    preset_settings['starting_songs'] = [];
                }
                if (Object.keys(preset_settings).includes('starting_equipment') && Array.isArray(preset_settings['starting_equipment'])) {
                    let inventory = preset_settings['starting_equipment'] as string[];
                    for (let i of inventory) {
                        if (Object.keys(starting_equipment_items).includes(i)) {
                            let real_name = starting_equipment_items[i];
                            if (Object.keys(preset_settings.starting_items).includes(real_name)) {
                                preset_settings.starting_items[real_name] += 1;
                            } else {
                                preset_settings.starting_items[real_name] = 1;
                            }
                        } else {
                            throw `Could not load settings presets: ${preset_name} has unknown starting equipment item ${i}`;
                        }
                    }
                    preset_settings['starting_equipment'] = [];
                }
                // Some presets use "random" option for some settings, but the library
                // requires all settings to be clearly defined. In general, the option
                // before "random" in the setting option list has the highest level of
                // randomized locations/entrances/regions, so use that to be conservative
                // for possible things for the user to check.
                for (let [setting_name, setting_value] of Object.entries(preset_settings)) {
                    if (setting_value === 'random') {
                        let setting_choices = this.setting_definitions[setting_name].choices;
                        if (!!setting_choices) {
                            let setting_options = Object.keys(setting_choices);
                            let setting_index = setting_options.indexOf(setting_value);
                            setting_index--;
                            if (setting_index < 0) setting_index = setting_options.length - 1;
                            preset_settings[setting_name] = setting_options[setting_index];
                        } else {
                            throw `Failed to change random setting to non-random value: undefined setting choices`;
                        }
                    }
                }
            }
        } catch {
            console.log(`Could not parse presets_default.json: ${file_cache.files['data/presets_default.json']}`);
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
        let info: string[], d: string | null = null, dd: string | null = null, c: {[s: string]: string} | null = null, disable: string | null = null;

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
                        order: 0,
                        disables: [],
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
            'disabled_locations',
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
                        if (Object.keys(global_settings_overrides).includes(setting.name)) {
                            setting.default = global_settings_overrides[setting.name];
                        }
                        d = null;
                    }
                    if (dd) {
                        dd = dd.replaceAll(/[']+/g, '"');
                        // lists won't parse if they're wrapped in quotes
                        if (dd === 'True' || dd === 'False') {
                            dd = dd.toLowerCase();
                        }
                        try {
                            setting.disabled_default = JSON.parse(dd);
                        } catch {
                            setting.disabled_default = dd.replaceAll(/['",]+/g, '');
                        }
                        dd = null;
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
                        setting.disable_map = JSON.parse(sanitized_str);
                        disable = null;
                    }
                    if (Object.keys(setting_types).some((prefix) => info[1].trim().toLowerCase().startsWith(prefix))) {
                        if (setting.name !== '' && setting.name !== 'allowed_tricks' && !setting.cosmetic) {
                            this.settings[setting.name] = setting.default;
                            this.setting_definitions[setting.name] = Object.assign({}, setting);
                        }
                        setting = Object.assign({}, setting_types[`${info[1].trim().toLowerCase().split('(')[0]}(`]);
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
                        if (info[0].toLowerCase() === 'disabled_default') {
                            dd = info[1].trim();
                            if (dd.endsWith(',')) {
                                dd = dd.slice(0, -1);
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
                } else if (line !== '    )') {
                    if (d) {
                        // long defaults can be spread across multiple lines
                        // e.g. adult_trade_start
                        d += ',' + code_line.trim();
                        if (d.endsWith(',')) {
                            d = d.slice(0, -1);
                        }
                    }
                    if (dd) {
                        // long defaults can be spread across multiple lines
                        // e.g. adult_trade_start
                        dd += ',' + code_line.trim();
                        if (dd.endsWith(',')) {
                            dd = dd.slice(0, -1);
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
            let order = 0;
            for (let tab of settings_categories.Tabs) {
                for (let section of tab.sections) {
                    for (let entry of section.settings) {
                        order++;
                        if (s === entry) {
                            data.tab = tab.text;
                            data.section = section.text;
                            data.order = order;
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
        order: 0,
        disables: [],
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