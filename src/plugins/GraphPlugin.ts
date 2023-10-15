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
    world: GraphWorld | null;
    sphere: number;
    viewable(): boolean;
}

export interface GraphItem {
    name: string;
    player?: number;
}

export interface GraphEntrance {
    name: string;
    alias: string;
    target_alias: string;
    use_target_alias: boolean;
    type: string | null;
    type_alias: string;
    shuffled: boolean;
    coupled: boolean;
    is_warp: boolean;
    parent_region: GraphRegion;
    connected_region: GraphRegion | null;
    original_connection: GraphRegion | null;
    reverse: GraphEntrance | null,
    world: GraphWorld;
    sphere: number;
    viewable(): boolean;
}

export interface GraphRegion {
    name: string;
    alias: string;
    page: string;
    exits: GraphEntrance[];
    entrances: GraphEntrance[];
    locations: GraphLocation[];
    world: GraphWorld;
}

export interface GraphWorld {
    id: number;
    regions: GraphRegion[];
    region_groups: GraphRegion[];
    readonly settings: GraphSettingsConfiguration,
    get_entrance(entrance: GraphEntrance | string): GraphEntrance,
    get_location(location: GraphLocation | string): GraphLocation,
    get_entrances(): GraphEntrance[],
    get_locations(): GraphLocation[],
}

export type GraphGameVersions = {
    game: string,
    versions: GameVersion[],
};

export abstract class GameVersion {

    constructor(public version: string) {}

    // comparison methods to use for sorting versions
    abstract gt(version: string): boolean;
    abstract gte(version: string): boolean;
    abstract lt(version: string): boolean;
    abstract lte(version: string): boolean;
    abstract eq(version: string): boolean;
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

export type GraphSettingType = boolean | string | number | string[] | object | null | undefined;

export type GraphItemDictionary = {
    [world_id: number]: {
        [item_name: string]: GraphItem,
    },
};

export abstract class GraphPlugin {
    abstract worlds: GraphWorld[];
    abstract file_cache: ExternalFileCache;

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
    abstract export(pretty: boolean): string;

    // Version/branch list for selection, static class method
    abstract get_game_versions(): GraphGameVersions;

    abstract get_settings_options(): {[setting_name: string]: GraphSetting};
    abstract change_setting(world: GraphWorld, setting: GraphSetting, value: GraphSettingType): void;

    // Search interface
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

    // World building interface
    abstract set_location_item(location: GraphLocation, item: GraphItem): void;
    abstract get_entrance_pool(world: GraphWorld, entrance: GraphEntrance): {[category: string]: GraphEntrance[]};
    abstract set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void;

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
                        if (location.viewable()) {
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