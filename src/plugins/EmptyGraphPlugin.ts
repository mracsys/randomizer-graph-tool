import ExternalFileCache from "./ExternalFileCache.js";
import { GraphPlugin } from "./GraphPlugin.js";
import type { GraphGameVersions, GraphSetting, GraphEntrance, GraphLocation, GraphWorld, GraphItem, GraphSettingType, GraphSettingsOptions } from "./GraphPlugin.js";

export default class EmptyGraphPlugin extends GraphPlugin {
    public worlds: GraphWorld[];
    public file_cache: ExternalFileCache;

    constructor() {
        super();
        this.worlds = [];
        this.file_cache = { files: {} };
    }

    import(save_file: any): void { return };
    export(pretty: boolean): string { return '' };

    // Version/branch list for selection, static class method
    get_game_versions(): GraphGameVersions { return { game: 'empty', versions: [] }; };

    get_settings_options(): GraphSettingsOptions { return {} };
    change_setting(world: GraphWorld, setting: GraphSetting, value: GraphSettingType): void { return };

    // Search interface
    get_search_modes(): string[] { return [] };
    set_search_mode(mode: string): void { return };

    check_location(location: GraphLocation): void { return };
    uncheck_location(location: GraphLocation): void { return };
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
    get_entrance_pool(world: GraphWorld, entrance: GraphEntrance) { return {} };
    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };
}