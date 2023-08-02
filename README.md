# ootr-web-logic
Ocarina of Time Randomizer Logic Interpreter

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
_game_ - Game to analyze. Currently only `ootr` is supported.

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

Builds a graph object using the provided world settings. Use provided search functions to evaluate
logical access to locations and entrances. Worlds do not need to be fully specified. The graph will
search as far as it can from the spawn entrance and ignore unconnected entrances and unfilled locations.

For synchronous behavior, use `WorldGraphFactory` with a manually created `ExternalFileCache` of the same
game and version.

Compile time for the graph is 1-2 seconds, but a full search is less than a millisecond. You should cache and mutate
the graph object between uses to speed up calculations. See the _GraphPlugin_ type below for usage.

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
_game_ - Game to analyze.  See _WorldGraphRemoteFactory_ for supported games.

_version_ - Randomizer version for the game. See _WorldGraphRemoteFactory_ for supported versions.

_local\_files_ - __(Optional)__ Local folder containing external randomizer files. Relative paths from the project root folder can be used in addition to absolute paths. ***Only works in a node.js environment***

_local\_url_ - __(Optional)__ URL prefix override for randomizer files. If null and _local\_files_ is false, the Github repo for the selected game version is automatically used.

Caches remote randomizer files for the specified game and version.

### Types

```typescript
class GraphPlugin {
    public worlds: GraphWorld[];
    public file_cache: ExternalFileCache;
    public initialized: boolean;

    reset(): void {}

    // Version/branch list for selection, static class method
    get_game_versions(): GraphGameVersions;
    get_settings_options(): {[setting_name: string]: GraphSetting};

    // Search interface
    collect_locations(): void;
    collect_spheres(): void;
    get_accessible_entrances(): GraphEntrance[];
    get_visited_locations(): GraphLocation[];
    get_required_locations(): GraphLocation[]; // not currently implemented for ootr
    get_items(): {[world_id: number]: GraphItem[]} {}

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
    tab: string,
    section: string,
    choices?: {[internal_name: string]: string},
    minimum?: number,
    maximum?: number,
}

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
    type: string | null;
    shuffled: boolean;
    parent_region: GraphRegion;
    connected_region: GraphRegion | null;
    world: GraphWorld;
    viewable(): boolean;
}

interface GraphItem {
    name: string;
    player?: number;
}

interface GraphWorld {
    id: number;
    regions: GraphRegion[];
}

interface GraphRegion {
    name: string;
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