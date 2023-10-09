import { GraphEntrance, GraphGameVersions, GraphItem, GraphLocation, GraphPlugin, GraphSetting, GraphWorld, GraphSettingType } from '../GraphPlugin.js';

import SettingsList from './SettingsList.js';
import World, { PlandoLocationList, PlandoMWLocationList, PlandoEntranceList, PlandoMWEntranceList, PlandoEntranceTarget, PlandoItem } from "./World.js";
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
import { RegionGroup } from './RegionGroup.js';
import { Region } from './Region.js';

interface OotrPlando {
    ':version': string,
    settings: SettingsDictionary,
    dungeons: { [dungeon_name: string]: string },
    trials: { [trial_name: string]: string },
    songs: { [song_name: string]: string },
    entrances: PlandoEntranceList | PlandoMWEntranceList,
    locations: PlandoLocationList | PlandoMWLocationList,
};

class OotrGraphPlugin extends GraphPlugin {
    private version_list = [
        '7.1.117',
        '7.1.143',
        '7.1.154',
        '7.1.143 R-1',
        '7.1.154 R-1',
    ];

    public worlds: World[];
    public search: Search;
    public settings_list: SettingsList;
    public location_list: LocationList;
    public entrance_list: EntranceList;
    public item_list: ItemList;
    public ItemInfo: ItemInfo;

    constructor(
        public user_overrides: any,
        public ootr_version: OotrVersion,
        public file_cache: OotrFileCache,
        public debug: boolean = false,
        public test_only: boolean = false,
    ) {
        super();
        this.worlds = [];
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
            this.search = new Search(this.worlds.map((world) => world.state));
            return;
        }
        this.build_world_graphs(this.settings_list, ootr_version);
        if (Object.keys(this.settings_list).includes('locations')) {
            this.set_items(this.settings_list.locations);
        }
        if (Object.keys(this.settings_list).includes('entrances')) {
            this.set_entrances(this.settings_list.entrances);
        }
        this.finalize_world(true);
        this.search = new Search(this.worlds.map((world) => world.state));
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

