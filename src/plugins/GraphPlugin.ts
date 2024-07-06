import ExternalFileCache from "./ExternalFileCache.js";

export interface GraphLocation {
    name: string;
    alias: string;
    type: string;
    shuffled: boolean;
    price?: number | null;
    item: GraphItem | null;
    vanilla_item: GraphItem | null;
    parent_region: GraphRegion | null;
    hint_area(): string | null;
    world: GraphWorld | null;
    boulders: GraphBoulder[];
    sphere: number;
    visited: boolean;
    visited_with_other_tricks: boolean;
    child_visited: boolean;
    child_visited_with_other_tricks: boolean;
    adult_visited: boolean;
    adult_visited_with_other_tricks: boolean;
    skipped: boolean;
    checked: boolean;
    is_hint: boolean;
    hint: GraphHint | null;
    hint_text: string;
    hinted: boolean;
    is_shop: boolean;
    holds_shop_refill: boolean;
    is_restricted: boolean;
    internal: boolean;
    public_event: boolean;
    viewable(use_unshuffled_items_filter?: boolean): boolean;
}

export interface GraphItem {
    name: string;
    player?: number;
    price: number | null;
    advancement: boolean;
}

export interface GraphEntrance {
    name: string;
    alias: string;
    target_alias: string;
    use_target_alias: boolean;
    type: string | null;
    type_alias: string;
    type_priority: number;
    shuffled: boolean;
    coupled: boolean;
    is_warp: boolean;
    parent_region: GraphRegion;
    source_group: GraphRegion | null;
    target_group: GraphRegion | null;
    connected_region: GraphRegion | null;
    original_connection: GraphRegion | null;
    reverse: GraphEntrance | null,
    replaces: GraphEntrance | null,
    world: GraphWorld;
    boulders: GraphBoulder[],
    sphere: number;
    visited: boolean;
    visited_with_other_tricks: boolean;
    child_visited: boolean;
    child_visited_with_other_tricks: boolean;
    adult_visited: boolean;
    adult_visited_with_other_tricks: boolean;
    checked: boolean;
    hinted: boolean;
    viewable(): boolean;
    is_reverse(): boolean;
}

export interface GraphEntrancePool {
    [region_category: string]: GraphEntrance[],
}

export interface GraphRegion {
    name: string;
    alias: string;
    page: string;
    exits: GraphEntrance[];
    entrances: GraphEntrance[];
    locations: GraphLocation[];
    boulders: GraphBoulder[];
    world: GraphWorld;
    is_required: boolean;
    required_for: GraphHintGoal[];
    is_not_required: boolean;
    hinted_items: GraphItem[];
    num_major_items: number | null;
    viewable: boolean;
}

export interface GraphBoulder {
    name: string,
    alias: string,
    type: number,
    checked: boolean,
    hinted: boolean,
    shuffled: boolean,
    world: GraphWorld,
}

export interface GraphHint {
    type: string;
    area: GraphRegion | null;
    location: GraphLocation | null;
    location2: GraphLocation | null;
    entrance: GraphEntrance | null;
    target: GraphEntrance | null;
    goal: GraphHintGoal | null;
    item: GraphItem | null;
    item2: GraphItem | null;
    num_major_items: number | null;
    equals(other_hint: GraphHint): boolean;
}

export interface GraphWorld {
    id: number;
    regions: GraphRegion[];
    region_groups: GraphRegion[];
    readonly settings: GraphSettingsConfiguration,
    boulders: GraphBoulder[];
    fixed_item_area_hints: {
        [item_name: string]: {
            hint: string,
            hinted: boolean,
            hint_locations: string[],
        }
    },
    get_entrance(entrance: GraphEntrance | string): GraphEntrance,
    get_location(location: GraphLocation | string): GraphLocation,
    get_entrances(): GraphEntrance[],
    get_locations(): GraphLocation[],
    get_item(item: GraphItem | string): GraphItem,
    get_boulder(boulder: GraphBoulder | string): GraphBoulder,
}

export type GraphGameVersions = {
    game: string,
    versions: GameVersion[],
};

export abstract class GameVersion {
    abstract branch: string;
    abstract major: number;
    abstract minor: number;
    abstract patch: number;
    abstract supp: number;

    constructor(public version: string) {}

