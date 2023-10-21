import { GraphWorld } from "../GraphPlugin.js";

import { Item, MakeEventItem } from "./Item.js";
import { Location, LocationFactory } from "./Location.js";
import Entrance from './Entrance.js';
import { TimeOfDay } from "./Region.js";
import { Region } from "./Region.js";
import RuleParser from "./RuleParser.js";
import { read_json, replace_python_booleans } from "./Utils.js";
import WorldState from "./WorldState.js";
import { HintAreas } from './Hints.js';
import HintArea from "./HintArea.js";
import OotrVersion from "./OotrVersion.js";
import OotrGraphPlugin from "./OotrGraphPlugin.js";
import SettingsList from "./SettingsList.js";
import type { SettingsDictionary } from "./SettingsList.js";
import { RegionGroup } from "./RegionGroup.js";
import { display_names } from './DisplayNames.js';

type Dictionary<T> = {
    [key: string]: T,
};

type SavewarpConnection = [Entrance, string];

export type PlandoEntranceList = {
    [entrance_name: string]: PlandoEntranceTarget | string,
};
export type PlandoEntranceTarget = {
    region: string,
    from?: string,
};
export type PlandoMWEntranceList = {
    [world_key: string]: PlandoEntranceList,
};


export type PlandoLocationList = {
    [location_name: string]: PlandoItem | string,
};
export type PlandoItem = {
    item: string,
    price?: number,
    model?: string,
    player?: number,
}
export type PlandoMWLocationList = {
    [world_key: string]: PlandoLocationList,
}

class World implements GraphWorld {

    public id: number;
    public settings: SettingsDictionary;
    public version: OotrVersion;
    public parent_graph: OotrGraphPlugin;
    public regions: Region[] = [];
    public dungeons: {[dungeon_variant_name: string]: Region[]} = {};
    public dungeon_variant: string = '';
    public region_groups: RegionGroup[] = [];
    public _cached_locations: Location[];
    public _cached_entrances: Entrance[];
    public _entrance_cache: Dictionary<Entrance>;
    public _region_cache: Dictionary<Region>;
    public _location_cache: Dictionary<Location>;
    public _region_group_cache: Dictionary<RegionGroup>;
    public skipped_locations: Location[];

    public parser: RuleParser;
    public event_items: Set<string>;

    public skipped_trials: Dictionary<boolean>;
    public dungeon_mq: Dictionary<boolean>;
    public song_notes: Dictionary<string>;

    public keysanity: boolean = false;
    public shuffle_silver_rupees: boolean = false;
    public shuffle_enemy_spawns: boolean = false;
    public check_beatable_only: boolean = false;
    public shuffle_special_interior_entrances: boolean = false;
    public shuffle_interior_entrances: boolean = false;
    public shuffle_special_dungeon_entrances: boolean = false;
    public shuffle_dungeon_entrances: boolean = false;
    public spawn_shuffle: boolean = false;
    public entrance_shuffle: boolean = false;
    public mixed_pools_bosses: boolean = false;
    public ensure_tod_access: boolean = false;
    public disable_trade_revert: boolean = false;
    public skip_child_zelda: boolean = false;
    public triforce_goal: number = 0;

    public shuffled_entrance_types: string[] = [];

    public state: WorldState;

    constructor(id: number, settings: SettingsList, ootr_version: OotrVersion, parent_graph: OotrGraphPlugin) {
        if (Object.keys(settings).includes('randomized_settings')) {
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                settings.override_settings({settings: settings.randomized_settings[`World ${id+1}`]});
            } else {
                settings.override_settings({settings: settings.randomized_settings});
            }
        }
        this.settings = settings.settings;
        if (!(Object.keys(this.settings).includes('debug_parser'))) {
            this.settings.debug_parser = false;
        }
        this.id = id;
        this.version = ootr_version;
        this.parent_graph = parent_graph;
        this.regions = [];
        this._cached_locations = [];
        this._cached_entrances = [];
        this._entrance_cache = {};
        this._region_cache = {};
        this._location_cache = {};
        this._region_group_cache = {};
        this.skipped_locations = [];

