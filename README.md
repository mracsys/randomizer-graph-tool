#  randomizer-graph-tool

Provides a graph object to determine logically reachable locations and entrances for randomizers.

## Installation

Install in your project with

`npm install --save @mracsys/randomizer-graph-tool`

or

`yarn add @mracsys/randomizer-graph-tool`

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
let graph = await WorldGraphRemoteFactory('ootr', plando_file, '7.1.143');
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
    global_cache: ExternalFileCache = { files: {} },
    debug: boolean = false
): GraphPlugin
```
Builds a graph object using the provided world settings. Use provided search functions to evaluate
logical access to locations and entrances. Worlds do not need to be fully specified. The graph will
search as far as it can from the spawn entrance and ignore unconnected entrances and unfilled locations.

For synchronous behavior, use `WorldGraphFactory` with a manually created `ExternalFileCache` of the same
game and version.

Compile time for the graph is 1-2 seconds, but a full search is less than a millisecond. You should cache and mutate
the graph object between uses to speed up calculations. See the _GraphPlugin_ type below for usage.

***Parameters***

_game_ - Game to analyze. Supported games are:

- `ootr` - Ocarina of Time Randomizer, https://github.com/OoTRandomizer/OoT-Randomizer
- `empty` - Empty `GraphPlugin` object with no locations, entrances, or settings

_user\_overrides_ - Valid plando file for the selected game and version.

_version_ - Randomizer version for the game. Supported versions are:

- ootr
    - 7.1.117
    - 7.1.143
    - 7.1.154
    - 7.1.143 R-1
    - 7.1.154 R-1

_global\_cache_ - Instance of ExternalFileCache (see below) containing required randomizer files as strings. If not specified, files are retrieved automatically from the internet. In a development environment with many requests from repeated startups, this may lead to ratelimiting from Github. A local cache for dev work is highly recommended.

_debug_ - Toggles extra console logging for development purposes

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

### Types

```typescript
class GraphPlugin {
    public worlds: GraphWorld[];
    public file_cache: ExternalFileCache;
    public initialized: boolean;

    reset(): void;
    reset_cache(): void;

    // plando file processing
    import(save_file: any): void;
    export(pretty: boolean): string;

    // Version/branch list for selection, static class method
    get_game_versions(): GraphGameVersions;
    
    get_settings_options(): {[setting_name: string]: GraphSetting};
    change_setting(world: GraphWorld, setting: GraphSetting, value: GraphSettingType): void;

    // Search interface
    collect_locations(): void;
    collect_spheres(): void;
    get_accessible_entrances(): GraphEntrance[];
    get_visited_locations(): GraphLocation[];
    get_required_locations(): GraphLocation[]; // not currently implemented for ootr
    get_items(): {[world_id: number]: GraphItem[]};

    // Search interface world-specific convenience functions
    get_entrances_for_world(world: GraphWorld): GraphEntrance[];
    get_accessible_entrances_for_world(world: GraphWorld): GraphEntrance[];
    get_locations_for_world(world: GraphWorld): GraphLocation[];
    get_visited_locations_for_world(world: GraphWorld): GraphLocation[];
    get_required_locations_for_world(world: GraphWorld): GraphLocation[];  // not currently implemented for ootr
    get_required_locations_for_items(world: GraphWorld, goal_items: GraphItem[]): GraphLocation[];  // not currently implemented for ootr
    get_collected_items_for_world(world: GraphWorld): {[item_name: string]: number};
    get_regions_for_world(world: GraphWorld): GraphRegion[];

    // World building interface
    set_location_item(location: GraphLocation, item: GraphItem): void;
    get_entrance_pool(world: GraphWorld, entrance: GraphEntrance): {[category: string]: GraphEntrance[]};
    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void;
}

class GameVersion {
    public version: string

    // comparison methods to use for sorting versions
    gt(version: string): boolean;
    gte(version: string): boolean;
    lt(version: string): boolean;
    lte(version: string): boolean;
    eq(version: string): boolean;
}

type GraphGameVersions = {
    game: string,
    versions: GameVersion[],
}

type GraphSetting = {
    name: string,
    type: string,
    default: any,
    disabled_default: GraphSettingType,
    disables: GraphSetting[],
    disabled(settings: GraphSettingsConfiguration): boolean,
    display_name: string,
    tab: string,
    section: string,
    choices?: {[internal_name: string]: string},
    minimum?: number,
    maximum?: number,
}

type GraphSettingType = boolean | string | number | string[] | object | null | undefined;
type GraphSettingsConfiguration = {
    [internal_name: string]: GraphSettingType,
};

