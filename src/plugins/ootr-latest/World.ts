import { GraphBoulder, GraphEntrance, GraphSettingType, GraphWorld } from "../GraphPlugin.js";

import { Item, ItemFactory, MakeEventItem } from "./Item.js";
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
import { OotrGraphPlugin, entranceToBossRewardMap } from "./OotrGraphPlugin.js";
import SettingsList, { global_settings_overrides } from "./SettingsList.js";
import type { SettingsDictionary } from "./SettingsList.js";
import { RegionGroup } from "./RegionGroup.js";
import { display_names } from './DisplayNames.js';
import type { AccessRule } from "./RuleParser.js";
import { Boulder, BOULDER_TYPE, boulder_list, mq_dungeon_boulders, vanilla_dungeon_boulders, vanilla_dungeon_boulders_8_1, vanilla_dungeon_boulders_8_2 } from "./Boulders.js";
import { empty_reward_location_names } from "./LocationList.js";

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
export type PlandoMWLocationList = {
    [world_key: string]: PlandoLocationList,
}
export type PlandoMWCheckedLocationList = {
    [world_key: string]: PlandoCheckedLocationList,
};
export type PlandoCheckedLocationList = string[];
export type PlandoMWCheckedEntranceList = {
    [world_key: string]: PlandoCheckedEntranceList,
};
export type PlandoCheckedEntranceList = string[];
export type PlandoItem = {
    item: string,
    price?: number,
    model?: string,
    player?: number,
}
export type PlandoHintTextList = {
    [hint_location_name: string]: string,
}
export type PlandoMWHintTextList = {
    [world_key: string]: PlandoHintTextList,
}
export type PlandoHintList = {
    [hint_location_name: string]: PlandoHint,
}
export type PlandoMWHintList = {
    [world_key: string]: PlandoHintList,
}
export type PlandoBoulderList = {
    [boulder_name: string]: string,
}
export type PlandoMWBoulderList = {
    [world_key: string]: PlandoBoulderList,
}
export type PlandoCheckedBoulderList = string[];
export type PlandoMWCheckedBoulderList = {
    [world_key: string]: PlandoCheckedBoulderList,
}
export type PlandoHint = {
    type: string,
    location?: string,
    location2?: string,
    entrance?: {
        source: {
            region: string,
            from: string,
        },
        target: {
            region: string,
            from: string,
        }
    },
    area?: string,
    item?: PlandoItem | string,
    item2?: PlandoItem | string,
    goal?: {
        location?: string,
        item?: PlandoItem | string,
        item_count: number,
    },
    num_major_items?: number,
    fixed_areas?: {
        [item_name: string]: {
            hint: string,
            hinted: boolean,
            hint_locations: string[],
        }
    },
}

class World implements GraphWorld {

    public id: number;
    public settings: SettingsDictionary;
    public disabled_settings: {[key: string]: GraphSettingType};
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
    public gerudo_valley_river_exit_shuffled: boolean = false;
    public dungeon_back_access: boolean = false;
    public spawn_positions: boolean = false;
    public spawn_shuffle: boolean = false;
    public owl_drops_shuffled: boolean = false;
    public warp_songs_shuffled: boolean = false;
    public entrance_shuffle: boolean = false;
    public one_ways: boolean = false;
    public full_one_ways: boolean = false;
    public mix_entrance_pools: Set<string> = new Set();
    public original_savewarp_targets: SavewarpConnection[] = [];
    public mixed_pools_bosses: boolean = false;
    public ensure_tod_access: boolean = false;
    public disable_trade_revert: boolean = false;
    public skip_child_zelda: boolean = false;
    public triforce_goal_per_world: number = 0;
    public shuffle_ganon_bosskey: string = 'vanilla';
    public selected_adult_trade_item: string = '';
    public adult_trade_starting_item: string = '';

    public shuffled_entrance_types: string[] = [];

    public skipped_items: Item[] = [];

    public boulders: Boulder[];
    public boulder_cache: {[boulder_name: string]: Boulder};

    public nnn: boolean = false;

    public state: WorldState;

    public fixed_item_area_hints: {
        [item_name: string]: {
            hint: string,
            hinted: boolean,
            hint_locations: string[],
        }
    } = {}
    public pending_reward_assignments: {
        [entrance_name: string]: {
            hint: string,
            hinted: boolean,
            hint_locations: string[],
        }
    } = {}

    public viewable_unshuffled_items: string[] = [];
    public explicitly_collected_unshuffled_items: string[] = [
        'Gold Skulltula Token',
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
        "Weird Egg",
        "Chicken",
        "Zeldas Letter",
        "Keaton Mask",
        "Skull Mask",
        "Spooky Mask",
        "Bunny Hood",
        "Mask of Truth",
        "Ocarina",
        "Bombchus (10)",
    ];

    public collect_checked_only: boolean = false;
    public collect_as_starting_items: boolean = false;
    public visit_all_entrances: boolean = false;
    public visit_all_connected_entrances: boolean = false;
    public visit_all_trick_entrances: boolean = true; // default to visit logical entrances + all tricks

