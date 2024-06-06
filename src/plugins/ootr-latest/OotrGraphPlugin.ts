import { GraphEntrance, GraphGameVersions, GraphItem, GraphLocation, GraphPlugin, GraphSetting, GraphWorld, GraphSettingType, GraphEntrancePool, GraphSettingsOptions, GraphSettingsLayout, GraphRegion, GraphHintGoal } from '../GraphPlugin.js';

import SettingsList from './SettingsList.js';
import World, { PlandoLocationList, PlandoMWLocationList, PlandoEntranceList, PlandoMWEntranceList, PlandoEntranceTarget, PlandoItem, PlandoCheckedLocationList, PlandoMWCheckedLocationList, PlandoCheckedEntranceList, PlandoMWCheckedEntranceList, PlandoHintList, PlandoMWHintList, PlandoHint, PlandoHintTextList, PlandoMWHintTextList } from "./World.js";
import EntranceList from './EntranceList.js';
import { Item, ItemFactory, ItemInfo, _ItemInfo } from "./Item.js";
import OotrVersion from './OotrVersion.js';
import OotrFileCache from './OotrFileCache.js';
import Entrance from './Entrance.js';
import { Location } from './Location.js';
import Search from './Search.js';
import LocationList from './LocationList.js';
import ItemList from './ItemList.js';
import { SettingsDictionary } from './SettingsList.js';
import { display_names } from './DisplayNames.js';
import { global_settings_overrides, setting_options_include_value, settings_to_never_reset_to_default } from './SettingsList.js';
import { Hint, HintAreas } from './Hints.js';
import { RegionGroup } from './RegionGroup.js';
import HintArea from './HintArea.js';
import WorldState from './WorldState.js';

interface OotrPlando {
    ':version': string,
    settings: SettingsDictionary,
    dungeons: { [dungeon_name: string]: string },
    trials: { [trial_name: string]: string },
    songs: { [song_name: string]: string },
    entrances: PlandoEntranceList | PlandoMWEntranceList,
    locations: PlandoLocationList | PlandoMWLocationList,
    ':hint_text': PlandoHintTextList | PlandoMWHintTextList,
    ':checked': PlandoCheckedLocationList | PlandoMWCheckedLocationList,
    ':checked_entrances': PlandoCheckedEntranceList | PlandoMWCheckedEntranceList,
    ':tracked_hints': PlandoHintList | PlandoMWHintList,
};

interface OotrPlandoHints {
    [gossip_stone_name: string]: {
        text: string,
        colors: string[],
        hinted_locations?: string[],
        hinted_items?: string[],
    }
}

const child_rewards = [
    'Kokiri Emerald',
    'Goron Ruby',
    'Zora Sapphire',
];
const adult_rewards = [
    'Forest Medallion',
    'Fire Medallion',
    'Water Medallion',
    'Spirit Medallion',
    'Shadow Medallion',
    'Light Medallion',
];
const dungeonToCompassMap: {[dungeonName: string]: string} = {
    "DEKU": "Compass (Deku Tree)",
    "DCVN": "Compass (Dodongos Cavern)",
    "JABU": "Compass (Jabu Jabus Belly)",
    "FRST": "Compass (Forest Temple)",
    "FIRE": "Compass (Fire Temple)",
    "WATR": "Compass (Water Temple)",
    "SPRT": "Compass (Spirit Temple)",
    "SHDW": "Compass (Shadow Temple)",
}
const itemToCompassMap: {[dungeonName: string]: string} = {
    "Kokiri Emerald": "Compass (Deku Tree)",
    "Goron Ruby": "Compass (Dodongos Cavern)",
    "Zora Sapphire": "Compass (Jabu Jabus Belly)",
    "Forest Medallion": "Compass (Forest Temple)",
    "Fire Medallion": "Compass (Fire Temple)",
    "Water Medallion": "Compass (Water Temple)",
    "Spirit Medallion": "Compass (Spirit Temple)",
    "Shadow Medallion": "Compass (Shadow Temple)",
}
const compassToItemMap: {[dungeonName: string]: string} = {
    "Compass (Deku Tree)": "Kokiri Emerald",
    "Compass (Dodongos Cavern)": "Goron Ruby",
    "Compass (Jabu Jabus Belly)": "Zora Sapphire",
    "Compass (Forest Temple)": "Forest Medallion",
    "Compass (Fire Temple)": "Fire Medallion",
    "Compass (Water Temple)": "Water Medallion",
    "Compass (Spirit Temple)": "Spirit Medallion",
    "Compass (Shadow Temple)": "Shadow Medallion",
}
const dungeonToEntranceMap: {[dungeonName: string]: string} = {
    "DEKU": "Deku Tree Before Boss -> Queen Gohma Boss Room",
    "DCVN": "Dodongos Cavern Before Boss -> King Dodongo Boss Room",
    "JABU": "Jabu Jabus Belly Before Boss -> Barinade Boss Room",
    "FRST": "Forest Temple Before Boss -> Phantom Ganon Boss Room",
    "FIRE": "Fire Temple Before Boss -> Volvagia Boss Room",
    "WATR": "Water Temple Before Boss -> Morpha Boss Room",
    "SPRT": "Spirit Temple Before Boss -> Twinrova Boss Room",
    "SHDW": "Shadow Temple Before Boss -> Bongo Bongo Boss Room",
};
const entranceToDungeonMap: {[entrance: string]: string} = {
    "Deku Tree Before Boss -> Queen Gohma Boss Room": "DEKU",
    "Dodongos Cavern Before Boss -> King Dodongo Boss Room": "DCVN",
    "Jabu Jabus Belly Before Boss -> Barinade Boss Room": "JABU",
    "Forest Temple Before Boss -> Phantom Ganon Boss Room": "FRST",
    "Fire Temple Before Boss -> Volvagia Boss Room": "FIRE",
    "Water Temple Before Boss -> Morpha Boss Room": "WATR",
    "Spirit Temple Before Boss -> Twinrova Boss Room": "SPRT",
    "Shadow Temple Before Boss -> Bongo Bongo Boss Room": "SHDW",
}
export const entranceToBossRewardMap: {[entranceName: string]: string} = {
    "Deku Tree Before Boss -> Queen Gohma Boss Room": "Queen Gohma",
    "Dodongos Cavern Before Boss -> King Dodongo Boss Room": "King Dodongo",
    "Jabu Jabus Belly Before Boss -> Barinade Boss Room": "Barinade",
    "Forest Temple Before Boss -> Phantom Ganon Boss Room": "Phantom Ganon",
    "Fire Temple Before Boss -> Volvagia Boss Room": "Volvagia",
    "Water Temple Before Boss -> Morpha Boss Room": "Morpha",
    "Spirit Temple Before Boss -> Twinrova Boss Room": "Twinrova",
    "Shadow Temple Before Boss -> Bongo Bongo Boss Room": "Bongo Bongo",
};
const bossRewardToEntranceMap: {[bossName: string]: string} = {
    "Queen Gohma": "Deku Tree Before Boss -> Queen Gohma Boss Room",
    "King Dodongo": "Dodongos Cavern Before Boss -> King Dodongo Boss Room",
    "Barinade": "Jabu Jabus Belly Before Boss -> Barinade Boss Room",
    "Phantom Ganon": "Forest Temple Before Boss -> Phantom Ganon Boss Room",
    "Volvagia": "Fire Temple Before Boss -> Volvagia Boss Room",
    "Morpha": "Water Temple Before Boss -> Morpha Boss Room",
    "Twinrova": "Spirit Temple Before Boss -> Twinrova Boss Room",
    "Bongo Bongo": "Shadow Temple Before Boss -> Bongo Bongo Boss Room",
}
const bossToRewardMap: {[bossName: string]: string} = {
    "GOMA": "Queen Gohma",
    "KING": "King Dodongo",
    "BARI": "Barinade",
    "PHGA": "Phantom Ganon",
    "VOLV": "Volvagia",
    "MOR": "Morpha",
    "TWIN": "Twinrova",
    "BNGO": "Bongo Bongo",
};
const rewardToBossMap: {[reward: string]: string} = {
    'Links Pocket': 'FREE',
    "Queen Gohma": "GOMA",
    "King Dodongo": "KING",
    "Barinade": "BARI",
    "Phantom Ganon": "PHGA",
    "Volvagia": "VOLV",
    "Morpha": "MOR",
    "Twinrova": "TWIN",
    "Bongo Bongo": "BNGO",
}

const option_to_item_names: {[option: string]: string[]} = {
    'Gold Skulltula Tokens': [
        'Gold Skulltula Token'
    ],
    'Adult Trade Items': [
        "Pocket Egg",
        "Pocket Cucco",
        "Cojiro",
        "Odd Mushroom",
        "Odd Potion",
        "Poachers Saw",
        "Broken Sword",
        "Prescription",
        "Eyeball Frog",
        "Eyedrops",
        "Claim Check",
        "Wake Up Adult Talon",
    ],
    'Child Trade Items': [
        "Weird Egg",
        "Chicken",
        "Zeldas Letter",
        "Keaton Mask",
        "Skull Mask",
        "Spooky Mask",
        "Bunny Hood",
        "Mask of Truth",
        "Kakariko Village Child Trade 1",
        "Lost Woods Child Trade 1",
        "Graveyard Child Trade 1",
        "Hyrule Field Child Trade 1",
        "Hyrule Castle Grounds Child Trade 1",
    ],
    'Dungeon Small Keys': [
        'Small Key (Forest Temple)',
        'Small Key (Fire Temple)',
        'Small Key (Water Temple)',
        'Small Key (Spirit Temple)',
        'Small Key (Shadow Temple)',
        'Small Key (Bottom of the Well)',
        'Small Key (Gerudo Training Ground)',
        'Small Key (Ganons Castle)',
    ],
    'Dungeon Boss Key': [
        'Boss Key (Forest Temple)',
        'Boss Key (Fire Temple)',
        'Boss Key (Water Temple)',
        'Boss Key (Spirit Temple)',
        'Boss Key (Shadow Temple)',
        'Boss Key (Ganons Castle)',
    ],
    'Dungeon Maps': [
        'Map (Deku Tree)',
        'Map (Dodongos Cavern)',
        'Map (Jabu Jabus Belly)',
        'Map (Forest Temple)',
        'Map (Fire Temple)',
        'Map (Water Temple)',
        'Map (Spirit Temple)',
        'Map (Shadow Temple)',
        'Map (Bottom of the Well)',
        'Map (Ice Cavern)',
    ],
    'Dungeon Compasses': [
        'Compass (Deku Tree)',
        'Compass (Dodongos Cavern)',
        'Compass (Jabu Jabus Belly)',
        'Compass (Forest Temple)',
        'Compass (Fire Temple)',
        'Compass (Water Temple)',
        'Compass (Spirit Temple)',
        'Compass (Shadow Temple)',
        'Compass (Bottom of the Well)',
        'Compass (Ice Cavern)',
    ],
    'Ocarinas': [
        'Ocarina',
    ],
    'Save Epona': [
        'Epona',
    ],
    'Buy Magic Beans': [
        'Buy Magic Bean',
    ],
    'Plant Magic Beans': [
        'Kokiri Forest Soil Patch 1',
        'Lost Woods Soil Patch 1',
        'LW Beyond Mido Soil Patch 1',
        'Lake Hylia Soil Patch 1',
        'Desert Colossus Soil Patch 1',
        'Graveyard Soil Patch 1',
        'Death Mountain Soil Patch 1',
        'DMC Central Nearby Soil Patch 1',
        'Zora River Soil Patch 1',
    ],
    'Malon\'s Obstacle Course': [
        'Links Cow',
    ],
    'Set Scarecrow Song': [
        'Bonooru',
        'Scarecrow Song',
    ],
}

export class OotrGraphPlugin extends GraphPlugin {
    private version_list = [
        '7.1.143',
        '7.1.154',
        '7.1.198',
        '7.1.143 R-1',
        '7.1.154 R-1',
        '7.1.195 R-1',
        '7.1.198 Rob-49'
    ];

    public worlds: World[];
    public search: Search;
    public all_tricks_worlds: World[];
    public all_tricks_search: Search;
    public all_tricks_and_keys_worlds: World[];
    public all_tricks_and_keys_search: Search;
    public settings_list: SettingsList;
    public location_list: LocationList;
    public entrance_list: EntranceList;
    public item_list: ItemList;
    public ItemInfo: ItemInfo;
    private disabled_settings: GraphSetting[] = [];

    constructor(
        public user_overrides: any,
        public ootr_version: OotrVersion,
        public file_cache: OotrFileCache,
        public debug: boolean = false,
        public test_only: boolean = false,
    ) {
        super();
        this.worlds = [];
        this.all_tricks_worlds = [];
        this.all_tricks_and_keys_worlds = [];
        this.search = new Search([]);
        this.all_tricks_search = new Search([]);
        this.all_tricks_and_keys_search = new Search([]);
        this.settings_list = new SettingsList(ootr_version, file_cache);
        this.location_list = new LocationList(ootr_version, file_cache);
        this.entrance_list = new EntranceList(ootr_version, file_cache);
        this.item_list = new ItemList(ootr_version, file_cache);

        let valid_cache = Object.keys(this.file_cache.files).length > 0;

        // In python OOTR this is a global variable, but we don't have
        // a static item list file to reference, so initialize as a
        // plugin property instead.
        this.ItemInfo = {
            items: {},
            events: {},
            bottles: new Set(),
            medallions: new Set(),
            stones: new Set(),
            ocarina_buttons: new Set(),
            junk: {},
        };

        if (valid_cache) {
            Object.keys(this.item_list.item_table).map((item_name) => {
                this.ItemInfo.items[item_name] = new _ItemInfo(item_name, this.item_list.item_table);
                if (this.ItemInfo.items[item_name].bottle) {
                    this.ItemInfo.bottles.add(item_name);
                }
                if (this.ItemInfo.items[item_name].medallion) {
                    this.ItemInfo.medallions.add(item_name);
                }
                if (this.ItemInfo.items[item_name].stone) {
                    this.ItemInfo.stones.add(item_name);
                }
                if (this.ItemInfo.items[item_name].ocarina_button) {
                    this.ItemInfo.ocarina_buttons.add(item_name);
                }
                if (this.ItemInfo.items[item_name].junk !== null) {
                    this.ItemInfo.junk[item_name] = this.ItemInfo.items[item_name].junk;
                }
            });
        }

        if (!!user_overrides && valid_cache) {
            this.settings_list.override_settings(user_overrides);
        }

        // If this is a running in a test environment, skip parsing logic
        // as this takes more than a few ms.
        if (test_only || !valid_cache) {
            // won't function correctly as the world logic isn't loaded
            return;
        }
        this.build_world_graphs(this.settings_list, ootr_version);
        let checked_locations: PlandoCheckedLocationList | PlandoMWCheckedLocationList = [];
        if (Object.keys(this.settings_list).includes(':checked')) {
            checked_locations = this.settings_list[':checked'];
        }
        if (Object.keys(this.settings_list).includes('locations')) {
            this.set_items(this.settings_list.locations, checked_locations);
        }
        let checked_entrances: PlandoCheckedEntranceList | PlandoMWCheckedEntranceList = [];
        if (Object.keys(this.settings_list).includes(':checked_entrances')) {
            checked_entrances = this.settings_list[':checked_entrances'];
        }
        if (Object.keys(this.settings_list).includes('entrances')) {
            this.set_entrances(this.settings_list.entrances, checked_entrances);
        }
        this.finalize_world(true);
        this.reset_disabled_location_choices();
        this.all_tricks_worlds = this.create_tricked_worlds();
        this.all_tricks_and_keys_worlds = this.create_tricked_worlds(true);
        this.create_searches();
        this.set_viewable_region_groups();
        this.initialized = true;
    }

    static async create_remote_graph(user_overrides: any = null, version: string = '7.1.143', global_cache: OotrFileCache | null = null, debug: boolean = false, test_only: boolean = false) {
        let ootr_version = new OotrVersion(version);
        let file_cache;
        if (!!global_cache) {
            file_cache = global_cache;
        } else {
            file_cache = await OotrFileCache.load_ootr_files(version);
        }
        return new OotrGraphPlugin(user_overrides, ootr_version, file_cache, debug, test_only);
    }

    static create_graph(user_overrides: any = null, version: string = '7.1.143', global_cache: OotrFileCache, debug: boolean = false, test_only: boolean = false) {
        let ootr_version = new OotrVersion(version);
        return new OotrGraphPlugin(user_overrides, ootr_version, global_cache, debug, test_only);
    }

    create_searches() {
        this.search = new Search(this.worlds.map((world) => world.state));
        this.all_tricks_search = new Search(this.all_tricks_worlds.map((world) => world.state),
            {
                with_tricks: true,
            });
        this.all_tricks_and_keys_search = new Search(this.all_tricks_and_keys_worlds.map((world) => world.state),
            {
                with_tricks: true,
                regions_only: true,
            });
    }

    reset_searches() {
        // search caches are reset when linked world states are reset
        this.reset_search(this.search);
        this.reset_search(this.all_tricks_search);
        this.reset_search(this.all_tricks_and_keys_search);
    }

    reset_search(search: Search) {
        search.reset_states();
    }

    reset_disabled_location_choices() {
        if (Object.keys(this.settings_list.setting_definitions).includes('disabled_locations')) {
            this.settings_list.setting_definitions.disabled_locations.choices = {};
            // only add disabled locations once since the list is common between worlds,
            // even if selected disabled locations are different
            for (let loc of this.worlds[0].get_locations(true)) {
                if (loc.type !== 'Event') {
                    this.settings_list.setting_definitions.disabled_locations.choices[loc.name] = loc.name;
                }
            }
        }
    }

