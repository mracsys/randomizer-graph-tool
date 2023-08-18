import ExternalFileCache from "./ExternalFileCache.js";
import { GraphPlugin } from "./GraphPlugin.js";
import type { GraphGameVersions, GraphSetting, GraphEntrance, GraphLocation, GraphWorld, GraphItem } from "./GraphPlugin.js";

export default class EmptyGraphPlugin extends GraphPlugin {
    public worlds: GraphWorld[];
    public file_cache: ExternalFileCache;

    constructor() {
        super();
        this.worlds = [];
        this.file_cache = { files: {} };
    }

    // Version/branch list for selection, static class method
    get_game_versions(): GraphGameVersions { return { game: 'empty', versions: [] }; };

    get_settings_options(): {[setting_name: string]: GraphSetting} { return {} };

    // Search interface
    collect_locations(): void { return };
    collect_spheres(): void { return };
    get_accessible_entrances(): GraphEntrance[] { return [] };
    get_visited_locations(): GraphLocation[] { return [] };
    get_required_locations(): GraphLocation[] { return [] };

    // Search interface world-specific convenience functions
    get_accessible_entrances_for_world(world: GraphWorld): GraphEntrance[] { return [] };
    get_visited_locations_for_world(world: GraphWorld): GraphLocation[] { return [] };
    get_required_locations_for_world(world: GraphWorld): GraphLocation[] { return [] };
    get_required_locations_for_items(world: GraphWorld, goal_items: GraphItem[]): GraphLocation[] { return [] };
    get_collected_items_for_world(world: GraphWorld): {[item_name: string]: number} { return {} };

    // World building interface
    set_location_item(location: GraphLocation, item: GraphItem): void { return };
    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };
}