    constructor(id: number, settings: SettingsList, ootr_version: OotrVersion, parent_graph: OotrGraphPlugin) {
        if (Object.keys(settings).includes('randomized_settings')) {
            if (!!(settings.settings.world_count) && settings.settings.world_count > 1) {
                settings.override_settings({settings: settings.randomized_settings[`World ${id+1}`]});
            } else {
                settings.override_settings({settings: settings.randomized_settings});
            }
        }
        // Some settings have separate toggles to randomize instead of a 'random' choice.
        // Since this library is meant to be deterministic, always disable these alternate
        // toggles instead to keep the specific setting valid.
        settings.override_settings({
            settings: global_settings_overrides,
        })
        this.settings = settings.settings;
        this.disabled_settings = {};
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
                if (enabled == 'inactive') {
                    this.skipped_trials[trial] = true;
                } else {
                    this.skipped_trials[trial] = false;
                    // sync plugin setting
                    this.settings.graphplugin_trials_specific.push(trial);
                }
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
            if (this.settings.mq_dungeons_specific === undefined) this.settings.mq_dungeons_specific = [];
            for (let [dungeon, dtype] of Object.entries(dungeon_settings)) {
                if (dtype === 'mq') {
                    this.dungeon_mq[dungeon] = true;
                } else {
                    this.dungeon_mq[dungeon] = false;
                    // sync plugin setting
                    this.settings.mq_dungeons_specific.push(dungeon);
                }
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
        if (this.settings.ocarina_songs === false
        || this.settings.ocarina_songs === 'off'
        || (Array.isArray(this.settings.ocarina_songs) && this.settings.ocarina_songs.length === 0)) {
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
                "ZR Frogs Ocarina Game": "<^>vA",
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

        this.boulders = [];
        this.boulder_cache = {};
        this.initialize_boulders();
        this.update_internal_settings();
        this.initialize_fixed_item_area_hints();

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
        if (!!this.settings.shuffle_child_spawn && !!this.settings.shuffle_adult_spawn) {
            this.spawn_positions = ['balanced', 'full'].includes(this.settings.shuffle_child_spawn) ||
                                    ['balanced', 'full'].includes(this.settings.shuffle_adult_spawn);
        }
        if (typeof this.settings.shuffle_gerudo_valley_river_exit === 'boolean') {
            this.gerudo_valley_river_exit_shuffled = this.settings.shuffle_gerudo_valley_river_exit;
        } else if (typeof this.settings.shuffle_gerudo_valley_river_exit === 'string') {
            this.gerudo_valley_river_exit_shuffled = this.settings.shuffle_gerudo_valley_river_exit !== 'off';
        }
        if (typeof this.settings.owl_drops === 'boolean') {
            this.owl_drops_shuffled = this.settings.owl_drops;
        } else if (typeof this.settings.owl_drops === 'string') {
            this.owl_drops_shuffled = this.settings.owl_drops !== 'off';
        }
        if (typeof this.settings.warp_songs === 'boolean') {
            this.warp_songs_shuffled = this.settings.warp_songs;
        } else if (typeof this.settings.warp_songs === 'string') {
            this.warp_songs_shuffled = this.settings.warp_songs !== 'off';
        }
        this.entrance_shuffle = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_grotto_entrances || this.shuffle_dungeon_entrances
            || <boolean>this.settings.shuffle_overworld_entrances || this.gerudo_valley_river_exit_shuffled || this.owl_drops_shuffled
            || this.warp_songs_shuffled || this.spawn_shuffle || this.spawn_positions || (this.settings.shuffle_bosses !== 'off')
            || (!!this.settings.blue_warps && !(['vanilla', 'dungeon'].includes(this.settings.blue_warps)));
        this.ensure_tod_access = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_overworld_entrances || this.spawn_shuffle || this.spawn_positions;
        this.disable_trade_revert = this.shuffle_interior_entrances || <boolean>this.settings.shuffle_overworld_entrances || <boolean>this.settings.adult_trade_shuffle;
        this.skip_child_zelda = false;
        if (!!(this.settings.shuffle_child_trade) && !!(this.settings.starting_items)) {
            this.skip_child_zelda = !(this.settings.shuffle_child_trade.includes('Zeldas Letter')) && 'Zeldas Letter' in this.settings.starting_items;
        }

        if (typeof this.settings.open_forest === 'string' && this.settings.open_forest === 'closed' && 
            (this.shuffle_special_interior_entrances || this.settings.shuffle_hideout_entrances || this.settings.shuffle_overworld_entrances
            || this.warp_songs_shuffled || this.settings.spawn_positions)) {
            this.settings.open_forest = 'closed_deku';
        }

        this.triforce_goal_per_world = 0;
        if (!!(this.settings.triforce_goal_per_world)) {
            this.triforce_goal_per_world = this.settings.triforce_goal_per_world;
            if (!!this.settings.triforce_hunt_mode) {
                if (this.settings.triforce_hunt_mode === 'ice_percent') {
                    this.triforce_goal_per_world = 1;
                } else if (this.settings.triforce_hunt_mode === 'blitz') {
                    this.triforce_goal_per_world = 3;
                }
            }
        }
        // Upstream rando tweaks the setting directly, but other settings can disable it
        // and override the override back to vanilla when it shouldn't.
        // Search algorithm gives priority to world properties over world.settings props.
        if (this.settings.triforce_hunt) {
            this.shuffle_ganon_bosskey = 'triforce';
        } else if (!!this.settings.shuffle_ganon_bosskey) {
            this.shuffle_ganon_bosskey = this.settings.shuffle_ganon_bosskey;
        }

        this.shuffled_entrance_types = [];
        if (this.shuffle_dungeon_entrances) this.shuffled_entrance_types.push('Dungeon');
        if (this.shuffle_special_dungeon_entrances) this.shuffled_entrance_types.push('DungeonSpecial');
        if (this.settings.shuffle_bosses !== 'off') {
            this.shuffled_entrance_types.push('ChildBoss', 'AdultBoss');
            if (Object.keys(this.settings).includes('shuffle_ganon_tower') && this.settings.shuffle_ganon_tower) {
                this.shuffled_entrance_types.push('SpecialBoss');
            }
        }
        if (this.shuffle_interior_entrances) this.shuffled_entrance_types.push('Interior');
        if (this.shuffle_special_interior_entrances) this.shuffled_entrance_types.push('SpecialInterior');
        if (typeof this.settings.shuffle_hideout_entrances === 'boolean') {
            if (this.settings.shuffle_hideout_entrances) this.shuffled_entrance_types.push('Hideout');
        } else if (typeof this.settings.shuffle_hideout_entrances === 'string') {
            if (this.settings.shuffle_hideout_entrances !== 'off') this.shuffled_entrance_types.push('Hideout');
        }
        if (this.settings.shuffle_grotto_entrances) this.shuffled_entrance_types.push('Grotto', 'Grave');
        if (this.settings.shuffle_overworld_entrances) this.shuffled_entrance_types.push('Overworld');
        if (this.gerudo_valley_river_exit_shuffled) this.shuffled_entrance_types.push('OverworldOneWay');
        if (this.owl_drops_shuffled) this.shuffled_entrance_types.push('OwlDrop');
        if (this.warp_songs_shuffled) this.shuffled_entrance_types.push('WarpSong');
        if (!!this.settings.shuffle_child_spawn && this.settings.shuffle_child_spawn !== 'off') this.shuffled_entrance_types.push('ChildSpawn');
        if (!!this.settings.shuffle_adult_spawn && this.settings.shuffle_adult_spawn !== 'off') this.shuffled_entrance_types.push('AdultSpawn');
        if (!!this.settings.blue_warps && !(['dungeon', 'vanilla'].includes(this.settings.blue_warps))) this.shuffled_entrance_types.push('BlueWarp');

        this.one_ways = (
            (!!this.settings.blue_warps && ['balanced', 'full'].includes(this.settings.blue_warps))
            || this.gerudo_valley_river_exit_shuffled
            || this.owl_drops_shuffled
            || this.warp_songs_shuffled
            || this.spawn_positions
        )
        this.full_one_ways = (
            (!!this.settings.blue_warps && ['full'].includes(this.settings.blue_warps))
            || (typeof this.settings.shuffle_gerudo_valley_river_exit === 'string' && ['full'].includes(this.settings.shuffle_gerudo_valley_river_exit))
            || (typeof this.settings.owl_drops === 'string' && ['full'].includes(this.settings.owl_drops))
            || (typeof this.settings.warp_songs === 'string' && ['full'].includes(this.settings.warp_songs))
            || (typeof this.settings.shuffle_child_spawn === 'string' && ['full'].includes(this.settings.shuffle_child_spawn))
            || (typeof this.settings.shuffle_adult_spawn === 'string' && ['full'].includes(this.settings.shuffle_adult_spawn))
        )
        let shuffle_grottos = !!this.settings.shuffle_grotto_entrances ? this.settings.shuffle_grotto_entrances : false;
        let shuffle_overworld = !!this.settings.shuffle_overworld_entrances ? this.settings.shuffle_overworld_entrances : false;
        let mixed_pool_rules: {[pool_type: string]: boolean} = {
            'Interior': this.shuffle_interior_entrances,
            'GrottoGrave': shuffle_grottos,
            'Dungeon': this.shuffle_dungeon_entrances,
            'Overworld': shuffle_overworld,
            'Boss': this.settings.shuffle_bosses === 'full',
        };
        this.mix_entrance_pools = new Set();
        if (!!this.settings.mix_entrance_pools && Array.isArray(this.settings.mix_entrance_pools)) {
            for (let pool of this.settings.mix_entrance_pools) {
                if (mixed_pool_rules[pool]) this.mix_entrance_pools.add(pool);
            }
        }
        if (this.mix_entrance_pools.size === 1) this.mix_entrance_pools = new Set();
        this.mixed_pools_bosses = this.mix_entrance_pools.has('Boss');
        this.dungeon_back_access = (!!this.settings.dungeon_back_access && this.settings.dungeon_back_access === true) && (
            this.full_one_ways || (
                this.mixed_pools_bosses && (
                    (!!this.settings.decouple_entrances && this.settings.decouple_entrances)
                    || this.mix_entrance_pools.has('Overworld')
                    || (
                        this.mix_entrance_pools.has('GrottoGrave')
                        && this.one_ways
                    )
                    || (
                        this.mix_entrance_pools.has('Interior')
                        && (
                            this.one_ways
                            || this.shuffle_special_interior_entrances
                            || typeof this.settings.shuffle_hideout_entrances === 'string' && this.settings.shuffle_hideout_entrances !== 'off'
                        )
                    )
                )
            )
        );
        if (!!this.settings.starting_items && typeof this.settings.starting_items === 'object') {
            this.set_adult_trade_starting_item(Object.keys(this.settings.starting_items));
        } else if (!!this.settings.starting_inventory && typeof this.settings.starting_inventory === 'object') {
            this.set_adult_trade_starting_item(Object.keys(this.settings.starting_inventory));
        }
    }

    initialize_fixed_item_area_hints(): void {
        const create_fixed_item_area_hint = (hint: string, always_known: boolean) => {
            return {
                hint: hint,
                hinted: always_known,
                hint_locations: [],
            }
        }
        if (!!this.settings.shuffle_dungeon_rewards && this.settings.shuffle_dungeon_rewards === 'vanilla' && !this.mixed_pools_bosses) {
            this.fixed_item_area_hints = {
                'Kokiri Emerald':   create_fixed_item_area_hint('DEKU', true),
                'Goron Ruby':       create_fixed_item_area_hint('DCVN', true),
                'Zora Sapphire':    create_fixed_item_area_hint('JABU', true),
                'Forest Medallion': create_fixed_item_area_hint('FRST', true),
                'Fire Medallion':   create_fixed_item_area_hint('FIRE', true),
                'Water Medallion':  create_fixed_item_area_hint('WATR', true),
                'Spirit Medallion': create_fixed_item_area_hint('SPRT', true),
                'Shadow Medallion': create_fixed_item_area_hint('SHDW', true),
                'Light Medallion':  create_fixed_item_area_hint('FREE', true),
            }
        } else {
            this.fixed_item_area_hints = {
                'Kokiri Emerald':   create_fixed_item_area_hint('????', false),
                'Goron Ruby':       create_fixed_item_area_hint('????', false),
                'Zora Sapphire':    create_fixed_item_area_hint('????', false),
                'Forest Medallion': create_fixed_item_area_hint('????', false),
                'Fire Medallion':   create_fixed_item_area_hint('????', false),
                'Water Medallion':  create_fixed_item_area_hint('????', false),
                'Spirit Medallion': create_fixed_item_area_hint('????', false),
                'Shadow Medallion': create_fixed_item_area_hint('????', false),
                'Light Medallion':  create_fixed_item_area_hint('????', false),
            }
        }
    }

    initialize_boulders(): void {
        // default boulder types
        this.boulders = [];
        this.boulder_cache = {};
        for (let [boulder_name, boulder_type] of Object.entries(boulder_list)) {
            let boulder = new Boulder(boulder_name, boulder_type, this);
            this.boulder_cache[boulder_name] = boulder;
            this.boulders.push(boulder);
        }
        for (let dungeon of Object.values(vanilla_dungeon_boulders)) {
            for (let [boulder_name, boulder_type] of Object.entries(dungeon)) {
                let boulder = new Boulder(boulder_name, boulder_type, this);
                this.boulder_cache[boulder_name] = boulder;
                this.boulders.push(boulder);
            }
        }
        if (this.version.lt('8.2.0')) {
            for (let dungeon of Object.values(vanilla_dungeon_boulders_8_1)) {
                for (let [boulder_name, boulder_type] of Object.entries(dungeon)) {
                    let boulder = new Boulder(boulder_name, boulder_type, this);
                    this.boulder_cache[boulder_name] = boulder;
                    this.boulders.push(boulder);
                }
            }
        } else {
            for (let dungeon of Object.values(vanilla_dungeon_boulders_8_2)) {
                for (let [boulder_name, boulder_type] of Object.entries(dungeon)) {
                    let boulder = new Boulder(boulder_name, boulder_type, this);
                    this.boulder_cache[boulder_name] = boulder;
                    this.boulders.push(boulder);
                }
            }
        }
        for (let dungeon of Object.values(mq_dungeon_boulders)) {
            for (let [boulder_name, boulder_type] of Object.entries(dungeon)) {
                let boulder = new Boulder(boulder_name, boulder_type, this);
                this.boulder_cache[boulder_name] = boulder;
                this.boulders.push(boulder);
            }
        }
    }

    set_adult_trade_starting_item(starting_items: string[]): void {
        this.adult_trade_starting_item = '';
        if (this.settings.adult_trade_shuffle === true) return;
        const adult_trade_items = [
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
        let adult_trade_starting_items = starting_items.filter(i => adult_trade_items.includes(i))
            .map(i => adult_trade_items.indexOf(i));
        if (adult_trade_starting_items.length > 0 && adult_trade_starting_items.some(i => i >= 0)) {
            this.adult_trade_starting_item = adult_trade_items[Math.max(...adult_trade_starting_items)];
        }
    }

    // not a true copy!!!
    // world settings are independent
    // regions/entrances/locations/boulders are still shared
    // primary use case is Search variants with different settings/starting conditions
    copy(): World {
        let w = new World(this.id, this.parent_graph.settings_list.copy(), this.version, this.parent_graph);
        for (let [ds_name, ds_value] of Object.entries(this.disabled_settings)) {
            if (typeof ds_value === 'object') {
                if (Array.isArray(ds_value)) {
                    w.disabled_settings[ds_name] = [...ds_value];
                } else {
                    w.disabled_settings[ds_name] = Object.assign({}, ds_value);
                }
            } else {
                w.disabled_settings[ds_name] = ds_value;
            }
        }
        w.regions = this.regions;
        w.dungeons = this.dungeons;
        w.region_groups = this.region_groups;
        w.skipped_locations = this.skipped_locations;
        w.parser = this.parser;
        w.event_items = this.event_items;
        w.skipped_trials = this.skipped_trials;
        w.dungeon_mq = this.dungeon_mq;
        w.song_notes = this.song_notes;
        w.boulders = this.boulders;
        w.original_savewarp_targets = this.original_savewarp_targets;
        w.state = this.state.copy();
        w.state.world = w;
        w.adult_trade_starting_item = this.adult_trade_starting_item;
        w.selected_adult_trade_item = this.selected_adult_trade_item;
        w.update_internal_settings();
        w.collect_checked_only = this.collect_checked_only;
        w.collect_as_starting_items = this.collect_as_starting_items;
        w.visit_all_entrances = this.visit_all_entrances;
        w.visit_all_connected_entrances = this.visit_all_connected_entrances;
        w.visit_all_trick_entrances = this.visit_all_trick_entrances; // default to visit logical entrances + all tricks
        return w;
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

    load_global_rules() {
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
        let area_regions: Region[] = [];
        for (const region of region_json) {
            let is_new_region = true;
            let new_region = new Region(region.region_name, this);
            // Handle duplicate region names. Assumes no conflicts in region
            // metadata or event/location/exit rules
            if (area_regions.filter(r => r.name === new_region.name).length > 0) {
                new_region = area_regions.filter(r => r.name === new_region.name)[0];
                is_new_region = false;
                console.log(`Found duplicate region definition ${new_region.name}, appending new data`);
            }
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
                if (typeof region.is_boss_room === 'string') {
                    new_region.is_boss_room = region.is_boss_room.toLowerCase() === "true"; // fixed post 8.1
                } else {
                    new_region.is_boss_room = region.is_boss_room;
                }
            }
            if (!!region.time_passes) {
                new_region.time_passes = region.time_passes;
                new_region.provides_time = TimeOfDay.ALL;
            }
            if ((this.version.branch !== 'Fenhl' || this.version.lt('8.2.50'))
                && (new_region.name === 'Ganons Castle Grounds' || (this.version.gt('8.1.28') && new_region.name === 'Ganons Castle Ledge'))) {
                new_region.provides_time = TimeOfDay.DAMPE;
            }
            if (!!region.provides_time) {
                if (Object.keys(TimeOfDay).includes(region.provides_time)) {
                    new_region.provides_time = TimeOfDay[region.provides_time];
                } else {
                    throw `Unknown time of day provider ${new_region.name} with time ${region.provides_time}`;
                }
            }
            if (new_region.name === 'Root') {
                // internal locations to save empty dungeon rewards
                // instead of forcing users to set specific dungeon
                // location items. These are set by the fixed_item_area_hints
                // update functions.
                for (let l of empty_reward_location_names) {
                    let new_location = LocationFactory(l, this)[0];
                    new_location.parent_region = new_region;
                    new_location.rule_string = 'true';
                    new_region.locations.push(new_location);
                }
            }
            if (!!region.locations) {
                for (const [location, rule] of Object.entries(region.locations)) {
                    if (new_region.locations.filter(l => l.name === location).length > 0) {
                        console.log(`Skipping duplicate location definition ${location} in region ${new_region.name}`);
                    } else {
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
            }
            if (!!region.events) {
                for (const [event, rule] of Object.entries(region.events)) {
                    let lname = `${event} from ${new_region.name}`;
                    if (new_region.locations.filter(l => l.name === lname).length > 0) {
                        console.log(`Skipping duplicate event definition ${lname} in region ${new_region.name}`);
                    } else {
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
            }
            if (!!region.exits) {
                for (const [exit, rule] of Object.entries(region.exits)) {
                    let exit_name = `${new_region.name} -> ${exit}`;
                    if (new_region.exits.filter(e => e.name === exit_name).length > 0) {
                        console.log(`Skipping duplicate exit definition ${exit_name} in region ${new_region.name}`);
                    } else {
                        let new_exit = new Entrance(exit_name, new_region, this);
                        new_exit.original_connection_name = exit;
                        new_exit.rule_string = replace_python_booleans(rule);
                        if (new_region.name === 'Root' && exit === 'GF Above Jail Child Locations') {
                            // use search mode to unhack the logic hack for child fortress HP,
                            // but allow it for unit tests
                            new_exit.rule_string = "!collect_checked_only && (shuffle_gerudo_fortress_heart_piece === 'remove' || !shuffle_hideout_entrances)";                            
                        }
                        if (this.settings.logic_rules !== 'none') {
                            if (this.parent_graph.debug) console.log(`parsing ${new_exit.name}`);
                            this.parser.parse_spot_rule(new_exit);
                        }
                        new_region.exits.push(new_exit);
                    }
                }
                if (is_new_region && this.version.branch !== 'Fenhl' && this.version.lt('8.2.0')
                    && new_region.name === 'Ganons Castle Tower' && this.settings.logic_rules !== 'glitched'
                    && !(Object.keys(region.exits).includes('Ganons Castle Main'))
                    && !(Object.keys(region.exits).includes('Ganons Castle Lobby'))) {
                    let new_exit = new Entrance(`${new_region.name} -> Ganons Castle Main`, new_region, this);
                    new_exit.original_connection_name = this.dungeon_mq['Ganons Castle'] ? 'Ganons Castle Main' : 'Ganons Castle Lobby';
                    new_exit.rule_string = replace_python_booleans('true');
                    if (this.settings.logic_rules !== 'none') {
                        if (this.parent_graph.debug) console.log(`parsing ${new_exit.name}`);
                        this.parser.parse_spot_rule(new_exit);
                    }
                    new_region.exits.push(new_exit);
                }
            }
            if (!!region.savewarp) {
                // Filter useless extra savewarp that only exists in vanilla or MQ dungeon variant
                let extraneous_savewarp_regions = [
                    'Water Temple Before Boss Lower',
                    "Dodongos Cavern Back Side Room"
                ];
                if (!(extraneous_savewarp_regions.includes(region.region_name))) {
                    let savewarp_target = region.savewarp.split(' -> ')[1];
                    let exit_name = `${new_region.name} -> ${savewarp_target}`;
                    let new_exit = new Entrance(exit_name, new_region, this);
                    new_exit.original_connection_name = savewarp_target;
                    new_exit.one_way = true;
                    new_exit.rule_string = 'true;';
                    new_exit.transformed_rule = 'true;';
                    if (new_region.exits.filter(e => e.name === exit_name).length > 0) {
                        console.log(`Skipping duplicate exit definition ${exit_name} in region ${new_region.name} savewarps`);
                        new_exit = new_region.exits.filter(e => e.name === exit_name)[0];
                    } else {
                        new_region.exits.push(new_exit);
                    }
                    if (savewarps_to_connect.filter(e => e[0].name === exit_name).length > 0) {
                        console.log(`Skipping duplicate savewarp definition ${exit_name} in region ${new_region.name}`);
                    } else {
                        new_region.savewarp = new_exit;
                        savewarps_to_connect.push([new_exit, region.savewarp]);
                    }
                }
            }
            if (is_new_region) {
                if (is_dungeon_variant) {
                    this.dungeons[this.dungeon_variant].push(new_region);
                } else {
                    this.regions.push(new_region);
                }
                area_regions.push(new_region);
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
                // Set up reverse entrance metadeta. Can't be run
                // during dungeon group creation as base metadata for
                // the entrances doesn't exist yet.
                for (let sub_region of region.parent_group.sub_regions) {
                    for (let entrance of sub_region.entrances) {
                        if (!!entrance.type && entrance.source_group === null && !!entrance.parent_region.parent_group) {
                            entrance.source_group = entrance.parent_region.parent_group;
                        }
                    }
                    for (let exit of sub_region.exits) {
                        if (!!exit.type && exit.source_group === null && !!exit.parent_region.parent_group) {
                            exit.source_group = exit.parent_region.parent_group;
                        }
                    }
                }
            }
            // connect outside interface entrances to world
            // and disconnect connections from the other variant
            for (let exit of region.exits) {
                if (!!(exit.alternate)) {
                    if (!!(exit.alternate.reverse)) {
                        exit.bind_two_way(exit.alternate.reverse);
                        if (!!(exit.reverse) && !!exit.reverse.original_connection_name) {
                            exit.reverse.original_connection = this.get_region(exit.reverse.original_connection_name, dungeon_variant_name);
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
                    if (!!(exit.alternate.target_group)) {
                        exit.target_group = exit.alternate.target_group;
                        exit.alternate.target_group = null;
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
                    let alt_connection_name: string;
                    if (this.version.branch !== 'Fenhl' && this.version.lt('8.2.0')
                        && dungeon_variant_name === 'Ganons Castle'
                        && exit.name === 'Ganons Castle Tower -> Ganons Castle Main') {
                            alt_connection_name = 'Ganons Castle Lobby';
                    } else if (this.parent_graph.version.branch !== 'Fenhl' && this.parent_graph.version.lt('8.2.0')
                        && dungeon_variant_name === 'Ganons Castle MQ'
                        && exit.name === 'Ganons Castle Tower -> Ganons Castle Main') {
                            alt_connection_name = 'Ganons Castle Main';
                    } else {
                        alt_connection_name = alt_region.name;
                    }
                    exit.connect(this.get_region(alt_connection_name, dungeon_variant_name));
                }
                if (!!(exit.original_connection) && alt_dungeon_regions.includes(exit.original_connection)) {
                    // no need to update original connection property as these entrances aren't shuffled,
                    // but done anyway just in case since the target region group is important
                    let original_connection_name: string;
                    if (this.version.branch !== 'Fenhl' && this.version.lt('8.2.0')
                        && dungeon_variant_name === 'Ganons Castle'
                        && exit.name === 'Ganons Castle Tower -> Ganons Castle Main') {
                            original_connection_name = 'Ganons Castle Lobby';
                    } else if (this.version.branch !== 'Fenhl' && this.version.lt('8.2.0')
                        && dungeon_variant_name === 'Ganons Castle MQ'
                        && exit.name === 'Ganons Castle Tower -> Ganons Castle Main') {
                            original_connection_name = 'Ganons Castle Main';
                    } else {
                        original_connection_name = exit.original_connection.name;
                    }
                    let new_original_target = this.get_region(original_connection_name, dungeon_variant_name);
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

    initialize_locations(): void {
        for (let location of this.get_locations(true)) {
            location.viewable_if_unshuffled = false;
            location.explicitly_collect_item = false;
            if (location.internal) {
                if (!!location.item) {
                    if (this.viewable_unshuffled_items.includes(location.item.name)) location.viewable_if_unshuffled = true;
                    if (this.explicitly_collected_unshuffled_items.includes(location.item.name)) location.explicitly_collect_item = true;
                }
            } else {
                if (!!location.vanilla_item_name) {
                    if (this.viewable_unshuffled_items.includes(location.vanilla_item_name)) location.viewable_if_unshuffled = true;
                    if (this.explicitly_collected_unshuffled_items.includes(location.vanilla_item_name)) location.explicitly_collect_item = true;
                }
            }
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
                    // Ganon's Castle is handled properly on Fenhl's branch where Tower can be shuffled.
                    let alt_region: Region;
                    let exit_name = exit.name;
                    if (this.version.branch !== 'Fenhl' && this.version.lt('8.2.0')
                        && region.dungeon === 'Ganons Castle'
                        && target_region.name === 'Ganons Castle Tower') {
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
            // Don't include subgroups in top level list
            if (region_group.parent_group === null) {
                this.region_groups.push(region_group);
            }
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
        let subgroup_aliases: Set<string> = new Set<string>();
        for (let [group_alias, sub_regions] of Object.entries(display_names.region_groups)) {
            // Regions cannot exist in multiple region groups
            if (sub_regions.region_names.includes(region.name)) {
                alias = group_alias;
                break;
            }
            // Regions cannot exist in both the region_names and subgroups lists
            if (!!sub_regions.subgroups) {
                for (let [subgroup_name, subgroup_regions] of Object.entries(sub_regions.subgroups)) {
                    if (subgroup_regions.includes(region.name)) {
                        alias = group_alias;
                        subgroup_aliases.add(subgroup_name);
                        // Don't break yet. Regions can exist in multiple subgroups
                        // within the same region group (e.g. Castle Grounds)
                    }
                }
                if (alias !== '') break;
            }
        }
        if (alias !== '') {
            let region_group = this.get_new_region_group(alias);
            if (subgroup_aliases.size === 0) {
                region_group.add_region(region);
            } else {
                for (let subgroup_alias of subgroup_aliases) {
                    let region_subgroup = region_group.get_new_sub_group(subgroup_alias);
                    region_subgroup.add_region(region);
                }
            }
            return region_group;
        }
    }

    // Has to run after overworld region groups are created and entrance metadata is calculated
    create_target_region_group(starting_entrance: Entrance): RegionGroup {
        let starting_region = starting_entrance.original_connection;
        if (starting_region === null) throw `Failed to create target region group: empty original connection for entrance ${starting_entrance.name}`
        let region_group = this.get_new_region_group(starting_entrance.name);
        region_group.add_region(starting_region);
        let exits: Entrance[] = [];
        let regions: Region[] = [];
        let processed_regions: Region[] = [starting_region];
        exits.push(...starting_region.exits.filter(e => e.type === null && e.target_group === null && !e.one_way && !e.is_savewarp && e.original_connection_name !== 'Farores Wind Warp'));
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
                // Farore's Wind exits are not typed entrances and thus don't have the one_way tag,
                // check explicitly to prevent target region escape
                exits.push(...region.exits.filter(e => e.type === null && e.target_group === null && !e.one_way && !e.is_savewarp && e.original_connection_name !== 'Farores Wind Warp'));
                processed_regions.push(region);
            }
            regions = [];
        }
        // Clean up any stray target regions erroneously marked as top-level Dungeon regions
        region_group.page = '';
        return region_group;
    }

    add_hinted_dungeon_reward(e: GraphEntrance, hinted_item: Item | null = null) {
        let reward_item: Item;
        if (hinted_item === null) {
            if (Object.keys(this.pending_reward_assignments).includes(e.name)) {
                reward_item = this.get_item(this.pending_reward_assignments[e.name].hint);
            } else {
                return;
            }
        } else {
            reward_item = hinted_item;
        }
        if (!!e.connected_region) {
            if (!this.mixed_pools_bosses &&
                (this.settings.shuffle_dungeon_rewards == undefined ||
                ['vanilla', 'reward'].includes(this.settings.shuffle_dungeon_rewards))) {
                let boss_entrance_name = !!e.replaces ? e.replaces.name : e.name;
                let boss_reward_location = this.get_location(entranceToBossRewardMap[boss_entrance_name]);
                this.fixed_item_area_hints[reward_item.name].hinted = 
                    this.fixed_item_area_hints[reward_item.name].hinted ||
                    boss_reward_location.checked;
                if (boss_reward_location.item === null) {
                    this.parent_graph.set_location_item(boss_reward_location, reward_item, undefined, false);
                    if (Object.keys(this.pending_reward_assignments).includes(e.name)) {
                        delete this.pending_reward_assignments[e.name];
                    }
                }
            }
        } else {
            this.pending_reward_assignments[e.name] = {
                hint: reward_item.name,
                hinted: false,
                hint_locations: [],
            };
        }
    }

    remove_hinted_dungeon_reward(e: GraphEntrance, clear_cache: boolean = false) {
        if (Object.keys(entranceToBossRewardMap).includes(e.name) &&
            !this.mixed_pools_bosses &&
            (this.settings.shuffle_dungeon_rewards == undefined ||
            ['vanilla', 'reward'].includes(this.settings.shuffle_dungeon_rewards))) {
            if(!!e.connected_region) {
                let boss_entrance_name = !!e.replaces ? e.replaces.name : e.name;
                let boss_reward_location = this.get_location(entranceToBossRewardMap[boss_entrance_name]);
                if (!!boss_reward_location.item) {
                    this.pending_reward_assignments[e.name] = { hint: boss_reward_location.item.name, hinted: false, hint_locations: [], };
                    this.parent_graph.set_location_item(boss_reward_location, null, undefined, false);
                }
            }
        }
        if (Object.keys(this.pending_reward_assignments).includes(e.name) && clear_cache) {
            delete this.pending_reward_assignments[e.name];
        }
    }

    get_new_region_group(region_name: string): RegionGroup {
        if (!(region_name in this._region_group_cache)) {
            this._region_group_cache[region_name] = new RegionGroup(region_name, this);
        }
        return this._region_group_cache[region_name];
    }

    get_region_group(region_name: string): RegionGroup {
        let region_group = this.region_groups.filter(r => r.name === region_name);
        if (region_group.length === 1) {
            return region_group[0];
        } else {
            throw(`No such region group ${region_name}`);
        }
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

    get_region_group_from_hint_region(hint_region: string): RegionGroup {
        let hinted_regions = this.region_groups.filter(r => r.alias === hint_region);
        if (hinted_regions.length === 0) {
            hinted_regions = this.region_groups.flatMap(r => r.sub_groups).filter(r => r.alias === hint_region);
            if (hinted_regions.length === 0) {
                function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
                    return value !== null && value !== undefined;
                }
                hinted_regions = this.region_groups.flatMap(r => r.exits.filter(e => e.alias === hint_region).map(e => e.original_connection?.parent_group)).filter(notEmpty);
            }
        }
        if (hinted_regions.length === 0) throw `No such hint region ${hint_region}`;
        if (hinted_regions.length > 1) throw `Multiple hint region candidates found for ${hint_region}`;
        return hinted_regions[0];
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

    get_boulder(boulder: Boulder | string): Boulder {
        if (boulder instanceof Boulder) {
            return boulder;
        }
        if (boulder in this.boulder_cache) {
            return this.boulder_cache[boulder];
        } else {
            throw(`No such boulder ${boulder}`);
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
        location.is_restricted = false;
    }

    get_item(item: Item | string): Item {
        if (item instanceof Item) {
            return item;
        }
        return ItemFactory(item, this)[0];
    }

    skip_location(location: Location | string) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }
        this.skipped_locations.push(location);
        location.internal = true;
        location.skipped = true;
    }

    clear_skipped_locations(): void {
        for (let l of this.skipped_locations) {
            if (l.type !== 'Event') l.internal = false;
            l.skipped = false;
        }
        let l = this.get_location('HC Malon Egg');
        l.skipped = false;
        l = this.get_location('Hyrule Castle Grounds Child Trade 1');
        l.skipped = false;
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
        try {
            let dungeon_hintarea = HintArea.at(region);
            if (dungeon_hintarea === null) throw `Could not find associated dungeon for ${region_name}`;
            let dungeon_name = dungeon_hintarea.dungeon_name;
            if (dungeon_name === null) throw `Could not find associated dungeon name for ${region_name}`;
            return this.settings.dungeon_shortcuts.includes(dungeon_name);
        } catch {
            // handle King Dodongo's Boss Room disconnected or connected to non-blue-warp-dungeon region
            return false;
        }
    }

    keyring(dungeon_name: string): boolean {
        if ([
            'Forest Temple',
            'Fire Temple',
            'Water Temple',
            'Shadow Temple',
            'Spirit Temple',
            'Bottom of the Well',
            'Gerudo Training Ground',
            'Ganons Castle'
        ].includes(dungeon_name)) {
            return !!this.settings.key_rings && this.settings.key_rings?.includes(dungeon_name) && this.settings.shuffle_smallkeys != 'vanilla';
        } else if (dungeon_name === 'Thieves Hideout') {
            return !!this.settings.key_rings && !!this.settings.key_rings && this.settings.key_rings?.includes(dungeon_name)
            && !!this.settings.gerudo_fortress && this.settings.gerudo_fortress !== 'fast'
            && !!this.settings.shuffle_hideoutkeys && this.settings.shuffle_hideoutkeys !== 'vanilla';
        } else if (dungeon_name === 'Treasure Chest Game') {
            return !!this.settings.key_rings && this.settings.key_rings?.includes(dungeon_name) && this.settings.shuffle_tcgkeys !== 'vanilla';
        } else {
            throw `Attempted to check keyring for unknown dungeon ${dungeon_name}`;
        }
    }

    keyring_give_bk(dungeon_name: string): boolean {
        return (
            ['Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple'].includes(dungeon_name)
            && !!this.settings.keyring_give_bk
            && this.keyring(dungeon_name)
        );
    }

    collect_skipped_locations(): void {
        this.clear_skipped_locations();
        for (let item of this.skipped_items) {
            this.state.collect(item);
        }
        // Don't use skip_location in order to keep Link's Pocket
        // non-internal, allowing it to show up in trackers.
        let starting_reward = true;
        let pocket: Location;
        if (Object.keys(this.settings).includes('skip_reward_from_rauru')) {
            pocket = this.get_location('ToT Reward from Rauru');
            if (!this.settings.skip_reward_from_rauru) starting_reward = false;
        } else {
            pocket = this.get_location('Links Pocket');
        }
        if (starting_reward) {
            this.skipped_locations.push(pocket);
            pocket.skipped = true;
        }
        // Free rewards from empty dungeons
        for (let l_name of empty_reward_location_names) {
            this.skip_location(l_name);
        }
        if (!(this.settings.shuffle_gerudo_card) && this.settings.gerudo_fortress === 'open') {
            this.state.collect(ItemFactory('Gerudo Membership Card', this)[0]);
            this.skip_location('Hideout Gerudo Membership Card');
        }
        if (this.skip_child_zelda) {
            // Upstream randomizer doesn't include Malon at Castle
            // at all if SCZ is on. Adding it to skipped locations
            // would add a false test failure for the location in the
            // playthrough. Same applies to the Wake Up Talon event.
            // Setting the location to skipped doesn't do anything in
            // the library. It's only for trackers to reference.
            this.state.collect(ItemFactory('Weird Egg', this)[0]);
            let egg = this.get_location('HC Malon Egg');
            egg.skipped = true;
            let talon = this.get_location('Hyrule Castle Grounds Child Trade 1');
            talon.skipped = true;

            this.skip_location('HC Zeldas Letter');

            // Same deal as Link's Pocket
            let pocket = this.get_location('Song from Impa');
            this.skipped_locations.push(pocket);
            pocket.skipped = true;
        }
        if (this.settings.free_scarecrow) {
            this.state.collect(ItemFactory('Scarecrow Song', this)[0]);
        }
        if (this.settings.no_epona_race) {
            this.state.collect(ItemFactory('Epona', this, true)[0]);
        }
        if (this.settings.shuffle_smallkeys === 'vanilla') {
            if (this.dungeon_mq['Spirit Temple']) {
                this.state.collect(ItemFactory('Small Key (Spirit Temple)', this)[0]);
                this.state.collect(ItemFactory('Small Key (Spirit Temple)', this)[0]);
                this.state.collect(ItemFactory('Small Key (Spirit Temple)', this)[0]);
            }
            if (!!(this.settings.dungeon_shortcuts) && this.settings.dungeon_shortcuts.includes('Shadow Temple')) {
                this.state.collect(ItemFactory('Small Key (Shadow Temple)', this)[0]);
                this.state.collect(ItemFactory('Small Key (Shadow Temple)', this)[0]);
            }
        }
        if (!(this.keysanity) && !(this.dungeon_mq['Fire Temple'])
        && (!(Object.keys(this.settings).includes('shuffle_base_item_pool'))
        || (this.settings.shuffle_base_item_pool || this.settings.shuffle_smallkeys !== 'vanilla'))) {
            // The extra Fire Temple key is never visible to the player in-game, so
            // don't add to the player inventory used for tracker displays.
            this.state.collect(ItemFactory('Small Key (Fire Temple)', this)[0], true, false);
        }
        if (this.settings.shuffle_tcgkeys === 'remove') {
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
            this.state.collect(ItemFactory('Small Key (Treasure Chest Game)', this)[0]);
        }
        if (!(this.settings.shuffle_individual_ocarina_notes) && this.parent_graph.version.gte('7.1.138')) {
            this.state.collect(ItemFactory('Ocarina A Button', this)[0]);
            this.state.collect(ItemFactory('Ocarina C up Button', this)[0]);
            this.state.collect(ItemFactory('Ocarina C down Button', this)[0]);
            this.state.collect(ItemFactory('Ocarina C left Button', this)[0]);
            this.state.collect(ItemFactory('Ocarina C right Button', this)[0]);
        }
        let enemy_souls_core: string[] = [
            'Stalfos Soul',
            'Octorok Soul',
            'Wallmaster Soul',
            'Dodongo Soul',
            'Keese Soul',
            'Tektite Soul',
            'Peahat Soul',
            'Lizalfos and Dinalfos Soul',
            'Gohma Larvae Soul',
            'Shabom Soul',
            'Baby Dodongo Soul',
            'Biri and Bari Soul',
            'Tailpasaran Soul',
            'Skulltula Soul',
            'Torch Slug Soul',
            'Moblin Soul',
            'Armos Soul',
            'Deku Baba Soul',
            'Deku Scrub Soul',
            'Bubble Soul',
            'Beamos Soul',
            'Floormaster Soul',
            'Redead and Gibdo Soul',
            'Skullwalltula Soul',
            'Flare Dancer Soul',
            'Dead hand Soul',
            'Spike Enemy Soul',
            'Anubis Soul',
            'Iron Knuckle Soul',
            'Skull Kid Soul',
            'Flying Pot Soul',
            'Freezard Soul',
            'Stinger Soul',
            'Wolfos Soul',
            'Guay Soul',
            'Jabu Jabu Tentacle Soul',
            'Dark Link Soul',
        ];
        // This soul got renamed at some point
        if (this.parent_graph.version.lt('8.0.0')) {
            enemy_souls_core.push('Shell blade Soul');
        } else {
            enemy_souls_core.push('Shell Blade Soul');
        }
        if (this.parent_graph.version.lt('8.2.0')) {
            enemy_souls_core.push('Like-like Soul');
        } else {
            enemy_souls_core.push('Like Like Soul');
        }
        if (Object.keys(this.settings).includes('shuffle_enemy_spawns')) {
            if (this.settings.shuffle_enemy_spawns === 'bosses') {
                for (let soul of enemy_souls_core) {
                    this.state.collect(ItemFactory(soul, this)[0]);
                }
            }
        }
        // TODO: empty dungeons
    }
}

export default World;