    load_settings_preset(preset_name: string): void {
        let plando = this.get_settings_preset(preset_name);
        if (!!plando) {
            this.import(plando);
        } else {
            throw `Attempted to load unknown preset ${preset_name}`;
        }
    }

    import(plando: any): void {
        // modify the existing GraphPlugin object to avoid running the rule parser
        this.settings_list.set_to_defaults();
        this.settings_list.override_settings(plando);
        let graph_settings = this.get_settings_options();

        for (let world of this.worlds) {
            // invalidate saved restoration settings from previous seed
            world.disabled_settings = {};
            for (let [setting, def] of Object.entries(graph_settings)) {
                if (Object.keys(global_settings_overrides).includes(setting)) {
                    this.change_setting(world, def, global_settings_overrides[setting], {update_vanilla_items: false, from_import: true});
                } else {
                    let randomized_settings: any = {};
                    if (Object.keys(plando).includes('randomized_settings')) {
                        if (!!(plando.settings.world_count) && plando.settings.world_count > 1) {
                            randomized_settings = plando.randomized_settings[`World ${world.id+1}`];
                        } else {
                            randomized_settings = plando.randomized_settings;
                        }
                    }
                    if (Object.keys(randomized_settings).includes(setting)) {
                        this.change_setting(world, def, <GraphSettingType>randomized_settings[setting], {update_vanilla_items: false, from_import: true});
                    } else if (Object.keys(plando).includes('settings')) {
                        if (Object.keys(plando.settings).includes(setting)) {
                            this.change_setting(world, def, <GraphSettingType>plando.settings[setting], {update_vanilla_items: false, from_import: true});
                        } else if (!(settings_to_never_reset_to_default.includes(setting))) {
                            this.change_setting(world, def, def.default, {update_vanilla_items: false, from_import: true});
                        }
                    } else {
                        this.change_setting(world, def, def.default, {update_vanilla_items: false, from_import: true});
                    }
                }
            }
            let mq_dungeons: string[] = [];
            if (Object.keys(plando).includes('dungeons')) {
                for (let [dungeon, variant] of Object.entries(plando.dungeons)) {
                    if (variant === 'mq') {
                        mq_dungeons.push(dungeon);
                    }
                }
            }
            this.change_setting(world, graph_settings['mq_dungeons_specific'], mq_dungeons, {update_vanilla_items: false, from_import: true});
            let active_trials: string[] = [];
            if (Object.keys(plando).includes('trials')) {
                for (let [trial, active] of Object.entries(plando.trials)) {
                    if (active === 'active') {
                        active_trials.push(trial);
                    }
                }
            }
            this.change_setting(world, graph_settings['graphplugin_trials_specific'], active_trials, {update_vanilla_items: false, from_import: true});
            if (Object.keys(plando).includes('songs')) {
                this.change_setting(world, graph_settings['graphplugin_song_melodies'], plando.songs, {update_vanilla_items: false, from_import: true});
            } else {
                this.change_setting(world, graph_settings['graphplugin_song_melodies'], {}, {update_vanilla_items: false, from_import: true});
            }
        }

        // second loop to validate disabled settings
        for (let world of this.worlds) {
            for (let def of Object.values(graph_settings)) {
                for (let remote_setting of def.disables) {
                    if (remote_setting.disabled(world.settings)) {
                        this.change_setting(world, remote_setting, remote_setting.disabled_default, {update_setting_only: true, from_import: true});
                    }
                }
            }
            world.update_internal_settings();
        }

        this.worlds.forEach((world) => world.state.reset());
        this.worlds.forEach((world) => world.initialize_fixed_item_area_hints());
        let checked_locations: PlandoCheckedLocationList | PlandoMWCheckedLocationList = [];
        if (Object.keys(plando).includes(':checked')) {
            checked_locations = plando[':checked'];
        }
        if (Object.keys(plando).includes('locations')) {
            this.set_items(plando.locations, checked_locations);
        } else {
            this.set_items(null, checked_locations);
        }
        let checked_entrances: PlandoCheckedEntranceList | PlandoMWCheckedEntranceList = [];
        if (Object.keys(plando).includes(':checked_entrances')) {
            checked_entrances = plando[':checked_entrances'];
        }
        if (Object.keys(plando).includes('entrances')) {
            this.set_entrances(plando.entrances, checked_entrances);
        } else {
            this.set_entrances(null, checked_entrances);
        }
        // Reset hints
        for (let world of this.worlds) {
            let hint_locations = world.get_locations().filter(l => l.is_hint);
            for (let hint_location of hint_locations) {
                if (hint_location.hint !== null) {
                    this.unhint(hint_location, true);
                }
                hint_location.hint_text = '';
            }
        }
        // :tracked_hints is mutually exclusive with gossip_stones.
        // :tracked_hints is created by this library and saved in exports.
        // gossip_stones is from the base randomizer and discarded by this
        // library after initial import.
        let sim_mode = this.worlds[0].settings.graphplugin_simulator_mode;
        if (sim_mode === undefined) sim_mode = false;
        if (Object.keys(plando).includes(':tracked_hints')) {
            let hints = plando[':tracked_hints'] as PlandoHintList;
            for (let [hint_location_name, hint_data] of Object.entries(hints)) {
                if (hint_location_name === 'temple_of_time_altar') {
                    if (hint_data.fixed_areas === undefined) throw `Can't import fixed hints with undefined data`;
                    this.worlds[0].fixed_item_area_hints = Object.assign({}, hint_data.fixed_areas);
                } else if (hint_location_name === 'pending_location_assignments') {
                    if (hint_data.fixed_areas === undefined) throw `Can't import pending reward location hints with undefined data`;
                    this.worlds[0].pending_reward_assignments = Object.assign({}, hint_data.fixed_areas);
                } else {
                    let hint_location = this.worlds[0].get_location(hint_location_name);
                    let item: Item;
                    let item2: Item;
                    let area: RegionGroup;
                    switch(hint_data.type) {
                        case 'location':
                            if (hint_data.location === undefined) throw `Can't import location hint with undefined location: ${hint_location_name}`;
                            if (hint_data.item === undefined) throw `Can't import location hint with undefined item: ${hint_location_name}`;
                            let location = this.worlds[0].get_location(hint_data.location);
                            if (typeof hint_data.item === 'string') {
                                item = this.worlds[0].get_item(hint_data.item)
                            } else {
                                item = this.worlds[0].get_item(hint_data.item.item)
                                if (!!hint_data.item.price) item.price = hint_data.item.price;
                            }
                            this.hint_location(hint_location, location, item, sim_mode || hint_location.checked);
                            break;
                        case 'dual':
                            if (hint_data.location === undefined) throw `Can't import dual hint with undefined first location: ${hint_location_name}`;
                            if (hint_data.item === undefined) throw `Can't import dual hint with undefined first item: ${hint_location_name}`;
                            if (hint_data.location2 === undefined) throw `Can't import dual hint with undefined second location: ${hint_location_name}`;
                            if (hint_data.item2 === undefined) throw `Can't import dual hint with undefined second item: ${hint_location_name}`;
                            let location1 = this.worlds[0].get_location(hint_data.location);
                            if (typeof hint_data.item === 'string') {
                                item = this.worlds[0].get_item(hint_data.item)
                            } else {
                                item = this.worlds[0].get_item(hint_data.item.item)
                                if (!!hint_data.item.price) item.price = hint_data.item.price;
                            }
                            let location2 = this.worlds[0].get_location(hint_data.location2);
                            if (typeof hint_data.item2 === 'string') {
                                item2 = this.worlds[0].get_item(hint_data.item2)
                            } else {
                                item2 = this.worlds[0].get_item(hint_data.item2.item)
                                if (!!hint_data.item2.price) item2.price = hint_data.item2.price;
                            }
                            this.hint_dual_locations(hint_location, location1, item, location2, item2, sim_mode || hint_location.checked);
                            break;
                        case 'entrance':
                            if (hint_data.entrance === undefined) throw `Can't import entrance hint with undefined entrance: ${hint_location_name}`;
                            let source = this.worlds[0].get_entrance(`${hint_data.entrance.source.from} -> ${hint_data.entrance.source.region}`);
                            let target = this.worlds[0].get_entrance(`${hint_data.entrance.target.from} -> ${hint_data.entrance.target.region}`);
                            this.hint_entrance(hint_location, source, target, sim_mode || hint_location.checked);
                            break;
                        case 'woth':
                            if (hint_data.area === undefined) throw `Can't import woth hint with undefined region: ${hint_location_name}`;
                            area = this.worlds[0].get_region_group(hint_data.area);
                            this.hint_required_area(hint_location, area, sim_mode || hint_location.checked);
                            break;
                        case 'goal':
                            if (hint_data.area === undefined) throw `Can't import goal hint with undefined region: ${hint_location_name}`;
                            if (hint_data.goal === undefined) throw `Can't import goal hint with undefined goal: ${hint_location_name}`;
                            area = this.worlds[0].get_region_group(hint_data.area);
                            let goal = new GraphHintGoal();
                            if (!!hint_data.goal.item) {
                                if (typeof hint_data.goal.item === 'string') {
                                    item = this.worlds[0].get_item(hint_data.goal.item)
                                } else {
                                    item = this.worlds[0].get_item(hint_data.goal.item.item)
                                    if (!!hint_data.goal.item.price) item.price = hint_data.goal.item.price;
                                }
                                goal.item = item;
                            }
                            if (!!hint_data.goal.location) goal.location = this.worlds[0].get_location(hint_data.goal.location);
                            goal.item_count = hint_data.goal.item_count;
                            this.hint_area_required_for_goal(hint_location, area, goal, sim_mode || hint_location.checked);
                            break;
                        case 'foolish':
                            if (hint_data.area === undefined) throw `Can't import foolish hint with undefined region: ${hint_location_name}`;
                            area = this.worlds[0].get_region_group(hint_data.area);
                            this.hint_unrequired_area(hint_location, area, sim_mode || hint_location.checked);
                            break;
                        case 'important_check':
                            if (hint_data.area === undefined) throw `Can't import important check hint with undefined region: ${hint_location_name}`;
                            if (hint_data.num_major_items === undefined) throw `Can't import important check hint with undefined major item count: ${hint_location_name}`;
                            area = this.worlds[0].get_region_group(hint_data.area);
                            this.hint_area_num_items(hint_location, area, hint_data.num_major_items, sim_mode || hint_location.checked);
                            break;
                        case 'misc':
                            if (hint_data.area === undefined) throw `Can't import misc hint with undefined region: ${hint_location_name}`;
                            if (hint_data.item === undefined) throw `Can't import misc hint with undefined item: ${hint_location_name}`;
                            area = this.worlds[0].get_region_group(hint_data.area);
                            if (typeof hint_data.item === 'string') {
                                item = this.worlds[0].get_item(hint_data.item)
                            } else {
                                item = this.worlds[0].get_item(hint_data.item.item)
                                if (!!hint_data.item.price) item.price = hint_data.item.price;
                            }
                            this.hint_item_in_area(hint_location, area, item, sim_mode || hint_location.checked);
                            break;
                        default:
                            throw `Unknown hint type in import data: ${hint_data.type}`;
                    }
                }
            }
        }
        // Cached hint text from plando import
        if (Object.keys(plando).includes(':hint_text')) {
            let hints = plando[':hint_text'] as PlandoHintTextList;
            for (let [location_name, hint] of Object.entries(hints)) {
                let hint_location = this.worlds[0].get_location(location_name);
                hint_location.hint_text = hint;
            }
        }
        // Hint text from plando import. The gossip_stones key
        // is not preserved on export because I don't want to
        // reimplement the entire randomizer hint framework. Take
        // only the hint text, and only use it for sim mode, where
        // the user can manually interpret the hint text to the format
        // understood by this library.
        let hint_stone_to_location_map: {[stone_name: string]: string} = {
            'DMC (Bombable Wall)':              'DMC Gossip Stone',
            'DMT (Biggoron)':                   'DMT Gossip Stone',
            'Colossus (Spirit Temple)':         'Colossus Gossip Stone',
            'Dodongos Cavern (Bombable Wall)':  'Dodongos Cavern Gossip Stone',
            'GV (Waterfall)':                   'GV Gossip Stone',
            'GC (Maze)':                        'GC Maze Gossip Stone',
            'GC (Medigoron)':                   'GC Medigoron Gossip Stone',
            'Graveyard (Shadow Temple)':        'Graveyard Gossip Stone',
            'HC (Malon)':                       'HC Malon Gossip Stone',
            'HC (Rock Wall)':                   'HC Rock Wall Gossip Stone',
            'HC (Storms Grotto)':               'HC Storms Grotto Gossip Stone',
            'KF (Deku Tree Left)':              'KF Deku Tree Gossip Stone (Left)',
            'KF (Deku Tree Right)':             'KF Deku Tree Gossip Stone (Right)',
            'KF (Outside Storms)':              'KF Gossip Stone',
            'LH (Lab)':                         'LH Lab Gossip Stone',
            'LH (Southeast Corner)':            'LH Gossip Stone (Southeast)',
            'LH (Southwest Corner)':            'LH Gossip Stone (Southwest)',
            'LW (Bridge)':                      'LW Gossip Stone',
            'SFM (Maze Lower)':                 'SFM Maze Gossip Stone (Lower)',
            'SFM (Maze Upper)':                 'SFM Maze Gossip Stone (Upper)',
            'SFM (Saria)':                      'SFM Saria Gossip Stone',
            'ToT (Left)':                       'ToT Gossip Stone (Left)',
            'ToT (Left-Center)':                'ToT Gossip Stone (Left-Center)',
            'ToT (Right)':                      'ToT Gossip Stone (Right)',
            'ToT (Right-Center)':               'ToT Gossip Stone (Right-Center)',
            'ZD (Mweep)':                       'ZD Gossip Stone',
            'ZF (Fairy)':                       'ZF Fairy Gossip Stone',
            'ZF (Jabu)':                        'ZF Jabu Gossip Stone',
            'ZR (Near Grottos)':                'ZR Near Grottos Gossip Stone',
            'ZR (Near Domain)':                 'ZR Near Domain Gossip Stone',
            'HF (Cow Grotto)':                  'HF Cow Grotto Gossip Stone',
            'HF (Near Market Grotto)':          'HF Near Market Grotto Gossip Stone',
            'HF (Southeast Grotto)':            'HF Southeast Grotto Gossip Stone',
            'HF (Open Grotto)':                 'HF Open Grotto Gossip Stone',
            'Kak (Open Grotto)':                'Kak Open Grotto Gossip Stone',
            'ZR (Open Grotto)':                 'ZR Open Grotto Gossip Stone',
            'KF (Storms Grotto)':               'KF Storms Grotto Gossip Stone',
            'LW (Near Shortcuts Grotto)':       'LW Near Shortcuts Grotto Gossip Stone',
            'DMT (Storms Grotto)':              'DMT Storms Grotto Gossip Stone',
            'DMC (Upper Grotto)':               'DMC Upper Grotto Gossip Stone',
        };
        const path_locations: {[path_name: string]: string} = {
            'queen gohma': 'Queen Gohma',
            'king dodongo': 'King Dodongo',
            'barinade': 'Barinade',
            'phantom ganon': 'Phantom Ganon',
            'volvagia': 'Volvagia',
            'morpha': 'Morpha',
            'bongo bongo': 'Bongo Bongo',
            'twinrova': 'Twinrova',
            'the tower': 'Ganons Tower Boss Key Chest',
            'the hero': 'Ganon',
        }
        
        const path_items: {[path_name: string]: string} = {
            'gold': 'Triforce Piece',
            'time': 'Song of Time',
            'evil\'s bane': 'Light Arrows',
            'skulls': 'Gold Skulltula Token',
            'hearts': 'Heart Container',
            'the key': 'Boss Key (Ganons Castle)',
            'kokiri emerald': 'Kokiri Emerald',
            'goron ruby': 'Goron Ruby',
            'zora sapphire': 'Zora Sapphire',
            'forest medallion': 'Forest Medallion',
            'fire medallion': 'Fire Medallion',
            'water medallion': 'Water Medallion',
            'spirit medallion': 'Spirit Medallion',
            'shadow medallion': 'Shadow Medallion',
            'light medallion': 'Light Medallion',
        }
        if (Object.keys(plando).includes('gossip_stones')) {
            let gossip_hints: OotrPlandoHints = plando['gossip_stones'];
            for (let [stone_name, hint] of Object.entries(gossip_hints)) {
                if (Object.keys(hint_stone_to_location_map).includes(stone_name)) {
                    let hint_location = this.worlds[0].get_location(hint_stone_to_location_map[stone_name]);
                    // Try to parse the hint text from the base randomizer.
                    // If we fail, also save the text to the location and let
                    // the user decide how to interpret it via the hinting
                    // functions on this class.
                    if (!!hint.hinted_locations && !!hint.hinted_items) {
                        let hinted_group: RegionGroup | null = null;
                        let color_split = hint.text.split('#').filter(t => t.length > 0);
                        // Check for woth/path first
                        if (hint.text.includes('on the way of the hero')) {
                            if (color_split.length > 1) {
                                hinted_group = this.extract_region_from_hint(stone_name, color_split, 1, this.worlds[0]);
                            }
                            if (!!hinted_group) this.hint_required_area(hint_location, hinted_group, true);
                        // older builds did not have color on the #time# path
                        } else if (hint.text.includes('on the path of time')) {
                            try {
                                if (color_split.length > 1) {
                                    hinted_group = this.extract_region_from_hint(stone_name, color_split, 1, this.worlds[0]);
                                }
                                let goal = new GraphHintGoal();
                                goal.item_count = 1;
                                goal.item = this.worlds[0].get_item(path_items['time']);
                                if (!!hinted_group) this.hint_area_required_for_goal(hint_location, hinted_group, goal, true);
                            } catch (e) {
                                console.log(`Trouble parsing spoiler gossip stone hint: path hint path could not be read for text ${hint.text}`);
                                if (e instanceof Error) {
                                    console.log(e.message);
                                }
                            }
                        } else if (hint.text.includes('on the path')) {
                            try {
                                if (color_split.length > 1) {
                                    hinted_group = this.extract_region_from_hint(stone_name, color_split, 1, this.worlds[0]);
                                }
                                let goal = new GraphHintGoal();
                                goal.item_count = 1;
                                let path = color_split[3];
                                if (Object.keys(path_locations).includes(path.toLowerCase())) {
                                    goal.location = this.worlds[0].get_location(path_locations[path.toLowerCase()]);
                                    if (!!hinted_group) this.hint_area_required_for_goal(hint_location, hinted_group, goal, true);
                                }
                                if (Object.keys(path_items).includes(path.toLowerCase())) {
                                    goal.item = this.worlds[0].get_item(path_items[path.toLowerCase()]);
                                    if (!!hinted_group) this.hint_area_required_for_goal(hint_location, hinted_group, goal, true);
                                }
                            } catch (e) {
                                console.log(`Trouble parsing spoiler gossip stone hint: path hint path could not be read for text ${hint.text}`);
                                if (e instanceof Error) {
                                    console.log(e.message);
                                }
                            }
                        } else {
                            // Check if hinted location is a region
                            if (color_split.length > 1) {
                                hinted_group = this.extract_region_from_hint(stone_name, color_split, 1, this.worlds[0]);
                                if (hinted_group === null) hinted_group = this.extract_region_from_hint(stone_name, color_split, 3, this.worlds[0]);
                            }
                            if (!!hinted_group) {
                                let hinted_item = this.worlds[0].get_item(hint.hinted_items[0]);
                                this.hint_item_in_area(hint_location, hinted_group, hinted_item, true);
                            // no match, must be location or dual hint
                            } else if (hint.hinted_locations.length === 2) {
                                let hinted_item = this.worlds[0].get_item(hint.hinted_items[0]);
                                let hinted_location = this.worlds[0].get_location(hint.hinted_locations[0]);
                                let hinted_item2 = this.worlds[0].get_item(hint.hinted_items[1]);
                                let hinted_location2 = this.worlds[0].get_location(hint.hinted_locations[1]);
                                this.hint_dual_locations(hint_location, hinted_location, hinted_item, hinted_location2, hinted_item2, true);
                            } else {
                                let hinted_item = this.worlds[0].get_item(hint.hinted_items[0]);
                                let hinted_location = this.worlds[0].get_location(hint.hinted_locations[0]);
                                this.hint_location(hint_location, hinted_location, hinted_item, true);
                            }
                        }
                        
                    // colors key filters out junk hints
                    } else if (!!hint.colors) {
                        // Have to filter for non-empty strings because important_check hints
                        // double up on ##region color## markers...
                        let color_split = hint.text.split('#').filter(t => t.length > 0);
                        let hinted_group: RegionGroup | null = null;
                        if (color_split.length > 1) {
                            hinted_group = this.extract_region_from_hint(stone_name, color_split, 1, this.worlds[0]);
                        }
                        if (!!hinted_group) {
                            if (hint.text.includes('a foolish choice')) {
                                this.hint_unrequired_area(hint_location, hinted_group, true);
                            } else if (hint.text.includes('major items')) {
                                try {
                                    let num_majors = parseInt(color_split[3]);
                                    if (num_majors === undefined || num_majors === null) throw(`Could not parse integer from ${color_split[3]}`);
                                    this.hint_area_num_items(hint_location, hinted_group, num_majors, true);
                                } catch (e) {
                                    console.log(`Trouble parsing spoiler gossip stone hint: important_check hint major items count is not a number in text ${hint.text}`);
                                    if (e instanceof Error) {
                                        console.log(e.message);
                                    }
                                }
                            }
                        }
                        // consider adding entrance hint detection, which needs the whole entrance hint table...
                    }
                    hint_location.hint_text = hint.text;
                }
            }
        }

        this.finalize_world();
        this.all_tricks_worlds = this.create_tricked_worlds();
        this.all_tricks_and_keys_worlds = this.create_tricked_worlds(true);
        this.create_searches();
        this.set_viewable_region_groups();
        this.reset_cache();
    }

