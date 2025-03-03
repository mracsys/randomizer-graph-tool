import ExternalFileCache from "./ExternalFileCache.js";
import { GraphPlugin } from "./GraphPlugin.js";
import { GraphGameVersions, GraphSetting, GraphEntrance, GraphLocation, GraphRegion, GraphWorld, GraphItem, GraphHintGoal, GraphSettingType, GraphSettingsOptions, GraphSettingsLayout, GraphBoulder, GameVersion } from "./GraphPlugin.js";

class EmptyGameVersion implements GameVersion {
    public branch: string = '';
    public major: number = 0;
    public minor: number = 0;
    public patch: number = 0;
    public supp: number = 0;

    constructor(public version: string) {}

    gt(version: string) { return true }
    gte(version: string) { return true }
    lt(version: string) { return true }
    lte(version: string) { return true }
    eq(version: string) { return true }

    local_folder(): string { return '' }
    github_repo(): string { return '' }
    commit_hash(): string { return '' }
    get_file_list(): string[] { return [] }
}

export default class EmptyGraphPlugin extends GraphPlugin {
    public worlds: GraphWorld[];
    public file_cache: ExternalFileCache;
    public version: GameVersion;
    public static version_list: string[];

    constructor() {
        super();
        this.worlds = [];
        this.file_cache = { files: {}, subfolder: '' };
        this.version = new EmptyGameVersion('');
    }

    import(save_file: any): void { return };
    export(pretty: boolean, settings_only: boolean): string { return '' };

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
    check_location(location: GraphLocation): void { return };
    uncheck_location(location: GraphLocation): void { return };
    check_entrance(entrance: GraphEntrance): void { return };
    uncheck_entrance(entrance: GraphEntrance): void { return };
    check_boulder(boulder: GraphBoulder): void { return };
    uncheck_boulder(boulder: GraphBoulder): void { return };
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
    get_player_inventory_for_world(world: GraphWorld): {[item_name: string]: number} { return {} };

    // World building interface
    get_item(world: GraphWorld, item_name: string): GraphItem { return { name: '', price: null, advancement: false } };
    set_location_item(location: GraphLocation, item: GraphItem, price?: number): void { return };
    get_full_exit_pool(world: GraphWorld) { return {} };
    get_full_entrance_pool(world: GraphWorld) { return {} };
    get_entrance_pool(world: GraphWorld, entrance: GraphEntrance) { return {} };
    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };
    set_boulder_type(boulder: GraphBoulder, type: number | null): void { return };

    // Hint interface
    unhide_hint(hint_location: GraphLocation): void { return };
    hint_location(hint_location: GraphLocation, hinted_location: GraphLocation, item: GraphItem): void { return };
    hint_dual_locations(hint_location: GraphLocation, hinted_location1: GraphLocation, item1: GraphItem, hinted_location2: GraphLocation, item2: GraphItem): void { return };
    hint_entrance(hint_location: GraphLocation, hinted_entrance: GraphEntrance, replaced_entrance: GraphEntrance): void { return };
    hint_required_area(hint_location: GraphLocation, hinted_area: string): void { return };
    hint_area_required_for_goal(hint_location: GraphLocation, hinted_area: string, hinted_goal: GraphHintGoal): void { return };
    hint_unrequired_area(hint_location: GraphLocation, hinted_area: string): void { return };
    hint_item_in_area(hint_location: GraphLocation, hinted_area: string, item: GraphItem): void { return };
    hint_area_num_items(hint_location: GraphLocation, hinted_area: string, num_major_items: number): void { return };
    unhint(hint_location: GraphLocation): void { return };
    cycle_hinted_areas_for_item(item_name: string, graph_world: GraphWorld, forward: boolean): {hint: string, hinted: boolean} { return {hint: '', hinted: false} };
    get_hint_regions(): string[] { return []; }
}