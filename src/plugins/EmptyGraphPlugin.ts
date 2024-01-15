import ExternalFileCache from "./ExternalFileCache.js";
import { GraphPlugin } from "./GraphPlugin.js";
import type { GraphGameVersions, GraphSetting, GraphEntrance, GraphLocation, GraphRegion, GraphWorld, GraphItem, GraphHintGoal, GraphSettingType, GraphSettingsOptions, GraphSettingsLayout } from "./GraphPlugin.js";

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

    get_settings_presets(): string[] { return [] };
    get_settings_preset(preset_name: string): any { return };
    load_settings_preset(preset_name: string): void { return };

    // Version/branch list for selection, static class method
    get_game_versions(): GraphGameVersions { return { game: 'empty', versions: [] }; };

    get_settings_options(): GraphSettingsOptions { return {} };
    get_settings_layout(): GraphSettingsLayout { return {} };
    change_setting(world: GraphWorld, setting: GraphSetting, value: GraphSettingType): void { return };

    add_starting_item(world: GraphWorld, item: GraphItem): void { return };
    remove_starting_item(world: GraphWorld, item: GraphItem): void { return };
    add_starting_items(world: GraphWorld, item: GraphItem[]): void { return };
    remove_starting_items(world: GraphWorld, item: GraphItem[]): void { return };
    replace_starting_item(world: GraphWorld, add_item: GraphItem, remove_item: GraphItem): void { return };

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
    get_item(world: GraphWorld, item_name: string): GraphItem { return { name: '', price: null, advancement: false } };
    set_location_item(location: GraphLocation, item: GraphItem): void { return };
    get_entrance_pool(world: GraphWorld, entrance: GraphEntrance) { return {} };
    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };

    // Hint interface
    hint_location(hint_location: GraphLocation, hinted_location: GraphLocation, item: GraphItem): void { return };
    hint_entrance(hint_location: GraphLocation, hinted_entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };
    hint_required_area(hint_location: GraphLocation, hinted_area: GraphRegion): void { return };
    hint_area_required_for_goal(hint_location: GraphLocation, hinted_area: GraphRegion, hinted_goal: GraphHintGoal): void { return };
    hint_unrequired_area(hint_location: GraphLocation, hinted_area: GraphRegion): void { return };
    hint_item_in_area(hint_location: GraphLocation, hinted_area: GraphRegion, item: GraphItem): void { return };
    unhint(hint_location: GraphLocation): void { return };
    cycle_hinted_areas_for_item(item_name: string, graph_world: GraphWorld, forward: boolean): string { return '' };
}