    // comparison methods to use for sorting versions
    abstract gt(version: string): boolean;
    abstract gte(version: string): boolean;
    abstract lt(version: string): boolean;
    abstract lte(version: string): boolean;
    abstract eq(version: string): boolean;

    // standardized naming scheme for caching randomizer files
    abstract local_folder(): string;
    abstract github_repo(): string;
    abstract commit_hash(): string;
    abstract get_file_list(): string[];
};

export type GraphSettingsConfiguration = {
    [internal_name: string]: GraphSettingType,
};

export type GraphSetting = {
    name: string,
    type: string,
    default: GraphSettingType,
    disabled_default: GraphSettingType,
    disables: GraphSetting[],
    disabled(settings: GraphSettingsConfiguration): boolean,
    display_name: string,
    tab: string,
    section: string,
    choices?: {[internal_name: string]: string},
    minimum?: number,
    maximum?: number,
};

export type GraphSettingsOptions = {
    [setting_name: string]: GraphSetting
}

export type GraphSettingType = boolean | string | number | string[] | object | null | undefined;

export type GraphSettingsLayout = {
    [tab: string]: {
        settings: GraphSetting[],
        sections: {
            [section: string]: GraphSetting[],
        }
    }
}

export type GraphItemDictionary = {
    [world_id: number]: {
        [item_name: string]: GraphItem,
    },
};

export class GraphHintGoal {
    public location: GraphLocation | null = null;
    public item: GraphItem | null = null;
    public item_count: number = 0;

    equals(other_goal: GraphHintGoal): boolean {
        return (
            this.location?.name === other_goal.location?.name
            && this.item?.name === other_goal.item?.name
            && this.item?.player === other_goal.item?.player
            && this.item?.price === other_goal.item?.price
            && this.item_count === other_goal.item_count
        )
    }
}

export abstract class GraphPlugin {
    abstract worlds: GraphWorld[];
    abstract file_cache: ExternalFileCache;
    abstract version: GameVersion;
    public static version_list: string[];

    constructor(
        private entrance_cache: {[world_id: number]: GraphEntrance[]} = {},
        private location_cache: {[world_id: number]: GraphLocation[]} = {},
        private item_cache: GraphItemDictionary = {},
        public initialized: boolean = false,
    ) {}

    reset() {
        this.worlds = [];
        this.reset_cache();
    }

    reset_cache() {
        this.entrance_cache = [];
        this.location_cache = [];
        this.item_cache = [];
    }

    // plando file processing
    abstract import(save_file: any): void;
    abstract export(with_user_overrides?: boolean, settings_only?: boolean): any;

    abstract get_settings_presets(): string[];
    abstract get_settings_preset(preset_name: string): any;
    abstract load_settings_preset(preset_name: string): void;

    // Version/branch list for selection, static class method
    abstract get_game_versions(include_outdated?: boolean): GraphGameVersions;

    abstract get_settings_options(): GraphSettingsOptions;
    abstract get_settings_layout(): GraphSettingsLayout;
    abstract change_setting(world: GraphWorld, setting: GraphSetting, value: GraphSettingType): void;

    // Convenience settings for changing the starting items setting(s)
    abstract add_starting_item(world: GraphWorld, item: GraphItem, count?: number): void;
    abstract remove_starting_item(world: GraphWorld, item: GraphItem, count?: number): void;
    abstract add_starting_items(world: GraphWorld, item: GraphItem[]): void;
    abstract remove_starting_items(world: GraphWorld, item: GraphItem[]): void;
    abstract replace_starting_item(world: GraphWorld, add_item: GraphItem, remove_item: GraphItem): void;

    // Search interface
    abstract check_location(location: GraphLocation): void;
    abstract uncheck_location(location: GraphLocation): void;
    abstract check_entrance(entrance: GraphEntrance): void;
    abstract uncheck_entrance(entrance: GraphEntrance): void;
    abstract check_boulder(boulder: GraphBoulder): void;
    abstract uncheck_boulder(boulder: GraphBoulder): void;
    abstract collect_locations(): void;
    abstract collect_spheres(): void;
    abstract get_accessible_entrances(): GraphEntrance[];
    abstract get_visited_locations(): GraphLocation[];
    abstract get_required_locations(): GraphLocation[];