    import(plando: any): void {
        // modify the existing GraphPlugin object to avoid running the rule parser
        this.settings_list.set_to_defaults();
        this.settings_list.override_settings(plando);
        let graph_settings = this.get_settings_options();

        for (let world of this.worlds) {
            for (let [setting, def] of Object.entries(graph_settings)) {
                let randomized_settings: any = {};
                if (Object.keys(plando).includes('randomized_settings')) {
                    if (!!(plando.settings.world_count) && plando.settings.world_count > 1) {
                        randomized_settings = plando.randomized_settings[`World ${world.id+1}`];
                    } else {
                        randomized_settings = plando.randomized_settings;
                    }
                }
                if (Object.keys(randomized_settings).includes(setting)) {
                    this.change_setting(world, def, <GraphSettingType>randomized_settings[setting], false);
                } else if (Object.keys(plando).includes('settings')) {
                    if (Object.keys(plando.settings).includes(setting)) {
                        this.change_setting(world, def, <GraphSettingType>plando.settings[setting], false);
                    } else {
                        this.change_setting(world, def, def.default, false);
                    }
                } else {
                    this.change_setting(world, def, def.default, false);
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
            this.change_setting(this.worlds[0], graph_settings['mq_dungeons_specific'], mq_dungeons, false);
            let active_trials: string[] = [];
            if (Object.keys(plando).includes('trials')) {
                for (let [trial, active] of Object.entries(plando.trials)) {
                    if (active === 'active') {
                        active_trials.push(trial);
                    }
                }
            }
            this.change_setting(this.worlds[0], graph_settings['graphplugin_trials_specific'], active_trials, false);
            if (Object.keys(plando).includes('songs')) {
                this.change_setting(this.worlds[0], graph_settings['graphplugin_song_melodies'], plando.songs, false);
            } else {
                this.change_setting(this.worlds[0], graph_settings['graphplugin_song_melodies'], null, false);
            }
        }

        this.worlds.forEach((world) => world.state.reset());
        if (Object.keys(plando).includes('locations')) {
            this.set_items(plando.locations);
        } else {
            this.set_items(null);
        }
        if (Object.keys(plando).includes('entrances')) {
            this.set_entrances(plando.entrances);
        } else {
            this.set_entrances(null);
        }
        this.finalize_world();
        this.search = new Search(this.worlds.map((world) => world.state));
    }

    export(): any {
        let plando: OotrPlando = {
            ':version': this.ootr_version.to_string(),
            settings: this.worlds[0].settings,
            dungeons: {},
            trials: {},
            songs: {},
            entrances: {},
            locations: {},
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

            // this is either the full list of vanilla songs or, if melodies are randomized,
            // only known song melodies
            plando.songs = this.worlds[0].settings.graphplugin_song_melodies;

            let locations = this.worlds[0].get_locations();
            for (let location of locations) {
                if (location.shuffled && location.type !== 'Event' && !!(location.item)) {
                    let location_item: PlandoItem | string;
                    if (!!(location.item.price)) {
                        location_item = { item: location.item.name, price: location.item.price };
                    } else {
                        location_item = location.item.name;
                    }
                    plando.locations[location.name] = location_item;
                }
            }

            let entrances = this.worlds[0].get_entrances();
            let simplified_target_types: string[] = [
                'Interior',
                'SpecialInterior',
                'Grotto',
                'Grave'
            ];
            for (let entrance of entrances) {
                if (entrance.shuffled && !!(entrance.replaces) && !!(entrance.connected_region) && !!(entrance.replaces.type) && (!(entrance.coupled) || entrance.primary || entrance.type === 'overworld')) {
                    let target: PlandoEntranceTarget | string;
                    if (simplified_target_types.includes(entrance.replaces.type) && entrance.replaces.primary) {
                        target = entrance.name;
                    } else {
                        target = { 'region': entrance.connected_region.name, 'from': entrance.replaces.parent_region.name };
                    }
                    plando.entrances[entrance.name] = target;
                }
            }
        } else {
        }

        return plando;
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

    get_settings_options(): { [setting_name: string]: GraphSetting; } {
        return this.settings_list.setting_definitions;
    }

    collect_locations(): void {
        this.search.collect_locations();
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

    change_setting(world: World, setting: GraphSetting, value: GraphSettingType, update_vanilla_items: boolean = true) {
        world.settings[setting.name] = value;
        this.settings_list.settings[setting.name] = value;
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
                        } else if (is_mq) {
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
            default:
                break;
        }
        world.update_internal_settings();
        // updates unshuffled items
        // can be disabled for bulk setting updates to avoid looping through locations repeatedly,
        // but this requires running set_items manually
        world.state.reset();
        if (update_vanilla_items) {
            let world_fill = this.export();
            this.set_items(world_fill.locations);
            this.set_entrances(world_fill.entrances);
            this.set_blue_warps(world);
            this.set_shop_rules(world);
            world.state.collect_starting_items();
            this.collect_skipped_locations(world);
        }
        this.search = new Search(this.worlds.map((world) => world.state));
    }

    set_location_item(location: GraphLocation, item: GraphItem): void {
        if (location.world !== null) {
            let l: Location = this.worlds[location.world.id].get_location(location.name);
            let i: Item = ItemFactory(item.name, l.world)[0];
            l.item = i;
            i.location = l;
            if (!!location.price) {
                l.price = location.price;
                i.price = location.price;
            }
            this.set_shop_rule(l);
        } else {
            throw `Attempted to set item for location in non-existent world: ${location.name}`;
        }
    }

    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void {
        let e = this.worlds[entrance.world.id].get_entrance(entrance.name);
        let t = this.worlds[entrance.world.id].get_entrance(replaced_entrance.name);
        if (e.original_connection === null || t.original_connection === null) {
            throw `Attempted to connect entrances with undefined original connections: ${e.name} to ${t.name}`;
        }
        e.connect(t.original_connection);
        e.replaces = t;
        if (!!(e.reverse) && !!(t.reverse) && !!(e.reverse.original_connection)) {
            t.reverse.connect(e.reverse.original_connection);
            t.reverse.replaces = e.reverse;
        }
        // link blue warp to boss room exit
        if (!!e.type && ['ChildBoss', 'AdultBoss'].includes(e.type)) {
            let boss_exit: Entrance | null = null;
            if (e.primary && e.coupled) {
                boss_exit = e.reverse;
            } else if (e.secondary) {
                boss_exit = e;
            }
            if (!!boss_exit) {
                let blue_warp: Entrance | null = null;
                for (let exit of boss_exit.parent_region.exits) {
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

    get_entrance_pool(world: World, entrance: Entrance): {[category: string]: Entrance[]} {
        let pool: {[category: string]: Entrance[]} = {};
        let targets = world.get_entrances();
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
        let mixed_valid_target_types: {[entrance_type: string]: string[]} = {
            'Dungeon':          ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'DungeonSpecial':   ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'ChildBoss':        ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'AdultBoss':        ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'Interior':         ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'SpecialInterior':  ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'Hideout':          ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'Grotto':           ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'Grave':            ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
            'Overworld':        ['Dungeon', 'DungeonSpecial', 'ChildBoss', 'AdultBoss', 'Interior', 'SpecialInterior', 'Hideout', 'Grotto', 'Grave', 'Overworld'],
        };
        let warp_valid_target_types: {[entrance_type: string]: string[]} = {
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
        for (let target of targets) {
            if (!!(target.type) && !!(entrance.type)) {
                if (entrance.is_warp) {
                    if (warp_valid_target_types[entrance.type].includes(target.type)) {
                        pool[target.type_alias].push(target);
                    }
                } else {
                    if ((simplified_target_types.includes(target.type) && target.primary)
                        || (!(entrance.primary) && !(target.primary))
                        || !(simplified_target_types.includes(target.type))) {
                        if (Object.keys(world.settings).includes('mixed_pools') && Array.isArray(world.settings['mixed_pools'])) {
                            if (world.settings['mixed_pools'].includes(entrance.type) && mixed_valid_target_types[entrance.type].includes(target.type) && target.shuffled) {
                                pool[target.type_alias].push(target);
                                // only need to check decoupled reverse entrances for simplified types
                                // since both primary/secondary of other types are added by default.
                                if (!(target.coupled) && !!(target.reverse) && simplified_target_types.includes(target.type)) {
                                    pool[target.reverse.type_alias].push(target.reverse);
                                }
                            } else {
                                
                            }
                        } else {
                            if (valid_target_types[entrance.type].includes(target.type) && target.shuffled) {
                                pool[target.type_alias].push(target);
                                if (!(target.coupled) && !!(target.reverse) && simplified_target_types.includes(target.type)) {
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

            // add hint rules
        }

        for (let world of this.worlds) {
            world.initialize_entrances();
        }

        for (let [savewarp, replaces] of savewarps_to_connect) {
            if (savewarp.world === null) throw `Attempted to connect savewarp without parent world`;
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
                let alt_savewarp_target = savewarp.world.get_region(savewarp.replaces.connected_region.name, dungeon_variant_name);
                alt_savewarp.connect(alt_savewarp_target);
            }
        }

        let warp_entrance_types = [
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

        for (let world of this.worlds) {
            // set entrance metadata
            let decoupled = Object.keys(world.settings).includes('decouple_entrances') && world.settings.decouple_entrances === true;
            for (let [type, forward_entry, return_entry] of this.entrance_list.entrances) {
                let forward_entrance = world.get_entrance(forward_entry[0]);
                forward_entrance.type = type;
                forward_entrance.primary = true;
                if (Object.keys(display_names.entrance_aliases).includes(forward_entrance.name)) {
                    forward_entrance.alias = display_names.entrance_aliases[forward_entrance.name];
                }
                for (let [entrance_group, entrances] of Object.entries(display_names.entrance_groups)) {
                    if (entrances.includes(forward_entrance.name)) {
                        forward_entrance.target_alias = entrance_group;
                    }
                }
                if (warp_entrance_types.includes(type)) forward_entrance.is_warp = true;
                forward_entrance.coupled = !decoupled;
                if (Object.keys(grouped_entrance_type_names).includes(type)) {
                    forward_entrance.type_alias = grouped_entrance_type_names[type];
                } else {
                    if (!!(forward_entrance.original_connection)) {
                        forward_entrance.type_alias = forward_entrance.original_connection.name;
                    }
                }

                if (!!(forward_entrance.parent_region.dungeon)) {
                    let dungeon_variant_name = forward_entrance.world.dungeon_mq[forward_entrance.parent_region.dungeon] ?
                        forward_entrance.parent_region.dungeon :
                        `${forward_entrance.parent_region.dungeon} MQ`;
                    let alt_forward_entrance = forward_entrance.world.get_entrance(forward_entrance.name, dungeon_variant_name);
                    alt_forward_entrance.copy_metadata(forward_entrance);
                }

                if (!!return_entry) {
                    let return_entrance = world.get_entrance(return_entry[0]);
                    return_entrance.type = type;
                    return_entrance.secondary = true;
                    return_entrance.alias = display_names.entrance_aliases[return_entrance.name];
                    if (warp_entrance_types.includes(type)) return_entrance.is_warp = true;
                    return_entrance.coupled = !decoupled;
                    // group interior exits with other overworld entrances for the exit region
                    if (!!(return_entrance.original_connection)) {
                        return_entrance.type_alias = return_entrance.original_connection.name;
                    }

                    if (!!(return_entrance.parent_region.dungeon)) {
                        let dungeon_variant_name = return_entrance.world.dungeon_mq[return_entrance.parent_region.dungeon] ?
                            return_entrance.parent_region.dungeon :
                            `${return_entrance.parent_region.dungeon} MQ`;
                        let alt_return_entrance = return_entrance.world.get_entrance(return_entrance.name, dungeon_variant_name);
                        alt_return_entrance.copy_metadata(return_entrance);
                    }
                    forward_entrance.bind_two_way(return_entrance);
                }
            }

            world.create_region_groups();
        }
    }

    set_items(locations: PlandoLocationList | PlandoMWLocationList | null): void {
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
        for (let world of this.worlds) {
            // vanilla item fill based on settings
            for (let loc of world.get_locations()) {
                // reset location item in case shuffle settings changed
                if (loc.type !== 'Event') {
                    world.pop_item(loc);
                }

                if (!!(loc.vanilla_item) && !!(loc.parent_region)) {
                    loc.vanilla_item.world = loc.parent_region.world;
                } else if (loc.name === 'Gift from Sages' && !!(world.settings.shuffle_ganon_bosskey)
                            && ['stones', 'medallions', 'dungeons', 'tokens', 'hearts', 'triforce'].includes(world.settings.shuffle_ganon_bosskey)) {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                    loc.shuffled = false;
                    continue;
                } else {
                    continue;
                }
                if (loc.name === 'ToT Light Arrows Cutscene' && world.settings.shuffle_ganon_bosskey === 'on_lacs') {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                    loc.shuffled = false;
                } else if (world.settings.shopsanity === 'off' && loc.type === 'Shop') {
                    world.push_vanilla_item(loc);
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
                } else  if (loc.vanilla_item.name === 'Kokiri Sword' && !(world.settings.shuffle_kokiri_sword)) {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Ocarina' && !(world.settings.shuffle_ocarinas)) {
                    world.push_vanilla_item(loc);
                } else if (['Wasteland Bombchu Salesman', 'Kak Granny Buy Blue Potion'].includes(loc.name) && !(world.settings.shuffle_expensive_merchants)) {
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
                        }
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Thieves Hideout)' && world.settings.shuffle_hideoutkeys === 'vanilla') {
                    if (world.settings.gerudo_fortress !== 'open' &&
                        (loc.name === 'Hideout 1 Torch Jail Gerudo Key' || world.settings.gerudo_fortress !== 'fast')) {
                            world.push_vanilla_item(loc);
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Treasure Chest Game)' && world.settings.shuffle_tcgkeys === 'vanilla') {
                    // small key rings not implemented for vanilla keys (would otherwise skip lens of truth requirement)
                    world.push_vanilla_item(loc);
                } else if (['Event', 'Drop'].includes(loc.type) && !!(loc.vanilla_item)) {
                    // hard-coded events from the location list that don't auto-generate items of the same name
                    world.push_vanilla_item(loc);
                } else if (['Market Bombchu Bowling Bombchus', 'Market Bombchu Bowling Bomb'].includes(loc.name)) {
                    // never shuffled locations relevant to logic
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
                            //world.state.collect(loc.vanilla_item);
                        }
                    } else if (loc.vanilla_item.name === dungeon_text('Small Key', dungeon)) {
                        shuffle_setting = <string>world.settings.shuffle_smallkeys;
                    } else if (loc.type === 'SilverRupee') {
                        shuffle_setting = <string>world.settings.shuffle_silver_rupees;
                    }
                    if (shuffle_setting === 'vanilla') {
                        world.push_vanilla_item(loc);
                    } else if (['remove', 'startwith'].includes(shuffle_setting)) {
                        // important to do at this stage instead of with other skipped item collection
                        // so that the correct number of keys/silver rupees are in world state
                        world.state.collect(loc.vanilla_item);
                    }
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
                // don't override vanilla items
                if (world_location.item === null) {
                    if (typeof(item) === 'string') {
                        let world_item = ItemFactory(item, world)[0];
                        world_location.item = world_item;
                    } else {
                        // dict-style for ice traps and shop items
                        let world_item: Item;
                        if (!!item.player) {
                            world_item = ItemFactory(item.item, this.worlds[item.player-1])[0];
                        } else {
                            world_item = ItemFactory(item.item, world)[0];
                        }
                        if (!!item.price) {
                            world_item.price = item.price;
                        }
                        world_location.item = world_item;
                        world_location.price = world_item.price;
                    }
                }
            }
        }
    }

    set_entrances(entrances: PlandoEntranceList | PlandoMWEntranceList | null): void {
        let connected_entrances: PlandoEntranceList;
        for (let world of this.worlds) {
            // disconnect all shuffled entrances
            for (let entrance of world.get_entrances()) {
                if (!!(entrance.type) && world.shuffled_entrance_types.includes(entrance.type)) {
                    entrance.disconnect();
                    entrance.shuffled = true;
                // reset unshuffled entrances to vanilla targets to handle settings changes
                } else if (!!(entrance.type)) {
                    entrance.disconnect();
                    entrance.shuffled = false;
                    if (entrance.original_connection === null) throw `Tried to reconnect null vanilla entrance`;
                    entrance.connect(entrance.original_connection);
                    entrance.replaces = null;
                }
            }
            // Special handling for spawns since they have the same type but
            // can be individually shuffled (why...)
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('child')) {
                let entrance = world.get_entrance('Child Spawn -> KF Links House');
                entrance.disconnect();
                entrance.shuffled = true;
            }
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('adult')) {
                let entrance = world.get_entrance('Adult Spawn -> Temple of Time');
                entrance.disconnect();
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
                // don't override unshuffled entrances if they are defined in the plando
                if (src.connected_region === null) {
                    let dest = world.get_entrance_from_target(target);
                    if (dest.original_connection === null) throw `Plando tried to connect entrance target without original region connection`;
                    src.connect(dest.original_connection);
                    src.replaces = dest;
                    if (!!(src.reverse) && !!(dest.reverse) && !!(src.reverse.original_connection)) {
                        dest.reverse.connect(src.reverse.original_connection);
                        dest.reverse.replaces = src.reverse;
                    }
                }
            }

            // adjust blue warp exits even if dungeon/boss shuffles are off, in case they were previously shuffled.
            this.set_blue_warps(world);
        }
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
            this.collect_skipped_locations(world);
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
        blue_warp.disconnect();
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
        if (!!(ret?.connected_region)) {
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

    collect_skipped_locations(world: World): void {
        world.clear_skipped_locations();
        world.skipped_locations.push(world.get_location('Links Pocket'));
        if (!(world.settings.shuffle_gerudo_card) && world.settings.gerudo_fortress === 'open') {
            world.state.collect(ItemFactory('Gerudo Membership Card', world)[0]);
            world.skip_location('Hideout Gerudo Membership Card');
        }
        if (world.skip_child_zelda) {
            world.state.collect(ItemFactory('Weird Egg', world)[0]);
            if (!(world.get_location('HC Malon Egg').shuffled)) world.skip_location('HC Malon Egg');
            for (let loc_name of ['HC Zeldas Letter', 'Song from Impa']) {
                world.skip_location(loc_name);
            }
        }
        if (world.settings.free_scarecrow) {
            world.state.collect(ItemFactory('Scarecrow Song', world)[0]);
        }
        if (world.settings.no_epona_race) {
            world.state.collect(ItemFactory('Epona', world, true)[0]);
        }
        if (world.settings.shuffle_smallkeys === 'vanilla') {
            if (world.dungeon_mq['Spirit Temple']) {
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
            }
            if (!!(world.settings.dungeon_shortcuts) && world.settings.dungeon_shortcuts.includes('Shadow Temple')) {
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world)[0]);
            }
        }
        if (!(world.keysanity) && !(world.dungeon_mq['Fire Temple'])) {
            world.state.collect(ItemFactory('Small Key (Fire Temple)', world)[0]);
        }
        if (world.settings.shuffle_tcgkeys === 'remove') {
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
        }
        if (!(world.settings.shuffle_individual_ocarina_notes) && this.ootr_version.gte('7.1.138')) {
            world.state.collect(ItemFactory('Ocarina A Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C up Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C down Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C left Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C right Button', world)[0]);
        }
        // TODO: empty dungeons
    }
}

export default OotrGraphPlugin;