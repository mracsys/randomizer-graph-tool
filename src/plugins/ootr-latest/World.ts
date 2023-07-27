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
    public _cached_locations: Location[];
    public _cached_entrances: Entrance[];
    public _entrance_cache: Dictionary<Entrance>;
    public _region_cache: Dictionary<Region>;
    public _location_cache: Dictionary<Location>;
    public skipped_locations: Location[];

    public parser: RuleParser;
    public event_items: Set<string>;

    public skipped_trials: Dictionary<boolean>;
    public dungeon_mq: Dictionary<boolean>;
    public song_notes: Dictionary<string>;

    public keysanity: boolean;
    public shuffle_silver_rupees: boolean;
    public check_beatable_only: boolean;
    public shuffle_special_interior_entrances: boolean;
    public shuffle_interior_entrances: boolean;
    public shuffle_special_dungeon_entrances: boolean;
    public shuffle_dungeon_entrances: boolean;
    public spawn_shuffle: boolean;
    public entrance_shuffle: boolean;
    public mixed_pools_bosses: boolean;
    public ensure_tod_access: boolean;
    public disable_trade_revert: boolean;
    public skip_child_zelda: boolean;
    public triforce_goal: number;

    public shuffled_entrance_types: string[];

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
        this.skipped_locations = [];

        let debug: boolean = (!!(this.settings.debug_parser)) ? this.settings.debug_parser : false;
        this.parser = new RuleParser(this, this.version, debug);
        this.event_items = new Set();

        if (Object.keys(settings).includes('trials')) {
            let trials_settings;
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                trials_settings = settings.trials[`World ${id+1}`];
            } else {
                trials_settings = settings.trials;
            }
            this.skipped_trials = {};
            for (let [trial, enabled] of Object.entries(trials_settings)) {
                this.skipped_trials[trial] = enabled == 'inactive';
            }
        } else {
            this.skipped_trials = {
                "Forest": false,
                "Fire":   false,
                "Water":  false,
                "Spirit": false,
                "Shadow": false,
                "Light":  false
            };
        }

        if (Object.keys(settings).includes('dungeons')) {
            let dungeon_settings;
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                dungeon_settings = settings.dungeons[`World ${id+1}`];
            } else {
                dungeon_settings = settings.dungeons;
            }
            this.dungeon_mq = {};
            for (let [dungeon, dtype] of Object.entries(dungeon_settings)) {
                this.dungeon_mq[dungeon] = dtype === 'mq';
            }
        } else {
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
        }

        if (Object.keys(settings).includes('songs')) {
            this.song_notes = settings.songs;
        } else {
            this.song_notes = {
                "Zeldas Lullaby":     "<^><^>",
                "Eponas Song":        "^<>^<>",
                "Sarias Song":        "v><v><",
                "Suns Song":          ">v^>v^",
                "Song of Time":       ">Av>Av",
                "Song of Storms":     "Av^Av^",
                "Minuet of Forest":   "A^<><>",
                "Bolero of Fire":     "vAvA>v>v",
                "Serenade of Water":  "Av>><",
                "Requiem of Spirit":  "AvA>vA",
                "Nocturne of Shadow": "<>>A<>v",
                "Prelude of Light":   "^>^><^"
            }
        }

        this.keysanity = ['keysanity', 'remove', 'any_dungeon', 'overworld', 'regional'].includes(<string>this.settings.shuffle_smallkeys);
        this.shuffle_silver_rupees = this.settings.shuffle_silver_rupees !== 'vanilla';
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

        this.state = new WorldState(this);
    }

    load_regions_from_json(file_path: string): SavewarpConnection[] {
        let world_folder;
        if (this.settings.logic_rules === 'glitched') {
            world_folder = 'Glitched World';
        } else {
            world_folder = 'World';
        }
        let region_json = read_json(world_folder + '/' + file_path, this.parent_graph.file_cache);
        let savewarps_to_connect: SavewarpConnection[] = [];
        //console.log(`parsing ${file_path}`);
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
                new_region.is_boss_room = region.is_boss_room === "true"; // should probably fix this in upstream...
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
                        //console.log(`parsing ${new_location.name}`);
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
                        //console.log(`parsing ${new_location.name}`);
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
                        //console.log(`parsing ${new_exit.name}`);
                        this.parser.parse_spot_rule(new_exit);
                    }
                    new_region.exits.push(new_exit);
                }
            }
            if (!!region.savewarp) {
                let savewarp_target = region.savewarp.split(' -> ')[1];
                let new_exit = new Entrance(`${new_region.name} -> ${savewarp_target}`, new_region, this);
                new_exit.original_connection_name = savewarp_target;
                new_region.exits.push(new_exit);
                new_region.savewarp = new_exit;
                savewarps_to_connect.push([new_exit, region.savewarp]);
            }
            this.regions.push(new_region);
        }
        return savewarps_to_connect;
    }

    create_dungeons(): SavewarpConnection[] {
        let savewarps_to_connect = [];
        for (const hint_area in HintAreas) {
            let name = HintAreas[hint_area].dungeon_name;
            if (!!name) {
                let dungeon_json: string;
                if (!this.dungeon_mq[name]) {
                    dungeon_json = `${name}.json`;
                } else {
                    dungeon_json = `${name} MQ.json`;
                }
                savewarps_to_connect.push(...(this.load_regions_from_json(dungeon_json)));
            }
        }
        return savewarps_to_connect;
    }

    create_internal_locations(): void {
        this.parser.create_delayed_rules();
        if (this.parser.events.size > this.event_items.size) {
            // TODO: add set difference, ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#implementing_basic_set_operations
            throw('Parse error: undefined items in parser event list');
        }
    }

    initialize_entrances(): void {
        let target_region;
        for (let region of this.regions) {
            for (let exit of region.exits) {
                if (exit.original_connection_name === null) throw `Region has exits without assigned region`;
                target_region = this.get_region(exit.original_connection_name);
                exit.connect(target_region);
                exit.world = this;
                exit.original_connection = target_region;
            }
        }
    }

    get_region(region_name: Region | string): Region {
        if (region_name instanceof Region) {
            return region_name;
        }
        if (region_name in this._region_cache) {
            return this._region_cache[region_name];
        } else {
            let region = this.regions.filter(r => r.name === region_name);
            if (region.length === 1) {
                this._region_cache[region_name] = region[0];
                return region[0];
            } else {
                throw(`No such region ${region_name}`);
            }
        }
    }

    get_entrance(entrance: Entrance | string): Entrance {
        if (entrance instanceof Entrance) {
            return entrance;
        }
        if (entrance in this._entrance_cache) {
            return this._entrance_cache[entrance];
        } else {
            for (let i = 0; i < this.regions.length; i++) {
                for (let j = 0; j < this.regions[i].exits.length; j++) {
                    if (this.regions[i].exits[j].name === entrance) {
                        this._entrance_cache[entrance] = this.regions[i].exits[j];
                        return this.regions[i].exits[j];
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
        location.item = location.vanilla_item;
        location.vanilla_item.location = location;
        location.vanilla_item.price = location.price !== null ? location.price : location.vanilla_item.price;
        location.price = location.vanilla_item.price;
    }

    get_locations(): Location[] {
        if (this._cached_locations.length === 0) {
            for (const region of this.regions) {
                this._cached_locations.push(...(region.locations));
            }
        }
        return this._cached_locations;
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