    export(with_user_overrides: boolean = false, settings_only: boolean = false): any {
        let plando: OotrPlando = {
            ':version': this.ootr_version.to_string(),
            settings: this.worlds[0].settings,
            dungeons: {},
            trials: {},
            songs: {},
            entrances: {},
            locations: {},
            ':hint_text': {},
            ':checked': [],
            ':checked_entrances': [],
            ':tracked_hints': {},
        };
        if (this.settings_list.settings.world_count === 1) {
            if (Array.isArray(this.worlds[0].settings.mq_dungeons_specific)) {
                if (!!(this.settings_list.setting_definitions.mq_dungeons_specific?.choices)) {
                    for (let dungeon of Object.keys(this.settings_list.setting_definitions['mq_dungeons_specific'].choices)) {
                        plando.dungeons[dungeon] = this.worlds[0].settings.mq_dungeons_specific.includes(dungeon) ? 'mq' : 'vanilla';
                    }
                }
            }

            if (Array.isArray(this.worlds[0].settings.graphplugin_trials_specific)) {
                if (!!(this.settings_list.setting_definitions.graphplugin_trials_specific.choices)) {
                    for (let trial of Object.keys(this.settings_list.setting_definitions.graphplugin_trials_specific.choices)) {
                        plando.trials[trial] = this.worlds[0].settings.graphplugin_trials_specific.includes(trial) ? 'active' : 'inactive';
                    }
                }
            }

            if (!settings_only) {
                // this is either the full list of vanilla songs or, if melodies are randomized,
                // only known song melodies
                plando.songs = this.worlds[0].settings.graphplugin_song_melodies;

                plando[':tracked_hints'] = {};
                let locations = this.worlds[0].get_locations();
                for (let location of locations) {
                    if (location.type !== 'Event' && !!(location.item)) {
                        if (location.shuffled) {
                            let location_item: PlandoItem | string;
                            if (!!(location.item.price)) {
                                location_item = { item: location.item.name, price: location.item.price };
                            } else {
                                location_item = location.item.name;
                            }
                            plando.locations[location.name] = location_item;
                        } else if (with_user_overrides && !!location.user_item) {
                            let location_item: PlandoItem | string;
                            if (!!(location.user_item.price)) {
                                location_item = { item: location.user_item.name, price: location.user_item.price };
                            } else {
                                location_item = location.user_item.name;
                            }
                            plando.locations[location.name] = location_item;
                        }
                    }
                    if (location.checked && Array.isArray(plando[':checked'])) plando[':checked'].push(location.name);

                    // Hints are implemented as locations
                    if (location.is_hint) {
                        if (!!location.hint) {
                            let plando_hint: PlandoHint = { type: 'undefined' };
                            let location_item: PlandoItem | string;
                            switch (location.hint.type) {
                                case 'location':
                                    if (location.hint.location === undefined || location.hint.location === null) throw `Can't save location hint with undefined location ${location.name}`;
                                    if (location.hint.item === null) throw `Can't save location hint with undefined item ${location.name}`;
                                    if (!!(location.hint.item.price)) {
                                        location_item = { item: location.hint.item.name, price: location.hint.item.price };
                                    } else {
                                        location_item = location.hint.item.name;
                                    }
                                    plando_hint = {
                                        type: 'location',
                                        location: location.hint.location.name,
                                        item: location_item,
                                    }
                                    break;
                                case 'dual':
                                    if (location.hint.location === undefined || location.hint.location === null) throw `Can't save dual hint with undefined first location ${location.name}`;
                                    if (location.hint.item === null) throw `Can't save dual hint with undefined first item ${location.name}`;
                                    if (location.hint.location2 === undefined || location.hint.location2 === null) throw `Can't save dual hint with undefined second location ${location.name}`;
                                    if (location.hint.item2 === null) throw `Can't save dual hint with undefined second item ${location.name}`;
                                    if (!!(location.hint.item.price)) {
                                        location_item = { item: location.hint.item.name, price: location.hint.item.price };
                                    } else {
                                        location_item = location.hint.item.name;
                                    }
                                    let location_item2: PlandoItem | string;
                                    if (!!(location.hint.item2.price)) {
                                        location_item2 = { item: location.hint.item2.name, price: location.hint.item2.price };
                                    } else {
                                        location_item2 = location.hint.item2.name;
                                    }
                                    plando_hint = {
                                        type: 'dual',
                                        location: location.hint.location?.name,
                                        item: location_item,
                                        location2: location.hint.location2.name,
                                        item2: location_item2,
                                    }
                                    break;
                                case 'entrance':
                                    if (location.hint.entrance === undefined || location.hint.entrance === null || location.hint.entrance.original_connection === null) throw `Can't save entrance hint with undefined source entrance ${location.name}`;
                                    if (location.hint.target === null || location.hint.target.original_connection === null) throw `Can't save entrance hint with undefined target entrance ${location.name}`;
                                    plando_hint = {
                                        type: 'entrance',
                                        entrance: {
                                            source: { region: location.hint.entrance.original_connection.name, from: location.hint.entrance.parent_region.name },
                                            target: { region: location.hint.target.original_connection.name, from: location.hint.target.parent_region.name },
                                        }
                                    }
                                    break;
                                case 'woth':
                                    if (location.hint.area === undefined || location.hint.area === null) throw `Can't save woth hint with undefined region ${location.name}`;
                                    plando_hint = {
                                        type: 'woth',
                                        area: location.hint.area.name,
                                    }
                                    break;
                                case 'goal':
                                    if (location.hint.area === undefined || location.hint.area === null) throw `Can't save goal hint with undefined region ${location.name}`;
                                    if (location.hint.goal === undefined || location.hint.goal === null) throw `Can't save goal hint with undefined goal ${location.name}`;
                                    plando_hint = {
                                        type: 'goal',
                                        area: location.hint.area.name,
                                        goal: {
                                            location: location.hint.goal.location?.name,
                                            item: location.hint.goal.item?.name,
                                            item_count: location.hint.goal.item_count,
                                        }
                                    }
                                    break;
                                case 'foolish':
                                    if (location.hint.area === undefined || location.hint.area === null) throw `Can't save foolish hint with undefined region ${location.name}`;
                                    plando_hint = {
                                        type: 'foolish',
                                        area: location.hint.area.name,
                                    }
                                    break;
                                case 'important_check':
                                    if (location.hint.area === undefined || location.hint.area === null) throw `Can't save important check hint with undefined region ${location.name}`;
                                    if (location.hint.num_major_items === undefined || location.hint.num_major_items === null) throw `Can't save important check hint with undefined major item count ${location.name}`;
                                    plando_hint = {
                                        type: 'important_check',
                                        area: location.hint.area.name,
                                        num_major_items: location.hint.num_major_items,
                                    }
                                    break;
                                case 'misc':
                                    if (location.hint.area === undefined || location.hint.area === null) throw `Can't save misc hint with undefined region ${location.name}`;
                                    if (location.hint.item === undefined || location.hint.item === null) throw `Can't save misc hint with undefined item ${location.name}`;
                                    plando_hint = {
                                        type: 'misc',
                                        area: location.hint.area.name,
                                        item: location.hint.item.name,
                                    }
                                    break;
                                default:
                                    throw `Unknown hint type encountered while exporting: ${location.hint.type}`;
                            }
                            plando[':tracked_hints'][location.name] = plando_hint;
                        }
                        if (location.hint_text !== '') {
                            plando[':hint_text'][location.name] = location.hint_text;
                        }
                    }
                }
                plando[':tracked_hints']['temple_of_time_altar'] = {
                    type: 'fixed',
                    fixed_areas: Object.assign({}, this.worlds[0].fixed_item_area_hints),
                };
                plando[':tracked_hints']['pending_location_assignments'] = {
                    type: 'fixed',
                    fixed_areas: Object.assign({}, this.worlds[0].pending_reward_assignments),
                }

                let entrances = this.worlds[0].get_entrances();
                let simplified_target_types: string[] = [
                    'Interior',
                    'SpecialInterior',
                    'Grotto',
                    'Grave'
                ];
                for (let entrance of entrances) {
                    if (entrance.checked && Array.isArray(plando[':checked_entrances'])) plando[':checked_entrances'].push(entrance.name);
                    if ((!(entrance.coupled) || entrance.primary || entrance.type === 'Overworld')) {
                        if (entrance.shuffled && !!(entrance.replaces) && !!(entrance.replaces.type) && !!(entrance.connected_region)) {
                            let target: PlandoEntranceTarget | string;
                            if (simplified_target_types.includes(entrance.replaces.type) && entrance.replaces.primary) {
                                target = entrance.connected_region.name;
                            } else {
                                target = { 'region': entrance.connected_region.name, 'from': entrance.replaces.parent_region.name };
                            }
                            plando.entrances[entrance.name] = target;
                        // preserve user connections if they are overridden by an unshuffled entrance setting
                        } else if (with_user_overrides && !!entrance.user_connection && !!entrance.user_connection.type && !!entrance.user_connection.original_connection) {
                            let target: PlandoEntranceTarget | string;
                            if (simplified_target_types.includes(entrance.user_connection.type) && entrance.user_connection.primary) {
                                target = entrance.user_connection.original_connection.name;
                            } else {
                                target = { 'region': entrance.user_connection.original_connection.name, 'from': entrance.user_connection.parent_region.name };
                            }
                            plando.entrances[entrance.name] = target;
                        }
                    }
                }
            }
        } else {
        }

        if (!settings_only) {
            return plando;
        } else {
            return {
                ':version': plando[':version'],
                settings: plando.settings,
                dungeons: plando.dungeons,
                trials: plando.trials,
            }
        }
    }

    get_game_versions(): GraphGameVersions {
        let ootr: GraphGameVersions = {
            game: 'ootr',
            versions: [],
        };

        for (let v of this.version_list) {
            ootr.versions.push(new OotrVersion(v));
        }

        return ootr;
    }

    get_settings_presets(): string[] {
        return Object.keys(this.settings_list.settings_presets);
    }
    
    get_settings_preset(preset_name: string): any {
        if (Object.keys(this.settings_list.settings_presets).includes(preset_name)) {
            let plando = {
                settings: this.settings_list.settings_presets[preset_name],
                locations: {},
                entrances: {},
                ':checked': [],
            };
            return plando;
        } else {
            return null;
        }
    }

    get_settings_options(): GraphSettingsOptions {
        return this.settings_list.setting_definitions;
    }

    get_settings_layout(): GraphSettingsLayout {
        return this.settings_list.settings_layout;
    }

    check_location(location: GraphLocation): void {
        if (location.world === null) throw `Cannot check location ${location.name} with a null parent world`;
        let l = this.worlds[location.world.id].get_location(location.name);
        l.checked = true;
        this.set_viewable_region_groups();
    }

    uncheck_location(location: GraphLocation): void {
        if (location.world === null) throw `Cannot check location ${location.name} with a null parent world`;
        let l = this.worlds[location.world.id].get_location(location.name);
        l.checked = false;
        this.reset_searches();
        this.set_viewable_region_groups();
    }

    check_entrance(entrance: GraphEntrance): void {
        if (entrance.world === null) throw `Cannot check entrance ${entrance.name} with a null parent world`;
        let e = this.worlds[entrance.world.id].get_entrance(entrance.name);
        e.checked = true;
        this.set_viewable_region_groups();
    }

    uncheck_entrance(entrance: GraphEntrance): void {
        if (entrance.world === null) throw `Cannot check entrance ${entrance.name} with a null parent world`;
        let e = this.worlds[entrance.world.id].get_entrance(entrance.name);
        e.checked = false;
        this.reset_searches();
        this.set_viewable_region_groups();
    }

    collect_locations(): void {
        let all_locations = this.worlds.flatMap((world) => world.get_locations().filter((location) => { return !!location.item || location.shuffled }));
        this.search.collect_locations(all_locations);
        this.all_tricks_search.collect_locations(all_locations);
    }

    collect_spheres(): void {
        this.search.collect_spheres();
    }

    get_accessible_entrances(): Entrance[] {
        return Array.from(this.search._cache.visited_entrances);
    }

    get_visited_locations(): Location[] {
        return Array.from(this.search._cache.visited_locations);
    }

    // TODO: implement woth filter
    get_required_locations(): Location[] {
        return Array.from(this.search._cache.visited_locations);
    }

    get_accessible_entrances_for_world(world: GraphWorld): Entrance[] {
        return Array.from(this.search._cache.visited_entrances).filter((e: Entrance): boolean => e.world.id === world.id);
    }