interface GraphLocation {
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

interface GraphEntrance {
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

interface GraphItem {
    name: string;
    player?: number;
}

interface GraphWorld {
    id: number;
    regions: GraphRegion[];
    region_groups: GraphRegion[];
    readonly settings: GraphSettingsConfiguration,
    get_entrance(entrance: GraphEntrance | string): GraphEntrance,
    get_location(location: GraphLocation | string): GraphLocation,
    get_entrances(): GraphEntrance[],
    get_locations(): GraphLocation[],
}

interface GraphRegion {
    name: string;
    alias: string;
    page: string;
    exits: GraphEntrance[];
    entrances: GraphEntrance[];
    locations: GraphLocation[];
    world: GraphWorld;
}
```

## Building

Initialize the repository with:

`yarn install`

Build the project with:

`yarn build`

Compile a dev environment with testing scripts with:

`yarn debug`

Unit tests are included in `tests`. Requires OOTR 7.1.143 files to be saved locally to a folder `ootr-local-143` in the root of the project. Run with jest or:

`yarn test`

Integration testing scripts are included in `src/scripts/`

Publish the library to npm with:

```
npm login
npm publish --dry-run
npm publish --access=public
```

## Changelog

### 2.0.0

* Removed support for Ocarina of Time Randomizer dev versions before 7.1.143. Files are temporarily archived in the `src/plugins/ootr-7.1` folder in case support is restored in the future.
* New OOTR versions and branches supported
    - Main branch
        - 7.1.198
    - Roman971's branch
        - 7.1.195 R-1
    - RealRob's branch
        - 7.1.198 Rob-49
* Introduced GraphPlugin.change_setting
    - Replaces direct mutation of GraphWorld.settings
    - Handles other internal changes required for a setting, such as swapping between Ocarina of Time vanilla and Master Quest region files
    - Handles setting dependencies by disabling child settings when necessary. Settings are disabled by setting them to their `disabled_default` value.
* GraphWorld.settings changed to readonly
* GraphWorld convenience functions in parallel with existing GraphPlugin per-world methods
* Settings display names parsing for OOTR lists added
* Custom display names added for regions, entrances, and locations
    - `alias` is the default display name
    - GraphEntrance `target_alias` overrides the default alias when considering valid destinations for a GraphRegion exit. These values can be the same between different entrances, such as multiple Great Fairy Fountain interiors in Ocarina of Time.
    - GraphEntrance `use_target_alias` property to specify if the target alias should be used given the current world settings
    - GraphEntrance `type_alias` provides a display name for the entrance type when considering valid destinations. Targets can be grouped by destination region or entrance type.
* Grouped regions added for display purposes
    - Accessed via GraphWorld.region_groups
    - `page` property of each region specifies a suggested grouping method for region groups, such as Overworld and Dungeons
    - Region groups have all the same properties as lower level GraphRegion objects
* Added GraphPlugin.get_entrance_pools() method to retrieve remaining unconnected entrances for a given entrance type
* Entrance metadata added
    - Original forward and reverse entrance connections pre-shuffle, where applicable
    - is_warp property for unidirectional entrances
    - coupled property to implicitly support randomizers that do not have a decoupled entrances setting
    - sphere property for the item collection sphere in which the entrance can be traversed per the chosen randomizer logic settings
* Added GraphPlugin.export() method to save graph state to a text file that can be fed back into a new graph instance
* Added GraphPlugin.import() method to reset graph state with a given input file instead of creating a completely new graph
* GraphPlugin.get_items() return type is now a per-world dictionary of item names to item objects.
    - Previous implementation was a per-world array of item objects for all locations in the game, including duplicate items.
    - Item dictionary values are now unique with no duplicates.
* New OOTR settings appended to upstream settings lists
    - `graphplugin_trials_specific` to set specific enabled trials in the `settings` key instead of requiring a `trials` key
    - `graphplugin_song_melodies` to set known song melodies with Ocarina Melody randomization enabled instead of relying on the `songs` key.
* Unit tests use local cached copies of randomizer files except for the remote file retrieval test
* Bug fixes
    - Fixed bug in OOTR settings list parsing for inline python comments
    - Decoupled entrances do not try to always link reverse entrances, frequently overriding previously set connections from the imported file with invalid connections

### 1.1.1

* Fix GraphSettingType export

### 1.1.0

* Advertise shuffled entrances and locations correctly
* Provide read/write access to individual world settings
* Add `empty` graph type for state placeholder applications

### 1.0.0

Initial Release