        let debug: boolean = (!!(this.settings.debug_parser)) ? this.settings.debug_parser : false;
        this.parser = new RuleParser(this, this.version, debug);
        this.event_items = new Set();

        // Trials are enabled by default assuming the provided plando has a trials section
        // to disable specific trials.
        // Plando takes precedence over the plugin API for initial setup as the API will
        // not yet have any user input.
        this.skipped_trials = {
            'Forest': false,
            'Fire': false,
            'Water': false,
            'Spirit': false,
            'Shadow': false,
            'Light': false,
        };
        if (Object.keys(settings).includes('trials')) {
            let trials_settings;
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                trials_settings = settings.trials[`World ${id+1}`];
            } else {
                trials_settings = settings.trials;
            }
            for (let [trial, enabled] of Object.entries(trials_settings)) {
                this.skipped_trials[trial] = enabled == 'inactive';
            }
        } else {
            // If there is no trials plando section provided, assume trials
            // are skipped unless specified in the plugin API. The API defaults
            // to all trials enabled.
            this.skipped_trials = {
                'Forest': true,
                'Fire': true,
                'Water': true,
                'Spirit': true,
                'Shadow': true,
                'Light': true,
            };
            for (let trial of this.settings.graphplugin_trials_specific) {
                this.skipped_trials[trial] = false;
            }
        }

        // same situation as trials for MQ dungeons
        this.dungeon_mq = {
            'Deku Tree': false,
            'Dodongos Cavern': false,
            'Jabu Jabus Belly': false,
            'Bottom of the Well': false,
            'Ice Cavern': false,
            'Gerudo Training Ground': false,
            'Forest Temple': false,
            'Fire Temple': false,
            'Water Temple': false,
            'Spirit Temple': false,
            'Shadow Temple': false,
            'Ganons Castle': false
        }
        if (Object.keys(settings).includes('dungeons')) {
            let dungeon_settings;
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                dungeon_settings = settings.dungeons[`World ${id+1}`];
            } else {
                dungeon_settings = settings.dungeons;
            }
            for (let [dungeon, dtype] of Object.entries(dungeon_settings)) {
                this.dungeon_mq[dungeon] = dtype === 'mq';
            }
        } else {
            // There is a randomizer setting for specific MQ dungeons, but
            // this will always match the plando section for initialization.
            // This branch is kept as a failsafe.
            if (Array.isArray(this.settings.mq_dungeons_specific)) {
                for (let dungeon of this.settings.mq_dungeons_specific) {
                    this.dungeon_mq[dungeon] = true;
                }
            }
        }

        // assume all notes are required for all songs if melodies
        // are shuffled and a given song melody isn't known
        if (this.settings.ocarina_songs) {
            this.song_notes = {
                "Zeldas Lullaby": "<^>vA",
                "Eponas Song": "<^>vA",
                "Sarias Song": "<^>vA",
                "Suns Song": "<^>vA",
                "Song of Time": "<^>vA",
                "Song of Storms": "<^>vA",
                "Minuet of Forest": "<^>vA",
                "Bolero of Fire": "<^>vA",
                "Serenade of Water": "<^>vA",
                "Requiem of Spirit": "<^>vA",
                "Nocturne of Shadow": "<^>vA",
                "Prelude of Light": "<^>vA",
            }
            this.settings.graphplugin_song_melodies = {};
        } else {
            this.song_notes = this.settings.graphplugin_song_melodies;
        }
        // add known melodies, skipping unknown (assumed all notes if shuffled)
        if (Object.keys(settings).includes('songs')) {
            for (let [song_name, melody] of Object.entries(settings.songs)) {
                this.song_notes[song_name] = melody as string;
                this.settings.graphplugin_song_melodies[song_name] = melody as string;
            }
        }

        this.update_internal_settings();

        this.state = new WorldState(this);
    }

    update_internal_settings(): void {
        this.keysanity = ['keysanity', 'remove', 'any_dungeon', 'overworld', 'regional'].includes(<string>this.settings.shuffle_smallkeys);
        this.shuffle_silver_rupees = this.settings.shuffle_silver_rupees !== 'vanilla';
        if (Object.keys(this.settings).includes('shuffle_enemy_spawns')) {
            this.shuffle_enemy_spawns = this.settings.shuffle_enemy_spawns !== 'off';
        }
        this.check_beatable_only = this.settings.reachable_locations !== 'all';
        this.shuffle_special_interior_entrances = this.settings.shuffle_interior_entrances === 'all';
        this.shuffle_interior_entrances = ['simple', 'all'].includes(<string>this.settings.shuffle_interior_entrances);
        this.shuffle_special_dungeon_entrances = this.settings.shuffle_dungeon_entrances === 'all';
        this.shuffle_dungeon_entrances = ['simple', 'all'].includes(<string>this.settings.shuffle_dungeon_entrances);
        this.spawn_shuffle = false;
        if (!!(this.settings.spawn_positions)) {
            this.spawn_shuffle = this.settings.spawn_positions.length > 0;
        }
        this.entrance_shuffle = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_grotto_entrances || this.shuffle_dungeon_entrances
            || <boolean>this.settings.shuffle_overworld_entrances || <boolean>this.settings.shuffle_gerudo_valley_river_exit || <boolean>this.settings.owl_drops
            || <boolean>this.settings.warp_songs || this.spawn_shuffle || (this.settings.shuffle_bosses !== 'off');
        this.mixed_pools_bosses = false;
        this.ensure_tod_access = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_overworld_entrances || this.spawn_shuffle;
        this.disable_trade_revert = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_overworld_entrances || <boolean>this.settings.adult_trade_shuffle;
        this.skip_child_zelda = false;
        if (!!(this.settings.shuffle_child_trade) && !!(this.settings.starting_items)) {
            this.skip_child_zelda = !(this.settings.shuffle_child_trade.includes('Zeldas Letter')) && 'Zeldas Letter' in this.settings.starting_items;
        }

        if (this.settings.open_forest === 'closed' && 
            (this.shuffle_special_interior_entrances || this.settings.shuffle_hideout_entrances || this.settings.shuffle_overworld_entrances
            || this.settings.warp_songs || this.settings.spawn_positions)) {
            this.settings.open_forest = 'closed_deku';
        }

        this.triforce_goal = 0;
        if (!!(this.settings.world_count) && !!(this.settings.triforce_goal_per_world)) {
            this.triforce_goal = this.settings.triforce_goal_per_world * this.settings.world_count;
        }
        if (this.settings.triforce_hunt) {
            this.settings.shuffle_ganon_bosskey = 'triforce';
        }

        this.shuffled_entrance_types = [];
        if (this.shuffle_dungeon_entrances) this.shuffled_entrance_types.push('Dungeon');
        if (this.shuffle_special_dungeon_entrances) this.shuffled_entrance_types.push('DungeonSpecial');
        if (this.settings.shuffle_bosses !== 'off') this.shuffled_entrance_types.push('ChildBoss', 'AdultBoss');
        if (this.shuffle_interior_entrances) this.shuffled_entrance_types.push('Interior');
        if (this.shuffle_special_interior_entrances) this.shuffled_entrance_types.push('SpecialInterior');
        if (this.settings.shuffle_hideout_entrances) this.shuffled_entrance_types.push('Hideout');
        if (this.settings.shuffle_grotto_entrances) this.shuffled_entrance_types.push('Grotto', 'Grave');
        if (this.settings.shuffle_overworld_entrances) this.shuffled_entrance_types.push('Overworld');
        if (this.settings.shuffle_gerudo_valley_river_exit) this.shuffled_entrance_types.push('OverworldOneWay');
        if (this.settings.owl_drops) this.shuffled_entrance_types.push('OwlDrop');
        if (this.settings.warp_songs) this.shuffled_entrance_types.push('WarpSong');
    }

    reset_all_access_rules(): void {
        for (let location of this.get_locations()) {
            location.reset_rules();
        }

        // Currently no dynamic entrance rules
        // Disable until required to avoid unnecessary iteration
        // for (let entrance of this.get_entrances()) {
        //     entrance.reset_rules();
        // }
    }

    load_regions_from_json(file_path: string, is_dungeon_variant: boolean = false): SavewarpConnection[] {
        let world_folder;
        if (this.settings.logic_rules === 'glitched') {
            world_folder = 'Glitched World';
        } else {
            world_folder = 'World';
        }
        let region_json = read_json(world_folder + '/' + file_path, this.parent_graph.file_cache);
        let savewarps_to_connect: SavewarpConnection[] = [];
        if (this.parent_graph.debug) console.log(`parsing ${file_path}`);
        for (const region of region_json) {
            let new_region = new Region(region.region_name, this);
            if (!!region.scene) {
                new_region.scene = region.scene;
            }
            if (!!region.hint) {
                new_region.hint_name = region.hint;
            }
            if (!!region.alt_hint) {
                new_region.alt_hint_name = region.alt_hint;
            }
            if (!!region.dungeon) {
                new_region.dungeon = region.dungeon;
            }
            if (!!region.is_boss_room) {
                new_region.is_boss_room = region.is_boss_room.toLowerCase() === "true"; // should probably fix this in upstream...
            }
            if (!!region.time_passes) {
                new_region.time_passes = region.time_passes;
                new_region.provides_time = TimeOfDay.ALL;
            }
            if (new_region.name === 'Ganons Castle Grounds') {
                new_region.provides_time = TimeOfDay.DAMPE;
            }
            if (!!region.locations) {
                for (const [location, rule] of Object.entries(region.locations)) {
                    let new_location = LocationFactory(location, this)[0];
                    new_location.parent_region = new_region;
                    new_location.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        if (this.parent_graph.debug) console.log(`parsing ${new_location.name}`);
                        this.parser.parse_spot_rule(new_location);
                    }
                    new_region.locations.push(new_location);
                }
            }
            if (!!region.events) {
                for (const [event, rule] of Object.entries(region.events)) {
                    let lname = `${event} from ${new_region.name}`;
                    let new_location = new Location(lname, 'Event', new_region, false, this);
                    new_location.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        if (this.parent_graph.debug) console.log(`parsing ${new_location.name}`);
                        this.parser.parse_spot_rule(new_location);
                    }
                    if (!(new_location.never)) {
                        new_location.world = this;
                        new_region.locations.push(new_location);
                        MakeEventItem(event, new_location);
                    }
                }
            }
            if (!!region.exits) {
                for (const [exit, rule] of Object.entries(region.exits)) {
                    let new_exit = new Entrance(`${new_region.name} -> ${exit}`, new_region, this);
                    new_exit.original_connection_name = exit;
                    new_exit.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        if (this.parent_graph.debug) console.log(`parsing ${new_exit.name}`);
                        this.parser.parse_spot_rule(new_exit);
                    }
                    new_region.exits.push(new_exit);
                }
            }
            if (!!region.savewarp) {
                let savewarp_target = region.savewarp.split(' -> ')[1];
                let new_exit = new Entrance(`${new_region.name} -> ${savewarp_target}`, new_region, this);
                new_exit.original_connection_name = savewarp_target;
                new_exit.is_warp = true;
                new_region.exits.push(new_exit);
                new_region.savewarp = new_exit;
                savewarps_to_connect.push([new_exit, region.savewarp]);
            }
            if (is_dungeon_variant) {
                this.dungeons[this.dungeon_variant].push(new_region);
            } else {
                this.regions.push(new_region);
            }
        }
        return savewarps_to_connect;
    }

    create_dungeons(): SavewarpConnection[] {
        let savewarps_to_connect = [];
        for (const hint_area in HintAreas) {
            let name = HintAreas[hint_area].dungeon_name;
            if (!!name) {
                this.dungeon_variant = name;
                this.dungeons[this.dungeon_variant] = [];
                let vanilla_savewarps = this.load_regions_from_json(`${this.dungeon_variant}.json`, true);
                this.dungeon_variant = `${name} MQ`;
                this.dungeons[this.dungeon_variant] = [];
                let mq_savewarps = this.load_regions_from_json(`${this.dungeon_variant}.json`, true);
                this.dungeon_variant = '';
                if (!this.dungeon_mq[name]) {
                    this.regions.push(...(this.dungeons[name]));
                    savewarps_to_connect.push(...vanilla_savewarps);
                } else {
                    this.regions.push(...(this.dungeons[`${name} MQ`]));
                    savewarps_to_connect.push(...mq_savewarps);
                }
            }
        }
        return savewarps_to_connect;
    }

    swap_dungeon(dungeon_to_connect: string, dungeon_to_disconnect: string): void {
        this.connect_dungeon(dungeon_to_connect);
        this.disconnect_dungeon(dungeon_to_disconnect);

        // clean out any stray references to removed dungeon objects in the caches
        this._cached_locations = [];
        this._cached_entrances = [];
        this._entrance_cache = {};
        this._region_cache = {};
        this._location_cache = {};
        this.parent_graph.reset_cache();
    }

    connect_dungeon(dungeon_variant_name: string): void {
        // copy regions to main region cache
        let group_copied = false;
        for (let region of this.dungeons[dungeon_variant_name]) {
            // add region group
            this.regions.push(region);
            if (!!(region.parent_group) && !group_copied) {
                this.region_groups.push(region.parent_group);
                group_copied = true;
            }
            // connect outside interface entrances to world
            // and disconnect connections from the other variant
            for (let exit of region.exits) {
                if (!!(exit.alternate)) {
                    if (!!(exit.alternate.reverse)) {
                        exit.bind_two_way(exit.alternate.reverse);
                        if (!!(exit.reverse)) {
                            exit.reverse.original_connection = region;
                        }
                    }
                    if (!!(exit.alternate.connected_region)) {
                        let target = exit.alternate.disconnect();
                        exit.connect(target);
                        exit.replaces = exit.alternate.replaces;
                        exit.alternate.replaces = null;
                        /*if (!!(exit.replaces) && exit.coupled) {
                            if (!!(exit.replaces.reverse)) {
                                exit.replaces.reverse.disconnect();
                                exit.replaces.reverse.connect(region);
                                exit.replaces.reverse.replaces = exit.reverse;
                            }
                        } else if (!exit.shuffled && !!(exit.reverse)) {
                            exit.reverse.disconnect();
                            exit.reverse.connect(region);
                        }*/
                    }
                }
            }
        }
        // Handle both coupled and decoupled entrances from the overworld to dungeons.
        // Decoupled connections are not discoverable with exit.replaces.reverse or exit.reverse.
        // Also handle never shuffled reverse entrances, such as Farore's Wind.
        let alt_dungeon_variant_name = dungeon_variant_name.substring(dungeon_variant_name.length - 2) === 'MQ' ? dungeon_variant_name.substring(0, dungeon_variant_name.length - 3) : `${dungeon_variant_name} MQ`;
        let all_dungeon_regions = Object.values(this.dungeons).flat();
        let alt_dungeon_regions = Object.values(this.dungeons[alt_dungeon_variant_name]);
        let other_regions = this.regions.filter((r) => !(all_dungeon_regions.includes(r)));
        for (let region of other_regions) {
            for (let exit of region.exits) {
                if (!!(exit.connected_region) && alt_dungeon_regions.includes(exit.connected_region)) {
                    let alt_region = exit.disconnect();
                    exit.connect(this.get_region(alt_region.name, dungeon_variant_name));
                }
                if (!!(exit.original_connection) && alt_dungeon_regions.includes(exit.original_connection)) {
                    // no need to update original connection property as these entrances aren't shuffled,
                    // but done anyway just in case since the target region group is important
                    let new_original_target = this.get_region(exit.original_connection.name, dungeon_variant_name);
                    exit.original_connection = new_original_target;
                    exit.target_group = new_original_target.parent_group;
                }
            }
        }
    }

    disconnect_dungeon(dungeon_variant_name: string): void {
        for (let region of this.dungeons[dungeon_variant_name]) {
            // remove regions from main region cache
            let region_index = this.regions.indexOf(region);
            if (region_index > -1) {
                this.regions.splice(region_index, 1);
            }
            // remove region group
            if (!!(region.parent_group)) {
                let region_group_index = this.region_groups.indexOf(region.parent_group);
                if (region_group_index > -1) {
                    this.region_groups.splice(region_group_index, 1);
                }
            }
        }
    }

    create_internal_locations(): void {
        this.parser.create_delayed_rules();
        if (this.parser.events.size > this.event_items.size) {
            throw('Parse error: undefined items in parser event list');
        }
    }

    initialize_entrances(): void {
        let target_region;
        let dungeon_region_names = Object.values(this.dungeons).flat().map((r) => r.name);
        // regions include dungeon regions from initial MQ selection settings, filter out to Overworld+Bosses only
        let region_names = this.regions.filter((r) => !(dungeon_region_names.includes(r.name))).map((r) => r.name);
        for (let region of this.regions) {
            for (let exit of region.exits) {
                exit.world = this;
                if (exit.original_connection_name === null) throw `Region has exits without assigned region`;
                target_region = this.get_region(exit.original_connection_name);
                exit.connect(target_region);
                exit.original_connection = target_region;
                // link vanilla and MQ dungeon entrance interfaces to outside regions
                // to enable swapping connections on settings change
                if (dungeon_region_names.includes(region.name) && region_names.includes(target_region.name)) {
                    if (region.dungeon === null) throw `Tried to link dungeon variant entrance for invalid dungeon region ${region.name}`;
                    let dungeon_variant_name = this.dungeon_mq[region.dungeon] ? region.dungeon : `${region.dungeon} MQ`;
                    // For now, hard code Ganon's Castle<->Tower handling since Tower isn't shuffled and connects
                    // to different Castle regions in Vanilla and MQ.
                    // Similar problem for Spirit Temple<->Colossus Hands.
                    let alt_region: Region;
                    let exit_name = exit.name;
                    if (region.dungeon === 'Ganons Castle' && target_region.name === 'Ganons Castle Tower') {
                        let region_override = this.dungeon_mq[region.dungeon] ? 'Ganons Castle Lobby' : 'Ganons Castle Main';
                        alt_region = this.get_region(region_override, dungeon_variant_name);
                        exit_name = `${alt_region.name} -> ${target_region.name}`;
                    } else if (region.dungeon === 'Spirit Temple' && target_region.name === 'Desert Colossus Hands') {
                        let region_override = this.dungeon_mq[region.dungeon] ? 'Spirit Temple Central Chamber' : 'Spirit Temple Shared';
                        alt_region = this.get_region(region_override, dungeon_variant_name);
                        exit_name = `${alt_region.name} -> ${target_region.name}`;
                    } else {
                        alt_region = this.get_region(region.name, dungeon_variant_name);
                    }
                    for (let alt_exit of alt_region.exits) {
                        if (alt_exit.name === exit_name) {
                            exit.alternate = alt_exit;
                            alt_exit.alternate = exit;
                        }
                    }
                }
            }
        }
        for (let [dungeon_variant_name, dungeon_regions] of Object.entries(this.dungeons)) {
            for (let region of dungeon_regions) {
                for (let exit of region.exits) {
                    // skip regions already connected
                    if (!!(exit.connected_region)) continue;
                    exit.world = this;
                    if (exit.original_connection_name === null) throw `Region has exits without assigned region`;
                    try {
                        target_region = this.get_region(exit.original_connection_name, dungeon_variant_name);
                    } catch {
                        // interface original target regions are in the overworld list, not variant
                        target_region = this.get_region(exit.original_connection_name);
                    }
                    exit.original_connection = target_region;
                    // don't connect dungeon interfaces to outside
                    if (!!(exit.alternate)) continue;
                    exit.connect(target_region);
                }
            }
        }
    }

    create_region_groups() {
        this._region_group_cache = {};
        this.region_groups = [];
        for (let region of this.regions) {
            this.create_region_group(region);
        }
        for (let region_group of Object.values(this._region_group_cache)) {
            region_group.sort_lists();
            this.region_groups.push(region_group);
        }
        // Clear region group cache to ensure region variants create new groups
        this._region_group_cache = {};
        // Don't need to add the group to the world for alternate region variants.
        // The group is saved in its child regions.
        for (let [dungeon, is_mq] of Object.entries(this.dungeon_mq)) {
            let dungeon_variant_name = is_mq ? dungeon : `${dungeon} MQ`;
            let region_group: RegionGroup | undefined;
            for (let region of this.dungeons[dungeon_variant_name]) {
                region_group = this.create_region_group(region);
            }
            // Each dungeon guaranteed to be one region group
            if (!!region_group) {
                region_group.sort_lists();
            }
        }
    }

    create_region_group(region: Region): RegionGroup | undefined {
        let alias: string = '';
        for (let [group_alias, sub_regions] of Object.entries(display_names.region_groups)) {
            if (sub_regions.includes(region.name)) {
                alias = group_alias;
                break;
            }
        }
        if (alias !== '') {
            let region_group = this.get_region_group(alias);
            region_group.add_region(region);
            return region_group;
        }
    }

    // Has to run after overworld region groups are created and entrance metadata is calculated
    create_target_region_group(starting_entrance: Entrance): RegionGroup {
        let starting_region = starting_entrance.original_connection;
        if (starting_region === null) throw `Failed to create target region group: empty original connection for entrance ${starting_entrance.name}`
        let region_group = this.get_region_group(starting_entrance.name);
        region_group.page = '';
        region_group.add_region(starting_region);
        let exits = [];
        let regions = [];
        let processed_regions: Region[] = [starting_region];
        exits.push(...starting_region.exits.filter(e => e.type === null && e.target_group === null && !e.is_warp));
        while (exits.length > 0 || regions.length > 0) {
            //console.log(`regions: ${regions.length}, exits: ${exits.length}`);
            if (regions.length <= 0) {
                for (let exit of exits) {
                    //console.log(`exit: ${exit.name}`);
                    if (!!exit.connected_region && !(processed_regions.includes(exit.connected_region))) {
                        regions.push(exit.connected_region);
                    }
                }
                exits = [];
            }
            for (let region of regions) {
                //console.log(`region ${region.name}`);
                region_group.add_region(region);
                exits.push(...region.exits.filter(e => e.type === null && e.target_group === null && !e.is_warp));
                processed_regions.push(region);
            }
            regions = [];
        }
        return region_group;
    }

    get_region_group(region_name: string): RegionGroup {
        if (!(region_name in this._region_group_cache)) {
            this._region_group_cache[region_name] = new RegionGroup(region_name, this);
        }
        return this._region_group_cache[region_name];
    }

    get_region(region_name: Region | string, dungeon_variant_name: string = ''): Region {
        if (region_name instanceof Region) {
            return region_name;
        }
        // only search cache if requested region isn't from a dungeon vanilla/mq variant
        if (region_name in this._region_cache && dungeon_variant_name === '') {
            return this._region_cache[region_name];
        } else {
            let region: Region[];
            if (dungeon_variant_name === '') {
                region = this.regions.filter(r => r.name === region_name);
            } else {
                region = this.dungeons[dungeon_variant_name].filter(r => r.name === region_name);
            }
            if (region.length === 1) {
                // only keep connected regions in the cache, not disconnected dungeon variants
                if (dungeon_variant_name === '') {
                    this._region_cache[region_name] = region[0];
                }
                return region[0];
            } else {
                throw(`No such region ${region_name}`);
            }
        }
    }

    get_entrance(entrance: Entrance | string, dungeon_variant_name: string = ''): Entrance {
        if (entrance instanceof Entrance) {
            return entrance;
        }
        // only search cache if requested region isn't from a dungeon vanilla/mq variant
        if (entrance in this._entrance_cache && dungeon_variant_name === '') {
            return this._entrance_cache[entrance];
        } else {
            let regions: Region[];
            if (dungeon_variant_name === '') {
                regions = this.regions;
            } else {
                regions = this.dungeons[dungeon_variant_name];
            }
            for (let i = 0; i < regions.length; i++) {
                for (let j = 0; j < regions[i].exits.length; j++) {
                    if (regions[i].exits[j].name === entrance) {
                        // only keep connected regions in the cache, not disconnected dungeon variants
                        if (dungeon_variant_name === '') {
                            this._entrance_cache[entrance] = regions[i].exits[j];
                        }
                        return regions[i].exits[j];
                    }
                }
            }
            throw(`No such entrance ${entrance}`);
        }
    }

    get_entrance_from_target(target: PlandoEntranceTarget | string): Entrance {
        let t: PlandoEntranceTarget;
        if (typeof(target) === 'string') {
            t = {'region': target};
        } else {
            t = target;
        }
        let entrances = this.get_entrances();
        let candidates = entrances.filter((e) => !!e.original_connection && e.original_connection.name === t.region && !!(e.type));
        let match;
        if (Object.keys(t).includes('from')) {
            match = candidates.filter((c) => c.parent_region.name === t.from);
        } else {
            // string targets can only be certain entrance types, see EntranceRecord.from_entrance in the ootr source
            match = candidates.filter((c) => !!c.type && ['Interior', 'SpecialInterior', 'Grotto', 'Grave'].includes(c.type));
        }
        if (match.length === 1) {
            return match[0];
        } else {
            throw(`Could not find entrance matching target ${JSON.stringify(target)}`);
        }
    }

    get_location(location: Location | string): Location {
        if (location instanceof Location) {
            return location;
        }
        if (location in this._location_cache) {
            return this._location_cache[location];
        } else {
            for (let i = 0; i < this.regions.length; i++) {
                for (let j = 0; j < this.regions[i].locations.length; j++) {
                    if (this.regions[i].locations[j].name === location) {
                        this._location_cache[location] = this.regions[i].locations[j];
                        return this.regions[i].locations[j];
                    }
                }
            }
            throw(`No such location ${location}`);
        }
    }

    push_item(location: Location | string, item: Item, manual: boolean = false) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }

        location.item = item;
        item.location = location;
        item.price = location.price !== null ? location.price : item.price;
        location.price = item.price;
    }

    push_vanilla_item(location: Location | string, manual: boolean = false) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }

        if (location.vanilla_item === null) throw `Fill error: tried to push null vanilla item to location ${location.name}`;
        let item = location.vanilla_item.copy();
        this.push_item(location, item);
        location.shuffled = false;
    }

    pop_item(location: Location | string) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }

        location.item = null;
        location.price = null;
        location.shuffled = true;
    }

    skip_location(location: Location | string) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }
        this.skipped_locations.push(location);
        location.internal = true;
    }

    clear_skipped_locations(): void {
        for (let l of this.skipped_locations) {
            if (l.type !== 'Event') l.internal = false;
        }
        this.skipped_locations = [];
    }

    get_locations(with_disconnected_regions: boolean = false): Location[] {
        if (this._cached_locations.length === 0) {
            for (const region of this.regions) {
                this._cached_locations.push(...(region.locations));
            }
        }
        // Locations in disconnected regions is only required to change
        // drop location names to include their parent region names
        // during initialization
        if (with_disconnected_regions) {
            let dungeon_regions: Location[] = [];
            for (let [dungeon, is_mq] of Object.entries(this.dungeon_mq)) {
                let dungeon_variant_name = is_mq ? dungeon : `${dungeon} MQ`;
                for (let regions of this.dungeons[dungeon_variant_name]) {
                    dungeon_regions.push(...(regions.locations));
                }
            }
            dungeon_regions.push(...(this._cached_locations));
            return dungeon_regions;
        } else {
            return this._cached_locations;
        }
    }

    get_entrances(): Entrance[] {
        if (this._cached_entrances.length === 0) {
            for (const region of this.regions) {
                this._cached_entrances.push(...(region.exits));
            }
        }
        return this._cached_entrances;
    }

    region_has_shortcuts(region_name: string): boolean {
        if (this.settings.dungeon_shortcuts === undefined) throw `Could not check dungeon shortcut settings, undefined for world ${this.id}`;
        let region = this.get_region(region_name);
        if (region === null) throw `Could not find region ${region_name} in world while checking for dungeon shortcuts`;
        let dungeon_hintarea = HintArea.at(region);
        if (dungeon_hintarea === null) throw `Could not find associated dungeon for ${region_name}`;
        let dungeon_name = dungeon_hintarea.dungeon_name;
        if (dungeon_name === null) throw `Could not find associated dungeon name for ${region_name}`;
        return this.settings.dungeon_shortcuts.includes(dungeon_name);
    }
}

export default World;