    get_visited_locations_for_world(world: GraphWorld): Location[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    // TODO: implement woth filter
    get_required_locations_for_world(world: GraphWorld): Location[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    // TODO: implement goal filter
    get_required_locations_for_items(world: GraphWorld, goal_items: GraphItem[]): GraphLocation[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    get_collected_items_for_world(world: GraphWorld): {[item_name: string]: number} {
        return this.search.state_list[world.id].prog_items;
    }

    // filters collected items for some unshuffled items like skull tokens
    get_player_inventory_for_world(world: GraphWorld): {[item_name: string]: number} {
        return this.search.state_list[world.id].player_inventory;
    }

    get_item(world: World, item_name: string): GraphItem {
        return ItemFactory(item_name, world)[0];
    }

    add_starting_item(world: World, item: GraphItem, count: number = 1): void {
        let items = [item];
        for (let i = 1; i < count; i++) {
            items.push(item);
        }
        this.add_starting_items(world, items);
    }

    remove_starting_item(world: World, item: GraphItem, count: number = 1): void {
        let items = [item];
        for (let i = 1; i < count; i++) {
            items.push(item);
        }
        this.remove_starting_items(world, items);
    }

    add_starting_items(world: World, items: GraphItem[]): void {
        let current_starting_items = world.settings.starting_items ? Object.assign({}, world.settings.starting_items) : {};
        for (let item of items) {
            if (Object.keys(current_starting_items).includes(item.name)) {
                current_starting_items[item.name] += 1;
            } else {
                current_starting_items[item.name] = 1;
            }
        }
        this.change_setting(world, this.settings_list.setting_definitions['starting_items'], current_starting_items);
    }

    remove_starting_items(world: World, items: GraphItem[]): void {
        let current_starting_items = world.settings.starting_items ? Object.assign({}, world.settings.starting_items) : {};
        for (let item of items) {
            if (Object.keys(current_starting_items).includes(item.name)) {
                if (current_starting_items[item.name] > 1) {
                    current_starting_items[item.name] -= 1;
                } else {
                    delete current_starting_items[item.name];
                }
            }
        }
        this.change_setting(world, this.settings_list.setting_definitions['starting_items'], current_starting_items);
    }

    // one-for-one replacements only, mainly for changing bottle contents
    replace_starting_item(world: World, add_item: GraphItem, remove_item: GraphItem): void {
        let current_starting_items = world.settings.starting_items ? Object.assign({}, world.settings.starting_items) : {};
        if (Object.keys(current_starting_items).includes(remove_item.name)) {
            if (current_starting_items[remove_item.name] > 1) {
                current_starting_items[remove_item.name] -= 1;
            } else {
                delete current_starting_items[remove_item.name];
            }
        }
        if (Object.keys(current_starting_items).includes(add_item.name)) {
            current_starting_items[add_item.name] += 1;
        } else {
            current_starting_items[add_item.name] = 1;
        }
        this.change_setting(world, this.settings_list.setting_definitions['starting_items'], current_starting_items);
    }

    change_setting(world: World, setting: GraphSetting, value: GraphSettingType, { update_vanilla_items=true, update_setting_only=false, update_world_only=false, from_import=false, disabling_setting=false }: {update_vanilla_items?: boolean, update_setting_only?: boolean, update_world_only?: boolean, from_import?: boolean, disabling_setting?: boolean} = {}) {
        let new_setting_value: GraphSettingType;
        if (Object.keys(global_settings_overrides).includes(setting.name)) {
            new_setting_value = global_settings_overrides[setting.name];
        } else {
            new_setting_value = value;
        }
        let old_setting_value: GraphSettingType;
        if (Array.isArray(world.settings[setting.name])) {
            const setting_array = world.settings[setting.name] as string[];
            old_setting_value = [...setting_array];
        } else {
            old_setting_value = world.settings[setting.name];
        }
        world.settings[setting.name] = new_setting_value;
        if (!update_world_only) {
            if (setting.name !== 'world_count' && this.settings_list.settings.world_count > 1) {
                if (!(Object.keys(this.settings_list).includes('randomized_settings'))) {
                    this.settings_list.randomized_settings = {};
                }
                if (!(Object.keys(this.settings_list.randomized_settings).includes(`World ${world.id + 1}`))) {
                    this.settings_list.randomized_settings[`World ${world.id + 1}`] = {};
                }
                this.settings_list.randomized_settings[`World ${world.id + 1}`][setting.name] = new_setting_value;
            } else {
                // technically not safe to change world_count with update_world_only,
                // but what if I just don't do that?
                this.settings_list.settings[setting.name] = new_setting_value;
                if (Object.keys(this.settings_list).includes('randomized_settings')) {
                    if (Object.keys(this.settings_list.randomized_settings).includes(setting.name)) {
                        this.settings_list.randomized_settings[setting.name] = new_setting_value;
                    }
                }
            }
        }
        switch(setting.name) {
            case 'allowed_tricks':
                if (!!(this.settings_list.setting_definitions.allowed_tricks.choices)) {
                    for (let trick of Object.keys(this.settings_list.setting_definitions.allowed_tricks.choices)) {
                        if (Array.isArray(value) && value.includes(trick)) {
                            world.settings[trick] = true;
                        } else {
                            world.settings[trick] = false;
                        }
                    }
                }
                break;
            case 'mq_dungeons_specific':
                if (Array.isArray(value)) {
                    for (let [dungeon, is_mq] of Object.entries(world.dungeon_mq)) {
                        if (value.includes(dungeon) && !is_mq) {
                            world.dungeon_mq[dungeon] = true;
                            world.swap_dungeon(`${dungeon} MQ`, dungeon);
                        } else if (!(value.includes(dungeon)) && is_mq) {
                            world.dungeon_mq[dungeon] = false;
                            world.swap_dungeon(dungeon, `${dungeon} MQ`);
                        }
                    }
                } else {
                    for (let [dungeon, is_mq] of Object.entries(world.dungeon_mq)) {
                        if (is_mq) {
                            // disable all mq
                            world.dungeon_mq[dungeon] = false;
                            world.swap_dungeon(dungeon, `${dungeon} MQ`);
                        }
                    }
                }
                break;
            case 'graphplugin_trials_specific':
                if (Array.isArray(value)) {
                    for (let trial_name of Object.keys(world.skipped_trials)) {
                        if (value.includes(trial_name)) {
                            world.skipped_trials[trial_name] = false;
                        } else {
                            world.skipped_trials[trial_name] = true;
                        }
                    }
                } else {
                    world.skipped_trials = {
                        "Forest": false,
                        "Fire":   false,
                        "Water":  false,
                        "Spirit": false,
                        "Shadow": false,
                        "Light":  false
                    }
                }
                break;
            case 'graphplugin_song_melodies':
                let changed_songs: {[song_name: string]: string} = {};
                if (!!value && typeof(value) === 'object' && !Array.isArray(value)) {
                    changed_songs = <{[song: string]: string}>value;
                } else {
                    changed_songs = {
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
                    };
                }
                for (let [song_name, melody] of Object.entries(changed_songs)) {
                    world.song_notes[song_name] = melody;
                    world.settings.graphplugin_song_melodies[song_name] = melody;
                    this.settings_list.settings.graphplugin_song_melodies[song_name] = melody;
                }
                break;
            // Next 3 cases reset the saved dungeon reward hints when the pool
            // the hints draw from changes
            case 'mix_entrance_pools':
                if (world.settings.shuffle_bosses !== 'off'
                && (!(Object.keys(world.settings).includes('shuffle_dungeon_rewards')) || (!!world.settings.shuffle_dungeon_rewards && ['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards)))
                && ((Array.isArray(old_setting_value) && Array.isArray(new_setting_value) && old_setting_value.includes('Boss') && !(new_setting_value.includes('Boss')))
                || (Array.isArray(old_setting_value) && Array.isArray(new_setting_value) && !(old_setting_value.includes('Boss')) && new_setting_value.includes('Boss'))
                || (Array.isArray(old_setting_value) && !(Array.isArray(new_setting_value)) && old_setting_value.includes('Boss'))
                || (!(Array.isArray(old_setting_value)) && Array.isArray(new_setting_value) && new_setting_value.includes('Boss')))) {
                    world.initialize_fixed_item_area_hints();
                }
                break;
            case 'shuffle_bosses':
                if (Object.keys(world.settings).includes('mix_entrance_pools') && Array.isArray(world.settings.mix_entrance_pools) && world.settings.mix_entrance_pools.includes('Boss')
                && (!(Object.keys(world.settings).includes('shuffle_dungeon_rewards')) || (!!world.settings.shuffle_dungeon_rewards && ['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards)))) {
                    world.initialize_fixed_item_area_hints();
                }
                break;
            case 'shuffle_dungeon_rewards':
                if ((typeof old_setting_value === 'string' && ['vanilla', 'reward'].includes(old_setting_value) && typeof new_setting_value === 'string' && !(['vanilla', 'reward'].includes(new_setting_value)))
                || (typeof old_setting_value === 'string' && !(['vanilla', 'reward'].includes(old_setting_value)) && typeof new_setting_value === 'string' && ['vanilla', 'reward'].includes(new_setting_value))) {
                    world.initialize_fixed_item_area_hints();
                }
                break;
            case 'graphplugin_viewable_unshuffled_items':
                world.viewable_unshuffled_items = [];
                if (!!new_setting_value && Array.isArray(new_setting_value)) {
                    for (let option of new_setting_value) {
                        if (Object.keys(option_to_item_names).includes(option)) {
                            world.viewable_unshuffled_items.push(...option_to_item_names[option]);
                        }
                    }
                }
                world.initialize_locations();
                break;
            case 'graphplugin_world_search_mode':
                switch (value) {
                    case 'starting_items':
                        world.collect_as_starting_items = true;
                        world.collect_checked_only = true;
                        break;
                    case 'collected':
                        world.collect_as_starting_items = false;
                        world.collect_checked_only = true;
                        break;
                    case 'known':
                    default:
                        world.collect_as_starting_items = false;
                        world.collect_checked_only = false;
                        break;
                }
                break;
            case 'graphplugin_region_visibility_mode':
                switch(value) {
                    case 'tricks':
                        world.visit_all_entrances = false;
                        world.visit_all_connected_entrances = false;
                        world.visit_all_trick_entrances = true;
                        break;
                    case 'connected':
                        world.visit_all_entrances = false;
                        world.visit_all_connected_entrances = true;
                        world.visit_all_trick_entrances = true;
                        break;
                    case 'always':
                        world.visit_all_entrances = true;
                        world.visit_all_connected_entrances = true;
                        world.visit_all_trick_entrances = true;
                        break;
                    case 'matching':
                    default:
                        world.visit_all_entrances = false;
                        world.visit_all_connected_entrances = false;
                        world.visit_all_trick_entrances = false;
                        break;
                }
                break;
            default:
                break;
        }
        for (let remote_setting of setting.disables) {
            if (!(this.disabled_settings.includes(remote_setting)) && remote_setting.disabled(world.settings)) {
                this.disabled_settings.push(remote_setting);
                // Only save the old setting before disabling if this was an individual setting change from the user,
                // not part of multiple changes from a plando. Otherwise this leads to settings inconsistency post-import.
                this.change_setting(world, remote_setting, remote_setting.disabled_default, {update_setting_only: true, disabling_setting: !from_import});
            }
        }
        // Save user setting preference to restore when undisabled, validating that the option exists.
        // This has to run after the disabled settings loop to ensure the previous user value is saved,
        // not a default value from multiple hits in the disabled loop.
        if (disabling_setting) {
            if (setting_options_include_value(this.settings_list.setting_definitions[setting.name], old_setting_value)) {
                world.disabled_settings[setting.name] = old_setting_value;
            } else {
                world.disabled_settings[setting.name] = this.settings_list.setting_definitions[setting.name].default;
            }
        }
        if (update_setting_only) return;
        // Reset settings that were disabled but are no longer to their previous values
        // because some of the disabled_default values are invalid settings....
        while (true) {
            // Boolean is changed if a setting is changed, which could cascade to further disabled settings changes
            let undisabled_setting = false;
            for (let [setting_name, setting_def] of Object.entries(this.settings_list.setting_definitions)) {
                if (!setting_def.disabled(world.settings)) {
                    if (Object.keys(world.disabled_settings).includes(setting_name)) {
                        this.change_setting(world, setting_def, world.disabled_settings[setting_name], {update_setting_only: true});
                        delete world.disabled_settings[setting_name];
                        undisabled_setting = true;
                    } else if (!setting_options_include_value(setting_def, world.settings[setting_name])) {
                        this.change_setting(world, setting_def, setting_def.default, {update_setting_only: true});
                        undisabled_setting = true;
                    }
                    // If the disabled option is a valid setting and there was no user option stored, leave it as-is.
                }
            }
            if (!undisabled_setting) break;
        }
        world.update_internal_settings();
        // updates unshuffled items
        // can be disabled for bulk setting updates to avoid looping through locations repeatedly,
        // but this requires running set_items manually
        world.state.reset();
        this.reset_cache();
        if (update_vanilla_items) {
            let world_fill = this.export(true);
            let checked_locations: PlandoCheckedLocationList | PlandoMWCheckedLocationList = [];
            if (Object.keys(world_fill).includes(':checked')) {
                checked_locations = world_fill[':checked'];
            }
            let checked_entrances: PlandoCheckedEntranceList | PlandoMWCheckedEntranceList = [];
            if (Object.keys(world_fill).includes(':checked_entrances')) {
                checked_entrances = world_fill[':checked_entrances'];
            }
            this.set_items(world_fill.locations, checked_locations);
            this.set_entrances(world_fill.entrances, checked_entrances);
            this.set_blue_warps(world);
            this.set_shop_rules(world);
            world.state.collect_starting_items();
            world.collect_skipped_locations();
            if (!update_world_only) {
                this.all_tricks_worlds = this.create_tricked_worlds();
                this.all_tricks_and_keys_worlds = this.create_tricked_worlds(true);
            }
        }
        if (!update_world_only) this.create_searches();
        if (update_vanilla_items && !update_world_only) this.set_viewable_region_groups();
        this.disabled_settings = [];
    }

    set_location_item(location: GraphLocation, item: GraphItem | null, price: number = -1, not_clearing_old_hint: boolean = true): void {
        if (location.world !== null) {
            let l: Location = this.worlds[location.world.id].get_location(location.name);
            if (!!item) {
                if (!!location.item) {
                    this.reset_searches();
                }
                let i: Item = ItemFactory(item.name, l.world)[0];
                // update dungeon reward hints before changing the item so
                // we can clear replaced dungeon items if necessary
                this.try_set_hinted_area_for_item(i.name, location.world, location);
                l.item = i;
                i.location = l;
                if (price >= 0) {
                    location.price = price;
                }
                if (!!location.price) {
                    l.price = location.price;
                    i.price = location.price;
                }
                l.user_item = i;
                this.try_hint_compass(l, false);
                this.try_hint_reward(l, false);
            } else {
                if (!!l.item) {
                    if (Object.keys(location.world.fixed_item_area_hints).includes(l.item.name) && not_clearing_old_hint) {
                        location.world.fixed_item_area_hints[l.item.name] = {
                            hint: '????',
                            hinted: false,
                            hint_locations: [],
                        };
                    }
                }
                this.try_hint_compass(l, true);
                this.try_hint_reward(l, true);
                l.item = null;
                l.price = null;
                l.user_item = null;
                this.reset_searches();
            }
            this.set_shop_rule(l);
        } else {
            throw `Attempted to set item for location in non-existent world: ${location.name}`;
        }
        this.set_viewable_region_groups();
    }

    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance | null): void {
        let e = this.worlds[entrance.world.id].get_entrance(entrance.name);
        if (!!replaced_entrance) {
            let t = this.worlds[entrance.world.id].get_entrance(replaced_entrance.name);
            // If both the entrance and target use the same grouped alias name,
            // force the entrance to link to the vanilla target. This ensures
            // that tracked child locations stay in the same world location if
            // the entrance rando setting is turned off (such as with mystery settings)
            if (e.use_target_alias && t.use_target_alias && e.target_alias === t.target_alias) {
                t = e;
            }
            if (e.original_connection === null || t.original_connection === null) {
                throw `Attempted to connect entrances with undefined original connections: ${e.name} to ${t.name}`;
            }
            e.connect(t.original_connection);
            e.replaces = t;
            e.user_connection = t;
            if (!!(e.reverse) && !!(t.reverse) && !!(e.reverse.original_connection) && e.coupled) {
                t.reverse.connect(e.reverse.original_connection);
                t.reverse.replaces = e.reverse;
                t.reverse.user_connection = e.reverse;
            }
            // has to run after the reverse is linked to look up the linked dungeon for boss shuffle
            e.world.add_hinted_dungeon_reward(e);
            if (!!(e.reverse) && !!(t.reverse) && !!(e.reverse.original_connection) && e.coupled) {
                t.reverse.world.add_hinted_dungeon_reward(t.reverse);
            }
        } else if (!!e.connected_region) {
            if (!!(e.replaces?.reverse) && e.coupled && !!(e.replaces.reverse.connected_region)) {
                e.replaces.reverse.world.remove_hinted_dungeon_reward(e.replaces.reverse);
                e.replaces.reverse.disconnect();
                e.replaces.reverse.replaces = null;
                e.replaces.reverse.user_connection = null;
            }
            e.world.remove_hinted_dungeon_reward(e);
            e.disconnect();
            e.replaces = null;
            e.user_connection = null;
            this.reset_searches();
        }
        // link blue warp to boss room exit
        if (!!e.type && ['ChildBoss', 'AdultBoss'].includes(e.type)) {
            let boss_exit: Entrance | null = null;
            if (e.primary && e.coupled && !!e.replaces) {
                boss_exit = e.replaces.reverse;
            } else if (e.secondary) {
                boss_exit = e;
            }
            if (!!boss_exit) {
                let blue_warp: Entrance | null = null;
                let blue_warp_search_region = !!e.replaces ? e.replaces.reverse : e.reverse;
                if (!!blue_warp_search_region) {
                    for (let exit of blue_warp_search_region.parent_region.exits) {
                        if (exit.type === 'BlueWarp') {
                            blue_warp = exit;
                        }
                    }
                    if (!!blue_warp) {
                        this.set_blue_warp(blue_warp, boss_exit);
                    }
                }
            }
        }
        this.set_viewable_region_groups();
    }

    // Used for sim mode to modify the world when finding the hint, but
    // keeping the hint cached on the hint location until checked
    unhide_hint(hint_location: GraphLocation) {
        if (!!hint_location.hint) {
            let hint = hint_location.hint;
            switch (hint_location.hint.type) {
                case 'location':
                    if (!!hint.location && !!hint.item)
                        this.hint_location(hint_location, hint.location, hint.item);
                    break;
                case 'dual':
                    if (!!hint.location && !!hint.item && !!hint.location2 && !!hint.item2)
                        this.hint_dual_locations(hint_location, hint.location, hint.item, hint.location2, hint.item2);
                    break;
                case 'entrance':
                    if (!!hint.entrance && !!hint.entrance.replaces)
                        this.hint_entrance(hint_location, hint.entrance, hint.entrance.replaces);
                    break;
                case 'woth':
                    if (!!hint.area)
                        this.hint_required_area(hint_location, hint.area);
                    break;
                case 'goal':
                    if (!!hint.area && !!hint.goal)
                        this.hint_area_required_for_goal(hint_location, hint.area, hint.goal);
                    break;
                case 'foolish':
                    if (!!hint.area)
                        this.hint_unrequired_area(hint_location, hint.area);
                    break;
                case 'misc':
                    if (!!hint.area && !!hint.item)
                        this.hint_item_in_area(hint_location, hint.area, hint.item);
                    break;
                case 'important_check':
                    if (!!hint.area && hint.num_major_items !== null)
                        this.hint_area_num_items(hint_location, hint.area, hint.num_major_items);
                    break;
            }
        }
    }

    hint_location(hint_location: GraphLocation, hinted_location: GraphLocation, item: GraphItem, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            this.set_location_item(hinted_location, item);
            hinted_location.hinted = true;
        }
        let hint = new Hint('location');
        hint.location = hinted_location;
        hint.item = item;
        hint_location.hint = hint;
    }

    hint_dual_locations(hint_location: GraphLocation, hinted_location1: GraphLocation, item1: GraphItem, hinted_location2: GraphLocation, item2: GraphItem, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            this.set_location_item(hinted_location1, item1);
            hinted_location1.hinted = true;
            this.set_location_item(hinted_location2, item2);
            hinted_location2.hinted = true;
        }
        let hint = new Hint('dual');
        hint.location = hinted_location1;
        hint.item = item1;
        hint.location2 = hinted_location2;
        hint.item2 = item2;
        hint_location.hint = hint;
    }

    hint_entrance(hint_location: GraphLocation, hinted_entrance: GraphEntrance, replaced_entrance: GraphEntrance, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            this.set_entrance(hinted_entrance, replaced_entrance);
            hinted_entrance.hinted = true;
            if (!!(hinted_entrance.reverse) && !!(replaced_entrance.reverse) && !!(hinted_entrance.reverse.original_connection) && hinted_entrance.coupled) {
                replaced_entrance.reverse.hinted = true;
            }
        }
        let hint = new Hint('entrance');
        hint.entrance = hinted_entrance;
        hint.target = replaced_entrance;
        hint_location.hint = hint;
    }

    hint_required_area(hint_location: GraphLocation, hinted_area: GraphRegion, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            hinted_area.is_required = true;
        }
        let hint = new Hint('woth');
        hint.area = hinted_area;
        hint_location.hint = hint;
    }

    hint_area_required_for_goal(hint_location: GraphLocation, hinted_area: GraphRegion, hinted_goal: GraphHintGoal, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden && !(hinted_area.required_for.filter(g => g.equals(hinted_goal)).length > 0)) {
            hinted_area.required_for.push(hinted_goal);
        }
        let hint = new Hint('goal');
        hint.area = hinted_area;
        hint.goal = hinted_goal;
        hint_location.hint = hint;
    }

    hint_unrequired_area(hint_location: GraphLocation, hinted_area: GraphRegion, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            hinted_area.is_not_required = true;
        }
        let hint = new Hint('foolish');
        hint.area = hinted_area;
        hint_location.hint = hint;
    }

    hint_item_in_area(hint_location: GraphLocation, hinted_area: GraphRegion, hinted_item: GraphItem, initially_hidden: boolean = false) {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden && !(hinted_area.hinted_items.map(i => i.name).includes(hinted_item.name))) {
            hinted_area.hinted_items.push(hinted_item);
        }
        let hint = new Hint('misc'); // covers Ganondorf Light Arrow hint and Dampe Diary hint
        hint.area = hinted_area;
        hint.item = hinted_item;
        hint_location.hint = hint;
    }

    hint_area_num_items(hint_location: GraphLocation, hinted_area: GraphRegion, num_major_items: number, initially_hidden: boolean = false): void {
        if (!!hint_location.hint) {
            this.unhint(hint_location);
        }
        if (!initially_hidden) {
            hinted_area.num_major_items = num_major_items;
        }
        let hint = new Hint('important_check');
        hint.area = hinted_area;
        hint.num_major_items = num_major_items;
        hint_location.hint = hint;
    }

    unhint(hint_location: GraphLocation, importing: boolean = false) {
        if (hint_location.world === null) throw `Can't unset hint location with unknown world: ${hint_location.name}`;
        let world = this.worlds[hint_location.world.id];
        let hint_copies = 0;
        for (let location of world.get_locations()) {
            if (location.is_hint && !!location.hint && !!hint_location.hint && location.hint.equals(hint_location.hint)) {
                hint_copies++; // includes the hint we are unhinting!
            }
        }
        if (hint_copies <= 1) {
            if (hint_location.hint?.type === 'location' && !!hint_location.hint.location && !importing) {
                this.set_location_item(hint_location.hint.location, null);
            } else if (hint_location.hint?.type === 'dual' && !!hint_location.hint.location && !!hint_location.hint.location2 && !importing) {
                this.set_location_item(hint_location.hint.location, null);
                this.set_location_item(hint_location.hint.location2, null);
            } else if (hint_location.hint?.type === 'entrance' && !!hint_location.hint.entrance && !importing) {
                this.set_entrance(hint_location.hint.entrance, null);
            } else if (hint_location.hint?.type === 'woth' && !!hint_location.hint.area) {
                hint_location.hint.area.is_required = false;
            } else if (hint_location.hint?.type === 'goal' && !!hint_location.hint.area && !!hint_location.hint.goal) {
                let hinted_area = hint_location.hint.area;
                let area_paths: GraphHintGoal[] = [];
                for (let path of hinted_area.required_for) {
                    if (!(path.item?.name === hint_location.hint.goal.item?.name &&
                        path.location?.name === hint_location.hint.goal.location?.name &&
                        path.item_count === hint_location.hint.goal.item_count)) {
                        area_paths.push(path);
                    }
                }
                hinted_area.required_for = area_paths;
            } else if (hint_location.hint?.type === 'foolish' && !!hint_location.hint.area) {
                hint_location.hint.area.is_not_required = false;
            } else if (hint_location.hint?.type === 'important_check' && !!hint_location.hint.area) {
                hint_location.hint.area.num_major_items = null;
            } else if (hint_location.hint?.type === 'misc' && !!hint_location.hint.item && !!hint_location.hint.area && hint_location.hint.area.hinted_items.length > 0) {
                let area_items: GraphItem[] = [];
                for (let hinted_item of hint_location.hint.area.hinted_items) {
                    if (hinted_item.name !== hint_location.hint.item.name) {
                        area_items.push(hinted_item);
                    }
                }
                hint_location.hint.area.hinted_items = area_items;
            }
        }
        hint_location.hint = null;
    }

    extract_region_from_hint = (stone_name: string, color_split: string[], split_index: number, world: World) => {
        let hinted_group: RegionGroup | null = null;
        if (split_index < color_split.length) {
            let hint_area = color_split[split_index];
            //console.log(`Matching hint for ${stone_name} to region filter ${hint_area}`);
            let matched_regions = world.regions.filter(r => r.hint()?.str === hint_area && !!r.parent_group);
            //console.log(`Found ${matched_regions.length} regions`);
            if (matched_regions.length > 0) {
                //console.log(`Using surrogate region ${matched_regions[0].name} for parent group selection`);
                hinted_group = matched_regions[0].parent_group;
                /*if (!!hinted_group) {
                    console.log(`Set region group to ${hinted_group.name}`);
                } else {
                    console.log(`Something went wrong, set hinted group to null`);
                }*/
            }
        }
        return hinted_group
    }

    cycle_hinted_areas_for_item(item_name: string, graph_world: GraphWorld, forward: boolean = true): {hint: string, hinted: boolean} {
        let cycle_areas = (item_name: string, world: World, forward: boolean, targets: string[]) => {
            let area_index = targets.indexOf(world.fixed_item_area_hints[item_name].hint);
            let prev_index = area_index;
            if (area_index === -1) throw `Unable to find fixed item area ${world.fixed_item_area_hints[item_name].hint}`;
            let hinted_reward_areas = Object.values(world.fixed_item_area_hints).map(h => h.hint);
            if (forward) {
                if (area_index >= targets.length - 1) {
                    area_index = 0;
                } else {
                    area_index++;
                }
                while(Object.values(hinted_reward_areas).includes(targets[area_index]) && targets[area_index] !== '????') {
                    if (area_index === prev_index) {
                        throw `Could not cycle hint areas for reward ${item_name}: all hintable areas already in use`;
                    }
                    if (area_index >= targets.length - 1) {
                        area_index = 0;
                    } else {
                        area_index++;
                    }
                }
            } else {
                if (area_index <= 0) {
                    area_index = targets.length - 1;
                } else {
                    area_index--;
                }
                while(Object.values(hinted_reward_areas).includes(targets[area_index]) && targets[area_index] !== '????') {
                    if (area_index === prev_index) {
                        throw `Could not cycle hint areas for reward ${item_name}: all hintable areas already in use`;
                    }
                    if (area_index <= 0) {
                        area_index = targets.length - 1;
                    } else {
                        area_index--;
                    }
                }
            }
            return [targets[area_index], targets[prev_index]];
        }
        let world = this.worlds[graph_world.id]; // "casts" from GraphWorld to World
        if (Object.keys(world.fixed_item_area_hints).includes(item_name)) {
            let reward_item = world.get_item(item_name);
            if (!!(world.settings.shuffle_dungeon_rewards) && !(['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards))) {
                let prev_area: string;
                let item_area_targets = Object.values(HintAreas).map(a => a.abbreviation);
                item_area_targets.push('????');
                [world.fixed_item_area_hints[item_name].hint, prev_area] = cycle_areas(item_name, world, forward, item_area_targets);
            } else if (world.mixed_pools_bosses) {
                let item_boss_targets = Object.values(HintAreas).map(a => a.abbreviation);
                item_boss_targets.push('????');
                let [reward_boss, prev_boss] = cycle_areas(item_name, world, forward, item_boss_targets);
                world.fixed_item_area_hints[item_name].hint = reward_boss;
                if (!(['????', 'FREE'].includes(reward_boss))) {
                    let boss_location = world.get_location(bossToRewardMap[reward_boss]);
                    this.set_location_item(boss_location, reward_item, undefined, false);
                }
                if (!(['????', 'FREE'].includes(prev_boss))) {
                    let boss_location = world.get_location(bossToRewardMap[prev_boss]);
                    this.set_location_item(boss_location, null, undefined, false);
                }
                if (reward_boss === 'FREE') {
                    let boss_location = world.get_location("Links Pocket");
                    this.set_location_item(boss_location, reward_item, undefined, false);
                    world.fixed_item_area_hints[item_name].hinted = true;
                }
                if (prev_boss === 'FREE') {
                    let boss_location = world.get_location("Links Pocket");
                    this.set_location_item(boss_location, null, undefined, false);
                }
                this.reset_searches();
            } else {
                let item_dungeon_targets = Object.keys(dungeonToEntranceMap);
                item_dungeon_targets.push('????');
                item_dungeon_targets.push('FREE');
                let [reward_dungeon, prev_dungeon] = cycle_areas(item_name, world, forward, item_dungeon_targets);
                console.log(`New dungeon: ${reward_dungeon}, Old dungeon: ${prev_dungeon}`);
                world.fixed_item_area_hints[item_name].hint = reward_dungeon;
                if (!(['????', 'FREE'].includes(reward_dungeon))) {
                    let dungeon_boss_entrance = world.get_entrance(dungeonToEntranceMap[reward_dungeon]);
                    world.add_hinted_dungeon_reward(dungeon_boss_entrance, reward_item);
                }
                if (!(['????', 'FREE'].includes(prev_dungeon))) {
                    let dungeon_boss_entrance = world.get_entrance(dungeonToEntranceMap[prev_dungeon]);
                    world.remove_hinted_dungeon_reward(dungeon_boss_entrance, true);
                }
                if (reward_dungeon === 'FREE') {
                    let boss_location = world.get_location("Links Pocket");
                    this.set_location_item(boss_location, reward_item, undefined, false);
                    world.fixed_item_area_hints[item_name].hinted = true;
                }
                if (prev_dungeon === 'FREE') {
                    let boss_location = world.get_location("Links Pocket");
                    this.set_location_item(boss_location, null, undefined, false);
                }
                this.reset_searches();
            }
            this.set_viewable_region_groups();
        } else {
            world.fixed_item_area_hints[item_name] = {
                hint: '????',
                hinted: false,
                hint_locations: [],
            }
        }
        return world.fixed_item_area_hints[item_name];
    }

    // Call when setting an item location to a dungeon reward
    // to update any previously unknown hints.
    try_set_hinted_area_for_item(item_name: string, graph_world: GraphWorld, location: GraphLocation, importing: boolean = false) {
        let world = this.worlds[graph_world.id]; // "casts" from GraphWorld to World
        if (Object.keys(world.fixed_item_area_hints).includes(item_name)) {
            // Clear previous item hint if necessary
            if (!!location.item && location.item.name !== item_name && Object.keys(world.fixed_item_area_hints).includes(location.item.name)) {
                world.fixed_item_area_hints[location.item.name] = {
                    hint: '????',
                    hinted: false,
                    hint_locations: [],
                }
            }
            let reward_dungeon: string;
            try {
                if (!!(world.settings.shuffle_dungeon_rewards) && !(['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards))) {
                    // Search out from entrances to the target region to find a top level region with an alias.
                    // Entrance search instead of exit because decoupled breaks the entrance/exit relationship.
                    // If there are multiple ways in through connector regions, there are potentially multiple
                    // answers to which top level region to use. The shortest path is always chosen. 
                    let world_location = world.get_location(location.name);
                    let parent_region = HintArea.at(world_location, false);
                    if (parent_region === null) throw `Could not update dungeon reward hint for disconnected location ${location.name}`;
                    reward_dungeon = parent_region.abbreviation;
                } else if (world.mixed_pools_bosses) {
                    reward_dungeon = rewardToBossMap[location.name];
                    let prev_boss = world.fixed_item_area_hints[item_name].hint;
                    if (!!prev_boss && !importing) {
                        if (!(['????', 'FREE'].includes(prev_boss))) {
                            let boss_location = world.get_location(bossToRewardMap[prev_boss]);
                            this.set_location_item(boss_location, null, undefined, false);
                        }
                        if (prev_boss === 'FREE') {
                            let boss_location = world.get_location("Links Pocket");
                            this.set_location_item(boss_location, null, undefined, false);
                        }
                    }
                } else {
                    let prev_dungeon = world.fixed_item_area_hints[item_name].hint;
                    if (location.name === 'Links Pocket') {
                        reward_dungeon = 'FREE';
                    } else {
                        let boss_exit = world.get_entrance(bossRewardToEntranceMap[location.name]);
                        let connected_dungeon_exit = !!boss_exit.reverse?.replaces ? boss_exit.reverse.replaces.reverse : boss_exit;
                        if (connected_dungeon_exit === null) throw `Could not update dungeon reward hint for disconnected boss region`;
                        reward_dungeon = entranceToDungeonMap[connected_dungeon_exit.name];
                    }
                    if (!!prev_dungeon && !importing) {
                        if (!(['????', 'FREE'].includes(prev_dungeon))) {
                            let dungeon_boss_entrance = world.get_entrance(dungeonToEntranceMap[prev_dungeon]);
                            world.remove_hinted_dungeon_reward(dungeon_boss_entrance, true);
                        }
                        if (prev_dungeon === 'FREE') {
                            let boss_location = world.get_location("Links Pocket");
                            this.set_location_item(boss_location, null, undefined, false);
                        }
                    }
                }
            } catch (e) {
                // Safe default to return to if any of the location/entrance lookups fail.
                // This may result in a disconnect between location fill and hints
                console.log(e);
                reward_dungeon = '????';
            }
            world.fixed_item_area_hints[item_name].hint = reward_dungeon;
        }
        // No need to reset searches as this is handled in set_location_item
    }

    try_hint_compass(l: GraphLocation, unhint: boolean = false) {
        if (!!l.item && !!l.world && !unhint) {
            if (l.item.name.includes('Compass')) {
                let world = this.worlds[l.world.id];
                let tricked_state = this.all_tricks_search.state_list[world.id];
                if (tricked_state === null || tricked_state === undefined) tricked_state = new WorldState(world);
                let compass_hint = world.settings.enhance_map_compass === undefined ? false : world.settings.enhance_map_compass;
                if (compass_hint) {
                    if ((!!(world.settings.shuffle_dungeon_rewards) &&
                    !(['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards))) ||
                    world.mixed_pools_bosses) {
                        if (Object.keys(compassToItemMap).includes(l.item.name)) {
                            let reward_item = compassToItemMap[l.item.name];
                            world.fixed_item_area_hints[reward_item].hint_locations.push(l.name);
                        }
                    } else {
                        for (let hint_data of Object.values(world.fixed_item_area_hints)) {
                            if (Object.keys(dungeonToCompassMap).includes(hint_data.hint) && dungeonToCompassMap[hint_data.hint] === l.item.name) {
                                hint_data.hint_locations.push(l.name);
                            }
                        }
                    }
                }
            }
        } else if (!!l.item && !!l.world) {
            if (l.item.name.includes('Compass')) {
                let world = this.worlds[l.world.id];
                let tricked_state = this.all_tricks_search.state_list[world.id];
                if (tricked_state === null || tricked_state === undefined) tricked_state = new WorldState(world);
                let compass_hint = world.settings.enhance_map_compass === undefined ? false : world.settings.enhance_map_compass;
                if (compass_hint) {
                    if ((!!(world.settings.shuffle_dungeon_rewards) &&
                    !(['vanilla', 'reward'].includes(world.settings.shuffle_dungeon_rewards))) ||
                    world.mixed_pools_bosses) {
                        if (Object.keys(compassToItemMap).includes(l.item.name)) {
                            let reward_item = compassToItemMap[l.item.name];
                            let new_locations: string[] = [];
                            for (let hl of world.fixed_item_area_hints[reward_item].hint_locations) {
                                if (hl !== l.name) {
                                    new_locations.push(hl);
                                }
                            }
                            world.fixed_item_area_hints[reward_item].hint_locations = new_locations;
                        }
                    } else {
                        for (let hint_data of Object.values(world.fixed_item_area_hints)) {
                            if (Object.keys(dungeonToCompassMap).includes(hint_data.hint) && dungeonToCompassMap[hint_data.hint] === l.item.name) {
                                hint_data.hint_locations.push(l.name);
                                let new_locations: string[] = [];
                                for (let hl of hint_data.hint_locations) {
                                    if (hl !== l.name) {
                                        new_locations.push(hl);
                                    }
                                }
                                hint_data.hint_locations = new_locations;
                            }
                        }
                    }
                }
            }
        }
    }

    try_hint_reward(l: GraphLocation, unhint: boolean = false) {
        if (l.name !== 'Links Pocket') {
            if (!!l.item && !!l.world && !unhint) {
                let world = this.worlds[l.world.id];
                if (Object.keys(l.world.fixed_item_area_hints).includes(l.item.name)) {
                    world.fixed_item_area_hints[l.item.name].hint_locations.push(l.name);
                }
            } else if (!!l.item && !!l.world) {
                let world = this.worlds[l.world.id];
                if (Object.keys(l.world.fixed_item_area_hints).includes(l.item.name)) {
                    let new_locations: string[] = [];
                    for (let hl of world.fixed_item_area_hints[l.item.name].hint_locations) {
                        if (hl != l.name) {
                            new_locations.push(hl);
                        }
                    }
                    world.fixed_item_area_hints[l.item.name].hint_locations = new_locations;
                }
            }
        }
    }

    get_full_exit_pool(world: World): GraphEntrancePool {
        let pool: GraphEntrancePool = {};
        let all_exits = world.region_groups.filter(r => r.page !== '').flatMap(r => r.exits).filter(e => !(e.is_reverse()) && e.shuffled);
        for (let exit of all_exits) {
            let type_alias = !!exit.source_group ? exit.source_group.name : 'Unknown Region';
            if (!(Object.keys(pool).includes(type_alias))) pool[type_alias] = [];
            pool[type_alias].push(exit);
        }
        return pool;
    }

    get_full_entrance_pool(world: World): GraphEntrancePool {
        let pool: GraphEntrancePool = {};
        let all_targets = world.get_entrances().filter(e => !!e.type && e.shuffled);
        for (let target of all_targets) {
            if (!(Object.keys(pool).includes(target.type_alias))) pool[target.type_alias] = [];
            pool[target.type_alias].push(target);
        }
        return pool;
    }

    get_entrance_pool(world: World, entrance: Entrance): GraphEntrancePool {
        let pool: GraphEntrancePool = {};
        let valid_target_types: {[entrance_type: string]: string[]} = {
            'Dungeon':          ['Dungeon', 'DungeonSpecial'],
            'DungeonSpecial':   ['Dungeon', 'DungeonSpecial'],
            'ChildBoss':        ['ChildBoss', 'AdultBoss'],
            'AdultBoss':        ['ChildBoss', 'AdultBoss'],
            'Interior':         ['Interior', 'SpecialInterior', 'Hideout'],
            'SpecialInterior':  ['Interior', 'SpecialInterior', 'Hideout'],
            'Hideout':          ['Interior', 'SpecialInterior', 'Hideout'],
            'Grotto':           ['Grotto', 'Grave'],
            'Grave':            ['Grotto', 'Grave'],
            'Overworld':        ['Overworld'],
        };
        let target_types_to_mixed_pool_map: {[entrance_type: string]: string} = {
            'Dungeon':          'Dungeon',
            'DungeonSpecial':   'Dungeon',
            'ChildBoss':        'Boss',
            'AdultBoss':        'Boss',
            'Interior':         'Interior',
            'SpecialInterior':  'Interior',
            'Hideout':          'Interior',
            'Grotto':           'GrottoGrave',
            'Grave':            'GrottoGrave',
            'Overworld':        'Overworld',
        };
        let one_way_valid_target_types: {[entrance_type: string]: string[]} = {
            'OverworldOneWay':  ['WarpSong', 'BlueWarp', 'OwlDrop', 'OverworldOneWay', 'Overworld', 'Extra'],
            'OwlDrop':          ['WarpSong', 'BlueWarp', 'OwlDrop', 'OverworldOneWay', 'Overworld', 'Extra'],
            'Spawn':            ['WarpSong', 'BlueWarp', 'OwlDrop', 'OverworldOneWay', 'Overworld', 'Extra', 'Spawn', 'Interior', 'SpecialInterior'],
            'WarpSong':         ['WarpSong', 'BlueWarp', 'OwlDrop', 'OverworldOneWay', 'Overworld', 'Extra', 'Spawn', 'Interior', 'SpecialInterior'],
        };
        let simplified_target_types: string[] = [
            'Dungeon',
            'DungeonSpecial',
            'ChildBoss',
            'AdultBoss',
            'Interior',
            'SpecialInterior',
            'Hideout',
            'Grotto',
            'Grave',
        ];

        let all_targets = world.get_entrances();

        if (entrance.one_way) {
            // Warps are allowed to link to any entrance that has not already been linked to another warp.
            // This includes normal entrances that have non-warp links and unshuffled normal entrances.
            let used_warp_targets = all_targets.map(e => !!e.type && Object.keys(one_way_valid_target_types).includes(e.type) ? null : e.replaces).filter(e => e !== null);
            let warp_targets = all_targets.filter(e => !(used_warp_targets.includes(e)) && !!e.type);
            for (let target of warp_targets) {
                if (!!(target.type) && !!(entrance.type)) {
                    if (entrance.one_way) {
                        if (one_way_valid_target_types[entrance.type].includes(target.type)) {
                            if (!(Object.keys(pool).includes(target.type_alias))) pool[target.type_alias] = [];
                            pool[target.type_alias].push(target);
                        }
                    }
                }
            }
        } else {
            // Normal entrances can only link to exactly one shuffled target.
            let used_targets = all_targets.map(e => e.is_savewarp ? null : e.replaces).filter(e => e !== null);
            let targets = all_targets.filter(e => !(used_targets.includes(e)) && !!e.type && e.shuffled);
            for (let target of targets) {
                if (!!(target.type) && !!(entrance.type)) {
                    if ((simplified_target_types.includes(target.type) && target.primary)  // only forwards for indoor regions
                        || (((!(entrance.primary) && !(target.primary))                    // indoors reverse if requested entrance is reverse
                        || !(simplified_target_types.includes(target.type)))               // overworld forward/reverse
                        && entrance.source_group?.alias !== target.type_alias)) {
                        if (Object.keys(world.settings).includes('mix_entrance_pools') && Array.isArray(world.settings['mix_entrance_pools']) && world.settings['mix_entrance_pools'].length > 1) {
                            if (world.settings['mix_entrance_pools'].includes(target_types_to_mixed_pool_map[entrance.type])
                            && world.settings['mix_entrance_pools'].includes(target_types_to_mixed_pool_map[target.type])) {
                                if (!(Object.keys(pool).includes(target.type_alias))) pool[target.type_alias] = [];
                                pool[target.type_alias].push(target);
                                // only need to check decoupled reverse entrances for simplified types
                                // since both primary/secondary of other types are added by default.
                                if (!(target.coupled) && !!(target.reverse) && simplified_target_types.includes(target.type) && targets.includes(target.reverse)) {
                                    if (!(Object.keys(pool).includes(target.reverse.type_alias))) pool[target.reverse.type_alias] = [];
                                    pool[target.reverse.type_alias].push(target.reverse);
                                }
                            }
                        } else {
                            if (valid_target_types[entrance.type].includes(target.type)) {
                                if (!(Object.keys(pool).includes(target.type_alias))) pool[target.type_alias] = [];
                                pool[target.type_alias].push(target);
                                if (!(target.coupled) && !!(target.reverse) && simplified_target_types.includes(target.type) && targets.includes(target.reverse)) {
                                    if (!(Object.keys(pool).includes(target.reverse.type_alias))) pool[target.reverse.type_alias] = [];
                                    pool[target.reverse.type_alias].push(target.reverse);
                                }
                            }
                        }
                    }
                }
            }
        }
        return pool;
    }

    build_world_graphs(settings: SettingsList, ootr_version: OotrVersion): void {
        this.worlds = [];
        for (let i = 0; i < settings.settings.world_count; i++) {
            this.worlds.push(new World(i, settings, ootr_version, this));
        }

        let savewarps_to_connect = [];
        for (let world of this.worlds) {
            savewarps_to_connect.push(...(world.load_regions_from_json('Overworld.json')));
            savewarps_to_connect.push(...(world.load_regions_from_json('Bosses.json')));
            savewarps_to_connect.push(...(world.create_dungeons()));
            world.create_internal_locations();
            world.initialize_locations();

            // add hint rules
        }

        for (let world of this.worlds) {
            world.initialize_entrances();
        }

        for (let [savewarp, replaces] of savewarps_to_connect) {
            if (savewarp.world === null) throw `Attempted to connect savewarp without parent world`;
            savewarp.is_savewarp = true;
            savewarp.replaces = savewarp.world.get_entrance(replaces);
            if (savewarp.replaces === null || savewarp.replaces.connected_region === null) throw `Attempted to connect savewarp with no equivalent entrance`;
            savewarp.connect(savewarp.replaces.connected_region);
            // Vanilla/mq interface regions to the outside/boss have the same region, savewarp, and exit names
            // (excluding exits to internal regions). We can pre-connect the dungeon savewarps from the boss door
            // region to the beginning of the dungeon using the same names as the opposite variant.
            // This saves a step when swapping dungeon variants during setting changes.
            if (!!(savewarp.parent_region.dungeon)) {
                let dungeon_variant_name = savewarp.world.dungeon_mq[savewarp.parent_region.dungeon] ?
                    savewarp.parent_region.dungeon :
                    `${savewarp.parent_region.dungeon} MQ`;
                let alt_savewarp = savewarp.world.get_entrance(savewarp.name, dungeon_variant_name);
                alt_savewarp.is_savewarp = true;
                let alt_savewarp_target = savewarp.world.get_region(savewarp.replaces.connected_region.name, dungeon_variant_name);
                alt_savewarp.connect(alt_savewarp_target);
            }
        }

        let one_way_entrance_types = [
            'OverworldOneWay',
            'Spawn',
            'WarpSong',
            'BlueWarp',
            'Extra',
        ];

        let grouped_entrance_type_names: {[entrance_type: string]: string} = {
            'Dungeon': 'Dungeons',
            'DungeonSpecial': 'Dungeons',
            'ChildBoss': 'Bosses',
            'AdultBoss': 'Bosses',
            'Interior': 'Interiors',
            'SpecialInterior': 'Interiors',
            'Hideout': 'Hideout',
            'Grotto': 'Grottos',
            'Grave': 'Grottos',
            'Spawn': 'Spawn Points',
            'WarpSong': 'Warp Songs',
            'BlueWarp': 'Blue Warps',
        };

        // Boss entrances can't be decoupled because most boss rooms do not have accessible exit doors
        let always_coupled_entrances = [
            'ChildBoss',
            'AdultBoss',
            'GraphGanonsTower',
        ];

        // mark warps to expose to the API
        let warp_exit_types: string[] = [
            'Spawn',
            'WarpSong',
        ];

        let entrance_type_priority: {[type: string]: number} = {
            'Overworld': 1,
            'OverworldOneWay': 1,
            'OwlDrop': 2,
            'Spawn': 3,
            'WarpSong': 4,
            'Dungeon': 5,
            'DungeonSpecial': 5,
            'GraphGanonsTower': 5,
            'Interior': 6,
            'SpecialInterior': 6,
            'Hideout': 6,
            'Grotto': 7,
            'Grave': 7,
            'ChildBoss': 8,
            'AdultBoss': 8,
            'BlueWarp': 9,
            'Extra': 10,
        }

        for (let world of this.worlds) {
            // Region groups need to be created before entrance metadata to ensure
            // overworld entrance categories are valid.
            world.create_region_groups();

            // set entrance metadata
            let decoupled = Object.keys(world.settings).includes('decouple_entrances') && world.settings.decouple_entrances === true;
            for (let [type, forward_entry, return_entry] of this.entrance_list.entrances) {
                // Handle different entrances for Ganons Castle to Ganons Tower depending on MQ variant.
                // Skip the alternate as it is copied from the currently linked variant.
                let source_region_name = forward_entry[0].split(' -> ')[0];
                if (world.dungeon_mq['Ganons Castle'] && source_region_name === 'Ganons Castle Lobby') continue;
                if (!(world.dungeon_mq['Ganons Castle']) && source_region_name === 'Ganons Castle Main') continue;
                let forward_entrance = world.get_entrance(forward_entry[0]);
                forward_entrance.type = type;
                forward_entrance.type_priority = entrance_type_priority[type];
                forward_entrance.primary = true;
                if (Object.keys(display_names.entrance_aliases).includes(forward_entrance.name)) {
                    forward_entrance.alias = display_names.entrance_aliases[forward_entrance.name];
                } else if (type === 'Overworld' && !!(forward_entrance.original_connection?.parent_group)) {
                    forward_entrance.alias = forward_entrance.original_connection.parent_group.alias;
                }
                for (let [entrance_group, entrances] of Object.entries(display_names.entrance_groups)) {
                    if (entrances.grouped.includes(forward_entrance.name)) {
                        forward_entrance.target_alias = entrance_group;
                    }
                }
                if (one_way_entrance_types.includes(type)) forward_entrance.one_way = true;
                if (warp_exit_types.includes(type)) forward_entrance.is_warp = true;
                forward_entrance.coupled = !decoupled || always_coupled_entrances.includes(type);
                if (Object.keys(grouped_entrance_type_names).includes(type)) {
                    forward_entrance.type_alias = grouped_entrance_type_names[type];
                } else {
                    if (!!(forward_entrance.original_connection) && !!(forward_entrance.original_connection.parent_group)) {
                        forward_entrance.type_alias = forward_entrance.original_connection.parent_group.alias;
                    }
                }

                if (!!forward_entrance.original_connection?.parent_group) {
                    forward_entrance.target_group = forward_entrance.original_connection.parent_group;
                }
                if (!!forward_entrance.parent_region.parent_group) {
                    forward_entrance.source_group = forward_entrance.parent_region.parent_group;
                }

                if (!!(forward_entrance.parent_region.dungeon)) {
                    let entrance_variant_name: string;
                    if (forward_entrance.parent_region.dungeon !== 'Ganons Castle') {
                        entrance_variant_name = forward_entrance.name;
                    } else {
                        if (world.dungeon_mq['Ganons Castle'] && source_region_name === 'Ganons Castle Main') {
                            entrance_variant_name = 'Ganons Castle Lobby -> Ganons Castle Tower';
                        } else if (!world.dungeon_mq['Ganons Castle'] && source_region_name === 'Ganons Castle Lobby') {
                            entrance_variant_name = 'Ganons Castle Main -> Ganons Castle Tower';
                        } else {
                            entrance_variant_name = forward_entrance.name;
                        }
                    }
                    let dungeon_variant_name = forward_entrance.world.dungeon_mq[forward_entrance.parent_region.dungeon] ?
                        forward_entrance.parent_region.dungeon :
                        `${forward_entrance.parent_region.dungeon} MQ`;
                    let alt_forward_entrance = forward_entrance.world.get_entrance(entrance_variant_name, dungeon_variant_name);
                    alt_forward_entrance.copy_metadata(forward_entrance);
                }

                if (!!return_entry) {
                    let return_entrance = world.get_entrance(return_entry[0]);
                    return_entrance.type = type;
                    return_entrance.type_priority = entrance_type_priority[type];
                    return_entrance.secondary = true;
                    if (Object.keys(display_names.entrance_aliases).includes(return_entrance.name)) {
                        return_entrance.alias = display_names.entrance_aliases[return_entrance.name];
                    // all reverse entrances lead to an overworld region even if they aren't
                    // overworld-type eentrances
                    } else if (!!(return_entrance.original_connection?.parent_group)) {
                        return_entrance.alias = return_entrance.original_connection.parent_group.alias;
                    }
                    if (one_way_entrance_types.includes(type)) return_entrance.one_way = true;
                    if (warp_exit_types.includes(type)) return_entrance.is_warp = true;
                    return_entrance.coupled = !decoupled || always_coupled_entrances.includes(type);
                    // group interior exits with other overworld entrances for the exit region
                    if (!!(return_entrance.original_connection) && !!(return_entrance.original_connection.parent_group)) {
                        return_entrance.type_alias = return_entrance.original_connection.parent_group.alias;
                    }

                    if (!!return_entrance.original_connection?.parent_group) {
                        return_entrance.target_group = return_entrance.original_connection.parent_group;
                    }
                    if (!!return_entrance.parent_region.parent_group) {
                        return_entrance.source_group = return_entrance.parent_region.parent_group;
                    }
    
                    // Ganons Tower doesn't have an MQ variant but is marked as part of the dungeon
                    if (!!(return_entrance.parent_region.dungeon) && !(['Ganons Castle Main', 'Ganons Castle Lobby'].includes(source_region_name))) {
                        let dungeon_variant_name = return_entrance.world.dungeon_mq[return_entrance.parent_region.dungeon] ?
                            return_entrance.parent_region.dungeon :
                            `${return_entrance.parent_region.dungeon} MQ`;
                        let alt_return_entrance = return_entrance.world.get_entrance(return_entrance.name, dungeon_variant_name);
                        alt_return_entrance.copy_metadata(return_entrance);
                    }
                    forward_entrance.bind_two_way(return_entrance);
                }
            }

            // second loop for target region groups, which requires all entrance metadata to be set
            for (let [type, forward_entry, return_entry] of this.entrance_list.entrances) {
                let source_region_name = forward_entry[0].split(' -> ')[0];
                if (world.dungeon_mq['Ganons Castle'] && source_region_name === 'Ganons Castle Lobby') continue;
                if (!(world.dungeon_mq['Ganons Castle']) && source_region_name === 'Ganons Castle Main') continue;
                let forward_entrance = world.get_entrance(forward_entry[0]);
                if (forward_entrance.target_group === null)
                    forward_entrance.target_group = world.create_target_region_group(forward_entrance);
                if (!!return_entry) {
                    let return_entrance = world.get_entrance(return_entry[0]);
                    if (return_entrance.target_group === null) {
                        return_entrance.target_group = world.create_target_region_group(return_entrance);
                        if (!!(return_entrance.parent_region.dungeon) && !(['Ganons Castle Main', 'Ganons Castle Lobby'].includes(source_region_name))) {
                            let dungeon_variant_name = return_entrance.world.dungeon_mq[return_entrance.parent_region.dungeon] ?
                                return_entrance.parent_region.dungeon :
                                `${return_entrance.parent_region.dungeon} MQ`;
                            let alt_return_entrance = return_entrance.world.get_entrance(return_entrance.name, dungeon_variant_name);
                            alt_return_entrance.target_group = world.create_target_region_group(alt_return_entrance);
                        }
                    }
                }
            }

            // region groups need entrance metadata to include exits
            // in their lists
            for (let region_group of world.region_groups){
                region_group.update_exits();
                region_group.sort_lists();
            }
            for (let [dungeon_name, is_mq] of Object.entries(world.dungeon_mq)) {
                let variant_name = is_mq ? dungeon_name : `${dungeon_name} MQ`;
                world.dungeons[variant_name][0].parent_group?.update_exits();
                world.dungeons[variant_name][0].parent_group?.sort_lists();
            }
        }
    }

    set_items(locations: PlandoLocationList | PlandoMWLocationList | null, checked_locations: PlandoCheckedLocationList | PlandoMWCheckedLocationList = []): void {
        let filled_locations: PlandoLocationList;
        let adult_trade_items = [
            "Pocket Egg",
            "Pocket Cucco",
            "Cojiro",
            "Odd Mushroom",
            "Odd Potion",
            "Poachers Saw",
            "Broken Sword",
            "Prescription",
            "Eyeball Frog",
            "Eyedrops",
            "Claim Check",
        ];
        let child_trade_items = [
            "Weird Egg",
            "Chicken",
            "Zeldas Letter",
            "Keaton Mask",
            "Skull Mask",
            "Spooky Mask",
            "Bunny Hood",
            "Goron Mask",
            "Zora Mask",
            "Gerudo Mask",
            "Mask of Truth",
        ];
        let dungeon_rewards = [
            'Kokiri Emerald',
            'Goron Ruby',
            'Zora Sapphire',
            'Forest Medallion',
            'Fire Medallion',
            'Water Medallion',
            'Spirit Medallion',
            'Shadow Medallion',
            'Light Medallion',
        ];
        for (let world of this.worlds) {
            world.skipped_items = [];
            let compass_hint = world.settings.enhance_map_compass === undefined ? false : world.settings.enhance_map_compass;
            let misc_hints = world.settings.misc_hints === undefined ? ['altar', 'ganondorf', 'warp_songs_and_owls'] : world.settings.misc_hints;
            let sim_mode = world.settings.graphplugin_simulator_mode === undefined ? false : world.settings.graphplugin_simulator_mode;
            for (let hint_data of Object.values(world.fixed_item_area_hints)) {
                hint_data.hint_locations = [];
            }
            // vanilla item fill based on settings
            for (let loc of world.get_locations()) {
                // reset location item in case shuffle settings changed
                if (loc.type !== 'Event') {
                    world.pop_item(loc);
                }
                // user checked locations
                let filled_locations: PlandoCheckedLocationList;
                if (world.settings.world_count > 1 && !(Array.isArray(checked_locations))) {
                    filled_locations = <PlandoCheckedLocationList>(checked_locations[`World ${world.id + 1}`]);
                } else {
                    filled_locations = <PlandoCheckedLocationList>checked_locations;
                }
                loc.checked = filled_locations.includes(loc.name);
                loc.user_item = null;
                loc.hinted = false;

                if (sim_mode && loc.name === 'ToT Child Altar Hint' && misc_hints.includes('altar') && !compass_hint) {
                    for (let item_name of child_rewards) {
                        world.fixed_item_area_hints[item_name].hint_locations.push(loc.name);
                    }
                }
                if (sim_mode && loc.name === 'ToT Adult Altar Hint' && misc_hints.includes('altar') && !compass_hint) {
                    for (let item_name of adult_rewards) {
                        world.fixed_item_area_hints[item_name].hint_locations.push(loc.name);
                    }
                }

                if (!!(loc.vanilla_item) && !!(loc.parent_region)) {
                    loc.vanilla_item.world = loc.parent_region.world;
                } else if (loc.name === 'Gift from Sages') {
                    if (!!(world.settings.shuffle_ganon_bosskey)
                            && ['stones', 'medallions', 'dungeons', 'tokens', 'hearts', 'triforce'].includes(world.settings.shuffle_ganon_bosskey)) {
                        world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                        loc.shuffled = false;
                        continue;
                    } else {
                        // Gift from Sages location isn't obtainable unless Ganon's Boss Key is placed there, so hide it
                        loc.internal = true;
                        continue;
                    }
                } else {
                    continue;
                }
                if (Array.isArray(world.settings.disabled_locations) && world.settings.disabled_locations.includes(loc.name)) {
                    // Disabled locations are filled with random junk but otherwise ignored by the graph.
                    // Since these locations are known to the user ahead of time, hide them without filling an item.
                    loc.shuffled = false;
                }
                if (loc.name === 'ToT Light Arrows Cutscene' && world.settings.shuffle_ganon_bosskey === 'on_lacs') {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                    loc.shuffled = false;
                } else if (!!loc.vanilla_item && dungeon_rewards.includes(loc.vanilla_item.name)) {
                    loc.is_restricted = true;
                } else if (loc.type === 'Shop') {
                    let shopSlot = parseInt(loc.name.charAt(loc.name.length - 1));
                    loc.holds_shop_refill = false;
                    switch(world.settings.shopsanity) {
                        case 'off':
                            world.push_vanilla_item(loc);
                            loc.holds_shop_refill = true;
                            break;
                        case '0':
                            if (shopSlot === 7) loc.holds_shop_refill = true;
                        case '1':
                            if (shopSlot === 5) loc.holds_shop_refill = true;
                        case '2':
                            if (shopSlot === 8) loc.holds_shop_refill = true;
                        case '3':
                            if (shopSlot === 6) loc.holds_shop_refill = true;
                        case 'random':
                        case '4':
                        default:
                            if (shopSlot <= 4) loc.holds_shop_refill = true;
                            break;
                        }
                } else if ((world.settings.shuffle_scrubs === 'off' || world.settings.shuffle_scrubs === 'regular') && ['Scrub', 'GrottoScrub'].includes(loc.type)) {
                    if (world.settings.shuffle_scrubs === 'off' && !(['Piece of Heart', 'Deku Stick Capacity', 'Deku Nut Capacity'].includes(loc.vanilla_item.name))) {
                        world.push_vanilla_item(loc);
                        if (loc.item === null) throw `Error assigning vanilla scrub item`;
                        loc.item.price = this.location_list.business_scrub_prices[loc.vanilla_item.name];
                    }
                    loc.price = this.location_list.business_scrub_prices[loc.vanilla_item.name];
                } else if (loc.vanilla_item.name === 'Gold Skulltula Token') {
                    if (world.settings.tokensanity === 'off' ||
                        (world.settings.tokensanity === 'dungeons' && !(loc.dungeon())) ||
                        (world.settings.tokensanity === 'overworld' && loc.dungeon())) {
                            world.push_vanilla_item(loc);
                    }
                } else if (['ActorOverride', 'Freestanding', 'RupeeTower'].includes(loc.type)) {
                    if (world.settings.shuffle_freestanding_items === 'off' ||
                        (world.settings.shuffle_freestanding_items === 'dungeons' && !(loc.dungeon())) ||
                        (world.settings.shuffle_freestanding_items === 'overworld' && loc.dungeon())) {
                            world.push_vanilla_item(loc);
                    }
                } else if (['Pot', 'FlyingPot'].includes(loc.type)) {
                    if (world.settings.shuffle_pots === 'off' ||
                        (world.settings.shuffle_pots === 'dungeons' && (!(loc.dungeon()) && !(loc.parent_region.is_boss_room))) ||
                        (world.settings.shuffle_pots === 'overworld' && (loc.dungeon() || loc.parent_region.is_boss_room))) {
                            world.push_vanilla_item(loc);
                    }
                } else if (['Crate', 'SmallCrate'].includes(loc.type)) {
                    if (world.settings.shuffle_crates === 'off' ||
                        (world.settings.shuffle_crates === 'dungeons' && !(loc.dungeon())) ||
                        (world.settings.shuffle_crates === 'overworld' && loc.dungeon())) {
                            world.push_vanilla_item(loc);
                    }
                } else if (loc.type === 'EnemyDrop') {
                    if (Object.keys(world.settings).includes('shuffle_enemy_drops')) {
                        if (!(world.settings.shuffle_enemy_drops)) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (loc.type === 'GossipStone') {
                    if (Object.keys(world.settings).includes('shuffle_gossipstones')) {
                        if (!(world.settings.shuffle_gossipstones)) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (loc.type === 'Wonderitem') {
                    if (Object.keys(world.settings).includes('shuffle_wonderitems')) {
                        if (!(world.settings.shuffle_wonderitems)) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else  if (loc.type === 'Beehive' && !(world.settings.shuffle_beehives)) {
                    world.push_vanilla_item(loc);
                } else  if (loc.vanilla_item.name === 'Kokiri Sword' && !(world.settings.shuffle_kokiri_sword)) {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Ocarina' && !(world.settings.shuffle_ocarinas)) {
                    world.push_vanilla_item(loc);
                } else if (['Wasteland Bombchu Salesman', 'Kak Granny Buy Blue Potion', 'GC Medigoron'].includes(loc.name) && !(world.settings.shuffle_expensive_merchants)) {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Gerudo Membership Card') {
                    // OOTR still fills this location even though the card is manually collected when
                    // fortress is open.
                    if (!(world.settings.shuffle_gerudo_card)) {
                        world.push_vanilla_item(loc);
                    }
                } else if (loc.vanilla_item.name == 'Buy Magic Bean' && !(world.settings.shuffle_beans)) {
                    world.push_vanilla_item(loc);
                } else if (adult_trade_items.includes(loc.vanilla_item.name)) {
                    if (!(world.settings.adult_trade_shuffle)) {
                        if (loc.vanilla_item.name !== 'Pocket Egg' || (!!(world.settings.adult_trade_start) && world.settings.adult_trade_start.length === 0)) {
                            world.push_vanilla_item(loc);
                        }
                    } else {
                        if (!(!!(world.settings.adult_trade_start) && world.settings.adult_trade_start.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Pocket Egg') {
                            world.push_vanilla_item(loc);
                        }
                        if (loc.vanilla_item.name === 'Pocket Egg' && !!(world.settings.adult_trade_start)
                            && !(world.settings.adult_trade_start.includes('Pocket Egg')) && !(world.settings.adult_trade_start.includes('Pocket Cucco'))) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (child_trade_items.includes(loc.vanilla_item.name)) {
                    if (!(!!(world.settings.shuffle_child_trade) && world.settings.shuffle_child_trade.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Weird Egg') {
                        world.push_vanilla_item(loc);
                    } else if (loc.vanilla_item.name === 'Weird Egg' && !!(world.settings.shuffle_child_trade) && !(world.settings.shuffle_child_trade.includes('Weird Egg')) && !(world.settings.shuffle_child_trade.includes('Chicken'))) {
                        if (!(world.skip_child_zelda)) {
                            world.push_vanilla_item(loc);
                        } else {
                            // hack to match rando, can't have the item filled but we don't want to see the location as shuffled since it's skipped logically
                            loc.shuffled = false;
                        }
                    }
                } else if (loc.vanilla_item.name === 'Milk' && !(world.settings.shuffle_cows)) {
                    world.push_vanilla_item(loc);
                } else if (loc.name === 'LH Loach Fishing' && world.settings.shuffle_loach_reward === 'off') {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Small Key (Thieves Hideout)' && (world.settings.shuffle_hideoutkeys === 'vanilla' || world.settings.shuffle_hideoutkeys === 'remove')) {
                    if (world.settings.gerudo_fortress !== 'open' &&
                        (loc.name === 'Hideout 1 Torch Jail Gerudo Key' || world.settings.gerudo_fortress !== 'fast')) {
                            world.push_vanilla_item(loc);
                    } else {
                        // hack to hide the other 3 unshuffled keys without placing the items
                        loc.shuffled = false;
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Treasure Chest Game)' && world.settings.shuffle_tcgkeys === 'vanilla') {
                    // small key rings not implemented for vanilla keys (would otherwise skip lens of truth requirement)
                    world.push_vanilla_item(loc);
                } else if (loc.name.includes('Market Treasure Chest Game Room') && world.settings.shuffle_tcgkeys === 'vanilla') {
                    // handles rupees in the bottom chests without affecting other locations using TCG rupees (MQ GTG)
                    world.push_vanilla_item(loc);
                } else if (['Event', 'Drop'].includes(loc.type) && !!(loc.vanilla_item)) {
                    // hard-coded events from the location list that don't auto-generate items of the same name
                    world.push_vanilla_item(loc);
                } else if (['Market Bombchu Bowling Bombchus', 'Market Bombchu Bowling Bomb'].includes(loc.name)) {
                    // never shuffled locations relevant to logic
                    world.push_vanilla_item(loc);
                } else if (!!loc.parent_region.parent_group && loc.parent_region.parent_group.alias === 'Zora River' && loc.vanilla_item.name === 'Rupees (50)' && !(world.settings.shuffle_frog_song_rupees)) {
                    world.push_vanilla_item(loc);
                } else if (!!(loc.dungeon())) {
                    let dungeon = loc.dungeon();
                    let dungeon_text = (text: string, dungeon: string | null): string => `${text} (${dungeon})`;
                    let shuffle_setting = '';

                    if (loc.vanilla_item.name === dungeon_text('Boss Key', dungeon)) {
                        shuffle_setting = dungeon !== 'Ganons Castle' ? <string>world.settings.shuffle_bosskeys : <string>world.settings.shuffle_ganon_bosskey;
                        // OOTR bug, BKs are starting items if key rings are on,
                        // key rings give BKs, and small keysy is on
                        if (!!(world.settings.key_rings) && !!dungeon && world.settings.key_rings.includes(dungeon) && dungeon !== 'Ganons Castle' && world.settings.keyring_give_bk && !!world.settings.shuffle_smallkeys && world.settings.shuffle_smallkeys !== 'vanilla') {
                            shuffle_setting = shuffle_setting === 'remove' || !(['any_dungeon','overworld','keysanity','regional','remove'].includes(<string>world.settings.shuffle_smallkeys)) ? shuffle_setting : <string>world.settings.shuffle_smallkeys;
                            //world.skipped_items.push(loc.vanilla_item);
                        }
                    } else if (loc.vanilla_item.name === dungeon_text('Small Key', dungeon)) {
                        shuffle_setting = <string>world.settings.shuffle_smallkeys;
                    } else if (loc.vanilla_item.name === dungeon_text('Map', dungeon)) {
                        shuffle_setting = <string>world.settings.shuffle_mapcompass;
                    } else if (loc.vanilla_item.name === dungeon_text('Compass', dungeon)) {
                        shuffle_setting = <string>world.settings.shuffle_mapcompass;
                    } else if (loc.type === 'SilverRupee') {
                        shuffle_setting = <string>world.settings.shuffle_silver_rupees;
                    }
                    if (shuffle_setting === 'vanilla') {
                        world.push_vanilla_item(loc);
                    } else if (['remove', 'startwith'].includes(shuffle_setting)) {
                        // important to do at this stage instead of with other skipped item collection
                        // so that the correct number of keys/silver rupees are in world state
                        world.skipped_items.push(loc.vanilla_item);
                    }
                }
                // unshuffled rewards only
                if (!!loc.item) {
                    this.try_set_hinted_area_for_item(loc.item.name, loc.world, loc, true);
                    this.try_hint_compass(loc);
                    this.try_hint_reward(loc);
                }
            }
            // exit if we're only resetting vanilla items
            if (locations === null) return;
            // user fill overrides
            if (world.settings.world_count > 1) {
                filled_locations = <PlandoLocationList>(locations[`World ${world.id + 1}`]);
            } else {
                filled_locations = <PlandoLocationList>locations;
            }
            for (let [location, item] of Object.entries(filled_locations)) {
                let world_location = world.get_location(location);
                let world_item: Item;
                if (typeof(item) === 'string') {
                    world_item = ItemFactory(item, world)[0];
                } else {
                    // dict-style for ice traps and shop items
                    if (!!item.player) {
                        world_item = ItemFactory(item.item, this.worlds[item.player-1])[0];
                    } else {
                        world_item = ItemFactory(item.item, world)[0];
                    }
                    if (!!item.price) {
                        world_item.price = item.price;
                    }
                }
                // don't override vanilla items
                if (world_location.item === null) {
                    world_location.item = world_item;
                    if (typeof(item) !== 'string' && !!item.price) {
                        world_location.price = world_item.price;
                    }
                    // shuffled rewards only
                    this.try_set_hinted_area_for_item(world_location.item.name, world_location.world, world_location, true);
                    this.try_hint_compass(world_location);
                    this.try_hint_reward(world_location);
                } else {
                    world_location.user_item = world_item;
                }
            }
        }
    }

    set_entrances(entrances: PlandoEntranceList | PlandoMWEntranceList | null, checked_entrances: PlandoCheckedEntranceList | PlandoMWCheckedEntranceList = []): void {
        let connected_entrances: PlandoEntranceList;
        let always_coupled_entrances = [
            'ChildBoss',
            'AdultBoss',
            'GraphGanonsTower',
        ]
        for (let world of this.worlds) {
            let target_alias_sizes: {[alias: string]: {
                entrances: Entrance[],
                sizes: number[],
            }} = {};
            let decoupled = Object.keys(world.settings).includes('decouple_entrances') && world.settings.decouple_entrances === true;
            // disconnect all shuffled entrances
            for (let entrance of world.get_entrances()) {
                if (!!(entrance.type) && world.shuffled_entrance_types.includes(entrance.type)) {
                    if (!!entrance.connected_region) entrance.disconnect();
                    entrance.shuffled = true;
                    entrance.coupled = !decoupled || (!!entrance.type && always_coupled_entrances.includes(entrance.type));
                // reset unshuffled entrances to vanilla targets to handle settings changes
                } else if (!!(entrance.type)) {
                    if (!!entrance.connected_region) entrance.disconnect();
                    entrance.shuffled = false;
                    entrance.coupled = !decoupled || (!!entrance.type && always_coupled_entrances.includes(entrance.type));
                    if (entrance.original_connection === null) throw `Tried to reconnect null vanilla entrance`;
                    entrance.connect(entrance.original_connection);
                    entrance.replaces = null;
                }
                entrance.use_target_alias = false;
                entrance.user_connection = null;
                entrance.hinted = false;

                // user checked locations
                let filled_entrances: PlandoCheckedEntranceList;
                if (world.settings.world_count > 1 && !(Array.isArray(checked_entrances))) {
                    filled_entrances = <PlandoCheckedEntranceList>(checked_entrances[`World ${world.id + 1}`]);
                } else {
                    filled_entrances = <PlandoCheckedEntranceList>checked_entrances;
                }
                entrance.checked = filled_entrances.includes(entrance.name);
                // cache location counts for entrances with grouped alias names, such as Shop or House
                let target_region = entrance.original_connection;
                if (!!(target_region) && !!(entrance.target_alias)) {
                    if (!(Object.keys(target_alias_sizes).includes(entrance.target_alias))) {
                        target_alias_sizes[entrance.target_alias] = {
                            entrances: [],
                            sizes: [],
                        }
                    }
                    target_alias_sizes[entrance.target_alias].entrances.push(entrance);
                    target_alias_sizes[entrance.target_alias].sizes.push(target_region.locations.filter(l => l.shuffled).length);
                }
            }
            for (let [alias, meta] of Object.entries(target_alias_sizes)) {
                // shops need to be distinguishable if sold items are unshuffled but entrances are
                if (alias === 'Shop' && world.settings.shopsanity === 'off') continue;

                let [size_mode, count] = this.mode(meta.sizes);
                // aliases only apply when more than one aliased region has identical numbers of shuffled locations
                // or if the alias group has only one member
                // or if the group has a pre-defined number of locations for which the alias applies
                if (((count > 1 || meta.sizes.length === 1) && display_names.entrance_groups[alias].required_size === undefined)) {
                    for (let [idx, size] of meta.sizes.entries()) {
                        if (size === size_mode) {
                            meta.entrances[idx].use_target_alias = true;
                        }
                    }
                } else if (display_names.entrance_groups[alias].required_size !== undefined && display_names.entrance_groups[alias].required_size !== null) {
                    for (let [idx, size] of meta.sizes.entries()) {
                        if (size === display_names.entrance_groups[alias].required_size) {
                            meta.entrances[idx].use_target_alias = true;
                        }
                    }
                }
            }

            // Special handling for spawns since they have the same type but
            // can be individually shuffled (why...)
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('child')) {
                let entrance = world.get_entrance('Child Spawn -> KF Links House');
                if (!!entrance.connected_region) entrance.disconnect();
                entrance.shuffled = true;
            }
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('adult')) {
                let entrance = world.get_entrance('Adult Spawn -> Temple of Time');
                if (!!entrance.connected_region) entrance.disconnect();
                entrance.shuffled = true;
            }

            if (entrances === null) {
                this.set_blue_warps(world);
                return;
            };
            // reconnect only shuffled entrances with user targets
            if (world.settings.world_count > 1) {
                connected_entrances = <PlandoEntranceList>entrances[`World ${world.id + 1}`];
            } else {
                connected_entrances = <PlandoEntranceList>entrances;
            }
            for (let [entrance, target] of Object.entries(connected_entrances)) {
                let src = world.get_entrance(entrance);
                let dest = world.get_entrance_from_target(target);
                if (dest.original_connection === null) throw `Plando tried to connect entrance target without original region connection`;
                // don't override unshuffled entrances if they are defined in the plando
                if (src.connected_region === null) {
                    src.connect(dest.original_connection);
                    src.replaces = dest;
                    src.user_connection = dest;
                    if (!!(src.reverse) && !!(dest.reverse) && !!(src.reverse.original_connection) && src.coupled) {
                        dest.reverse.connect(src.reverse.original_connection);
                        dest.reverse.replaces = src.reverse;
                        dest.reverse.user_connection = src.reverse;
                    }
                } else {
                    // but still store user-specified connections in case shuffle settings are changed
                    src.user_connection = dest;
                }
            }

            // adjust blue warp exits even if dungeon/boss shuffles are off, in case they were previously shuffled.
            this.set_blue_warps(world);
        }
    }

    set_viewable_region_groups(): void {
        // Max explore world with pseudo-starting items that
        // the player may have gotten out of logic and all tricks enabled.
        // Regions are viewable if they:
        //   1) Have a shuffled entrance targetting it, in or out of logic
        //   2) Are logically accessible from an unshuffled but shufflable entrance
        for (let world of this.worlds) {
            for (let region of world.region_groups) {
                region.viewable = false;
            }
        }
        this.all_tricks_and_keys_search.collect_locations();
        for (let region of this.all_tricks_and_keys_search.iter_visited_regions()) {
            // ignore the logical bypass to Hyrule Castle through the skip_child_zelda branch from Root
            if (!!region.parent_group && region.name !== 'HC Garden Locations') region.parent_group.viewable = true;
        }
    }

    create_tricked_worlds(keysy: boolean = false): World[] {
        let all_tricks_worlds = this.worlds.map(w => w.copy());
        let tricks = !!(this.settings_list.setting_definitions.allowed_tricks.choices) ? Object.keys(this.settings_list.setting_definitions.allowed_tricks.choices) : [];
        for (let world of all_tricks_worlds) {
            // Always enable tricks for checking reachable locations,
            // but limit region visibility if requested by user settings.
            if (!keysy || (keysy && world.visit_all_trick_entrances)) {
                this.change_setting(world, this.settings_list.setting_definitions.allowed_tricks, tricks, {update_world_only: true});
            }
            if (keysy) {
                // Collect 10 small keys for each dungeon to simulate optimal key usage
                // Relevant for Spirit Temple exits to the Colossus hands providing Desert Colossus access
                for (let small_key of Object.values(this.ItemInfo.items).filter(i => i.type === 'SmallKey')) {
                    world.skipped_items.push(...ItemFactory(Array.from({length: 10}, (v, i) => small_key.name), world));
                }
            }
            world.collect_skipped_locations();
        }
        return all_tricks_worlds;
    }

    mode(a: number[]): [number, number] {
        const count: {[value: number]: number} = {};
        for (let e of a) {
            if (!(e in count)) {
                count[e] = 0;
            }
            count[e]++;
        }
        let bestElement;
        let bestCount = 0;
        for (let [k, v] of Object.entries(count)) {
            if (v > bestCount) {
                bestElement = parseInt(k);
                bestCount = v;
            }
        };
        if (bestElement === undefined) throw `Mode could not be calculated: No elements to count.`;
        return [bestElement, bestCount];
    }

    finalize_world(initializing: boolean = false): void {
        // must run after item fill to allow location table names
        // to line up during fill and prices to get set
        for (let world of this.worlds) {
            if (initializing) {
                world.parser.parse_shop_rules();
                this.set_drop_location_names(world);
            }
            this.set_shop_rules(world);
            world.state.collect_starting_items();
            world.collect_skipped_locations();
        }
    }

    set_blue_warps(world: World): void {
        // Determine blue warp targets
        let blue_warps: [Entrance, Entrance][] = [
            [world.get_entrance('Queen Gohma Boss Room -> KF Outside Deku Tree'), world.get_entrance('Queen Gohma Boss Room -> Deku Tree Before Boss')],
            [world.get_entrance('King Dodongo Boss Room -> Death Mountain'), world.get_entrance('King Dodongo Boss Room -> Dodongos Cavern Mouth')],
            [world.get_entrance('Barinade Boss Room -> Zoras Fountain'), world.get_entrance('Barinade Boss Room -> Jabu Jabus Belly Before Boss')],
            [world.get_entrance('Phantom Ganon Boss Room -> Sacred Forest Meadow'), world.get_entrance('Phantom Ganon Boss Room -> Forest Temple Before Boss')],
            [world.get_entrance('Volvagia Boss Room -> DMC Central Local'), world.get_entrance('Volvagia Boss Room -> Fire Temple Before Boss')],
            [world.get_entrance('Morpha Boss Room -> Lake Hylia'), world.get_entrance('Morpha Boss Room -> Water Temple Before Boss')],
            [world.get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region'), world.get_entrance('Bongo Bongo Boss Room -> Shadow Temple Before Boss')],
            [world.get_entrance('Twinrova Boss Room -> Desert Colossus'), world.get_entrance('Twinrova Boss Room -> Spirit Temple Before Boss')],
        ];

        for (let [blue_warp, boss_door_exit] of blue_warps) {
            this.set_blue_warp(blue_warp, boss_door_exit);
        }
    }

    set_blue_warp(blue_warp: Entrance, boss_door_exit: Entrance) {
        let world = blue_warp.world;
        // if a boss room is inside a boss door, make the blue warp go outside the dungeon's entrance
        let boss_exits: {[e: string]: Entrance} = {
            'Queen Gohma Boss Room -> Deku Tree Before Boss': world.get_entrance('Deku Tree Lobby -> KF Outside Deku Tree'),
            'King Dodongo Boss Room -> Dodongos Cavern Mouth': world.get_entrance('Dodongos Cavern Beginning -> Death Mountain'),
            'Barinade Boss Room -> Jabu Jabus Belly Before Boss': world.get_entrance('Jabu Jabus Belly Beginning -> Zoras Fountain'),
            'Phantom Ganon Boss Room -> Forest Temple Before Boss': world.get_entrance('Forest Temple Lobby -> SFM Forest Temple Entrance Ledge'),
            'Volvagia Boss Room -> Fire Temple Before Boss': world.get_entrance('Fire Temple Lower -> DMC Fire Temple Entrance'),
            'Morpha Boss Room -> Water Temple Before Boss': world.get_entrance('Water Temple Lobby -> Lake Hylia'),
            'Bongo Bongo Boss Room -> Shadow Temple Before Boss': world.get_entrance('Shadow Temple Entryway -> Graveyard Warp Pad Region'),
            'Twinrova Boss Room -> Spirit Temple Before Boss': world.get_entrance('Spirit Temple Lobby -> Desert Colossus From Spirit Lobby'),
        };
        let blue_warp_exits: {[e: string]: Entrance} = {
            'Deku Tree Lobby -> KF Outside Deku Tree': world.get_entrance('Queen Gohma Boss Room -> KF Outside Deku Tree'),
            'Dodongos Cavern Beginning -> Death Mountain': world.get_entrance('King Dodongo Boss Room -> Death Mountain'),
            'Jabu Jabus Belly Beginning -> Zoras Fountain': world.get_entrance('Barinade Boss Room -> Zoras Fountain'),
            'Forest Temple Lobby -> SFM Forest Temple Entrance Ledge': world.get_entrance('Phantom Ganon Boss Room -> Sacred Forest Meadow'),
            'Fire Temple Lower -> DMC Fire Temple Entrance': world.get_entrance('Volvagia Boss Room -> DMC Central Local'),
            'Water Temple Lobby -> Lake Hylia': world.get_entrance('Morpha Boss Room -> Lake Hylia'),
            'Shadow Temple Entryway -> Graveyard Warp Pad Region': world.get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region'),
            'Spirit Temple Lobby -> Desert Colossus From Spirit Lobby': world.get_entrance('Twinrova Boss Room -> Desert Colossus'),
        };
        let target = this.get_original_or_replaced_entrance(boss_door_exit);
        // if a boss room is inside a dungeon entrance (or inside a dungeon which is inside a dungeon entrance), make the blue warp go to the furthest dungeon's blue warp target
        while (true) {
            if (target === null || !(target?.name in boss_exits)) {
                break;
            }
            target = !!(boss_exits[target.name].replaces) ? boss_exits[target.name].replaces : boss_exits[target.name];
        }
        if (!!blue_warp.connected_region) blue_warp.disconnect();
        if (!!target) {
            if (target.name in blue_warp_exits) {
                target = blue_warp_exits[target.name];
            }
            if (!!(target?.original_connection)) {
                blue_warp.connect(target.original_connection);
                blue_warp.replaces = target;
            }
        }
    }

    get_original_or_replaced_entrance(entrance: Entrance): Entrance | null {
        let ret: Entrance;
        if (!!(entrance.replaces)) {
            ret = entrance.replaces;
        } else if (!(entrance.shuffled)) {
            ret = entrance;
        } else {
            return null;
        }
        // only provide a target if the provided entrance is connected
        // in order to work with partially connected worlds
        if (!!(entrance.connected_region)) {
            return ret;
        } else {
            return null;
        }
    }

    set_drop_location_names(world: World): void {
        for (let loc of world.get_locations(true)) {
            if (loc.type === 'Drop' && !!(loc.parent_region)) {
                loc.name = `${loc.parent_region.name} ${loc.name}`;
            }
        }
    }

    set_shop_rules(world: World): void {
        for (let loc of world.get_locations(true)) {
            this.set_shop_rule(loc);
        }
    }

    set_shop_rule(loc: Location): void {
        let adult_items = [
            'Buy Goron Tunic',
            'Buy Zora Tunic',
        ];
        let bottle_items = [
            'Buy Blue Fire',
            'Buy Blue Potion',
            'Buy Bottle Bug',
            'Buy Fish',
            'Buy Green Potion',
            'Buy Poe',
            'Buy Red Potion for 30 Rupees',
            'Buy Red Potion for 40 Rupees',
            'Buy Red Potion for 50 Rupees',
            'Buy Fairy\'s Spirit',
        ];
        let bombchu_items = [
            'Buy Bombchu (10)',
            'Buy Bombchu (20)',
            'Buy Bombchu (5)',
        ];

        // if other dynamic rules besides shops are added in the future, this likely needs to be moved
        loc.reset_rules();

        if (!!(loc.price)) {
            if (loc.price > 500) {
                loc.add_rule(loc.world.parser.wallet3);
            } else if (loc.price > 200) {
                loc.add_rule(loc.world.parser.wallet2);
            } else if (loc.price > 99) {
                loc.add_rule(loc.world.parser.wallet);
            }
        }
        if (!!(loc.item)) {
            if (adult_items.includes(loc.item.name)) {
                loc.add_rule(loc.world.parser.is_adult);
            }
            if (bottle_items.includes(loc.item.name)) {
                loc.add_rule(loc.world.parser.has_bottle);
            }
            if (bombchu_items.includes(loc.item.name)) {
                loc.add_rule(loc.world.parser.found_bombchus);
            }
        }
    }
}

export default OotrGraphPlugin;