    // Search interface world-specific convenience functions
    abstract get_accessible_entrances_for_world(world: GraphWorld): GraphEntrance[];
    abstract get_visited_locations_for_world(world: GraphWorld): GraphLocation[];
    abstract get_required_locations_for_world(world: GraphWorld): GraphLocation[];
    abstract get_required_locations_for_items(world: GraphWorld, goal_items: GraphItem[]): GraphLocation[];
    abstract get_collected_items_for_world(world: GraphWorld): {[item_name: string]: number};
    // filters collected items for some unshuffled items like skull tokens
    abstract get_player_inventory_for_world(world: GraphWorld): {[item_name: string]: number};

    // World building interface
    abstract set_location_item(location: GraphLocation, item: GraphItem | null, price?: number): void;
    abstract get_full_exit_pool(world: GraphWorld): GraphEntrancePool;
    abstract get_full_entrance_pool(world: GraphWorld): GraphEntrancePool;
    abstract get_entrance_pool(world: GraphWorld, entrance: GraphEntrance): GraphEntrancePool;
    abstract set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance | null): void;
    abstract set_boulder_type(boulder: GraphBoulder, type: number | null): void;

    // Item factory can create items that are not shuffled in the world, use with caution!
    abstract get_item(world: GraphWorld, item_name: string): GraphItem;

    // Hint interface
    abstract unhide_hint(hint_location: GraphLocation): void;
    abstract hint_location(hint_location: GraphLocation, hinted_location: GraphLocation, item: GraphItem): void;
    abstract hint_dual_locations(hint_location: GraphLocation, hinted_location1: GraphLocation, item1: GraphItem, hinted_location2: GraphLocation, item2: GraphItem): void;
    abstract hint_entrance(hint_location: GraphLocation, hinted_entrance: GraphEntrance, replaced_entrance: GraphEntrance): void;
    abstract hint_required_area(hint_location: GraphLocation, hinted_area: GraphRegion): void;
    abstract hint_area_required_for_goal(hint_location: GraphLocation, hinted_area: GraphRegion, hinted_goal: GraphHintGoal): void;
    abstract hint_unrequired_area(hint_location: GraphLocation, hinted_area: GraphRegion): void;
    abstract hint_item_in_area(hint_location: GraphLocation, hinted_area: GraphRegion, item: GraphItem): void;
    abstract hint_area_num_items(hint_location: GraphLocation, hinted_area: GraphRegion, num_major_items: number): void;
    abstract unhint(hint_location: GraphLocation): void;
    abstract cycle_hinted_areas_for_item(item_name: string, graph_world: GraphWorld, forward: boolean): {hint: string, hinted: boolean};

    get_entrances_for_world(world: GraphWorld): GraphEntrance[] {
        if (Object.keys(this.entrance_cache).length === 0) {
            for (let w of this.worlds) {
                this.entrance_cache[w.id] = [];
                for (let region of w.regions) {
                    for (let exit of region.exits) {
                        if (exit.viewable()) {
                            this.entrance_cache[w.id].push(exit);
                        }
                    }
                }
            }
        }
        return this.entrance_cache[world.id];
    }

    get_locations_for_world(world: GraphWorld): GraphLocation[] {
        if (Object.keys(this.location_cache).length === 0) {
            for (let w of this.worlds) {
                this.location_cache[w.id] = [];
                for (let region of w.regions) {
                    for (let location of region.locations) {
                        if ((!location.internal || location.public_event) && (location.shuffled || location.vanilla_item?.advancement) && !location.holds_shop_refill) {
                            this.location_cache[w.id].push(location);
                        }
                    }
                }
            }
        }
        return this.location_cache[world.id];
    }

    get_regions_for_world(world: GraphWorld): GraphRegion[] {
        return world.regions;
    }

    get_items(): GraphItemDictionary {
        if (Object.keys(this.item_cache).length === 0) {
            for (let world of this.worlds) {
                this.item_cache[world.id] = {};
                for (let region of world.regions) {
                    for (let location of region.locations) {
                        if (location.viewable() && !!location.vanilla_item && !(Object.keys(this.item_cache[world.id]).includes(location.vanilla_item.name))) {
                            this.item_cache[world.id][location.vanilla_item.name] = location.vanilla_item;
                        }
                    }
                }
            }
        }
        return this.item_cache;
    }
}