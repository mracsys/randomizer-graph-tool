#  randomizer-graph-tool

Provides a graph object to determine logically reachable locations and entrances for randomizers.

## Installation

Install in your project with

`npm install --save @mracsys/randomizer-graph-tool`

If the graph will be used in a browser instead of node, add the following key to your `package.json` file:

```json
"browser": {
    "fs": false
}
```

If anyone knows of a cleaner solution please let me know. @babel/standalone does not export a `types` object for creating new AST nodes.

## Usage

```typescript
import { WorldGraphFactory } from "@mracsys/randomizer-graph-tool"

let plando_file = JSON.parse(your_settings_as_plando.json);
let graph = await WorldGraphRemoteFactory('ootr', plando_file, plando_file[':version']);
graph.collect_locations();
let locations: GraphLocation[] = graph.get_visited_locations();
for (let location of locations) {
    console.log(`${location.name} containing ${location.item.name} is logically accessible with provided starting items and world layout`);
}
```

## Reference

### Functions

```typescript
async WorldGraphRemoteFactory(
    game: string = 'ootr',
    user_overrides: any = null,
    version: string = '7.1.143',
    global_cache: ExternalFileCache | null = null,
    debug: boolean = false
): GraphPlugin
```
Builds a graph object using the provided world settings. Use provided search functions to evaluate
logical access to locations and entrances. Worlds do not need to be fully specified. The graph will
search as far as it can from the spawn entrance and ignore unconnected entrances and unfilled locations.

For synchronous behavior, use `WorldGraphFactory` with a manually created `ExternalFileCache` of the same
game and version.

Compile time for the graph is 5-10 seconds, but a full search is less than a millisecond. You should cache and mutate
the graph object between uses to speed up calculations. See the _GraphPlugin_ type below for usage.

***Parameters***

_game_ - Game to analyze. Supported games are:

- `ootr` - Ocarina of Time Randomizer, https://github.com/OoTRandomizer/OoT-Randomizer
- `empty` - Empty `GraphPlugin` object with no locations, entrances, or settings

_user\_overrides_ - Valid plando file for the selected game and version.

_version_ - Randomizer version for the game. Supported versions are:

- ootr
    - 8.2.0 Release
    - 8.2.50 f.LUM
    - 8.2.50 Fenhl-1
    - 8.2.46 Rob-125
    - 8.1.0 Release
    - 8.1.45 f.LUM
    - 8.1.45 Fenhl-3
    - 8.1.29 Rob-104
    - 8.1.81 Rob-117
    - 7.1.198 Rob-49
    - 7.1.195 R-1
    - 7.1.154 R-1
    - 7.1.143 R-1

_global\_cache_ - Instance of ExternalFileCache (see below) containing required randomizer files as strings. If not specified, files are retrieved automatically from the internet. In a development environment with many requests from repeated startups, this may lead to ratelimiting from Github. A local cache is highly recommended.

_debug_ - Toggles extra console logging for development purposes

```typescript
WorldGraphFactory(
    game: string = 'ootr',
    user_overrides: any = null,
    version: string = '7.1.143',
    global_cache: ExternalFileCache = { files: {}, subfolder: '' },
    debug: boolean = false
): GraphPlugin
```

Synchronous variant of `WorldGraphRemoteFactory`. If a file cache is not provided, a stub object is created.
This stub is not capable of searches as it needs external files to describe the world. Check if the graph is
a stub or not with the `initialized` property.

```typescript
async ExternalFileCacheFactory(
    game: string = 'ootr',
    version: string = '7.1.143',
    {
        local_files = null,
        local_url = null,
    }: {
        local_files?: string | null,
        local_url?: string | null,
    } = {}
): ExternalFileCache
```
Caches remote randomizer files for the specified game and version.

***Parameters***

_game_ - Game to analyze.  See _WorldGraphRemoteFactory_ for supported games.

_version_ - Randomizer version for the game. See _WorldGraphRemoteFactory_ for supported versions.

_local\_files_ - __(Optional)__ Local folder containing external randomizer files. Relative paths from the project root folder can be used in addition to absolute paths. ***Only works in a node.js environment***

_local\_url_ - __(Optional)__ URL prefix override for randomizer files. If null and _local\_files_ is false, the Github repo for the selected game version is automatically used.


```typescript
async ExternalFileCacheFactory(
    game: string = 'ootr',
    version: string = '7.1.143',
    {
        local_files = null,
        local_url = null,
    }: {
        local_files?: string | null,
        local_url?: string | null,
    } = {}
): ExternalFileCache
```

### Types

```typescript
class GraphPlugin {
    abstract worlds: GraphWorld[];
    abstract file_cache: ExternalFileCache;
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
    abstract get_game_versions(): GraphGameVersions;

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

    // Search interface world-specific convenience functions
    get_entrances_for_world(world: GraphWorld): GraphEntrance[];
    get_locations_for_world(world: GraphWorld): GraphLocation[];
    get_regions_for_world(world: GraphWorld): GraphRegion[];
    get_items(): {[world_id: number]: GraphItem[]};
}

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

    constructor(public version: string) {}

    // comparison methods to use for sorting versions
    abstract gt(version: string): boolean;
    abstract gte(version: string): boolean;
    abstract lt(version: string): boolean;
    abstract lte(version: string): boolean;
    abstract eq(version: string): boolean;

    // standardized naming scheme for caching randomizer files
    abstract local_folder(): string;
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
```

## Building

Initialize the repository with:

`pnpm install`

Build the project with:

`pnpm build`

Compile a dev environment with testing scripts with:

`pnpm debug`

Unit tests are included in `tests`. Requires OOTR 7.1.143 files to be saved locally to a folder `ootr-local-143` in the root of the project. Run with jest or:

`pnpm test`

Integration testing scripts are included in `src/scripts/`

Publish the library to npm with:

```
npm login
npm publish --dry-run
npm publish --access=public
```

## Changelog

### 2.1.0

* Add subregion feature to region groups
* Support newer randomizer versions
    - Main branch
        - 8.2.0 Release
        - 8.2.50 Dev
    - Fenhl's branch
        - 8.2.50 Fenhl-1
    - RealRob's branch
        - 8.1.81 Rob-117
        - 8.2.46 Rob-125
* Use upstream hint region definitions instead of region group names for hints using regions

### 2.0.0

* Breaking changes for file cache and graph factories.
* Full integration with [TOoTR](https://github.com/mracsys/tootr)
* Removed support for Ocarina of Time Randomizer dev versions before 7.1.143. Files are temporarily archived in the `src/plugins/ootr-7.1` folder in case support is restored in the future.
* Removed Roman971's branch from advertised supported versions. Still supported internally for now. Feature set superseded by RealRob's and Fenhl's branches.
* New OOTR versions and branches supported
    - Main branch
        - 8.1.0 Release
        - 8.1.45 Dev
    - Fenhl's branch
        - 8.1.45 Fenhl-3
    - RealRob's branch
        - 8.1.29 Rob-104
* Unit tests use local cached copies of randomizer files except for the remote file retrieval test
* Use pnpm instead of yarn
* Many bugfixes

### 1.1.1

* Fix GraphSettingType export

### 1.1.0

* Advertise shuffled entrances and locations correctly
* Provide read/write access to individual world settings
* Add `empty` graph type for state placeholder applications

### 1.0.0

Initial Release