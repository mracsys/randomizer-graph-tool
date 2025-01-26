import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { WorldGraphRemoteFactory, WorldGraphFactory, ExternalFileCacheFactory, ExternalFileCache } from '..//WorldGraph.js';
import { GraphPlugin } from '../plugins/GraphPlugin.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';
import { non_required_items } from '../plugins/ootr-latest/ItemList.js';
import { compare_js_to_python, save_python_output_as_unit_test, get_plando_randomizer_version, test_settings, test_random_settings } from './generate_unit_tests.js';
import type { PythonData } from './generate_unit_tests.js';

async_wrapper();

async function async_wrapper() {
    try {
        //test_preset();
        //test_collecting_checked_locations();
        //test_reimport_export();
        //test_search_empty_world();
        //test_search_invalidation();
        //test_dungeon_region_group_swap();
        //test_entrance_linking();
        //test_region_viewability();
        //test_entrance_pools();
        //test_savewarps();
        test_import(true);
        //test_load(true);
        //test_spoiler(false, true);
        //test_remote_files();
        //test_random_settings(100, true);
        //test_specific_random_settings({legacy_sphere_gen: true, sphere_dir: resolve(rsl, 'patches')});
        //add_entrance_spheres_to_tests();
        //test_undisabling_settings();
        //test_settings_change();
        //test_trick_visited_entrances();
        //test_skipped_locations();
        //test_race_mode_inventory();
        //test_region_visibility();
        //await test_v8_settings_import();
    } catch (e) {
        console.log(e);
        if (e instanceof Error) {
            console.log(e.name, e.message, e.stack);
        }
    }
}

const localstorage_plando = {};

async function test_v8_settings_import() {
    let version = '8.1.45 Fenhl-3';
    let local_files = 'tests/ootr-local-fenhl-8-1-45-3';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');
    graph.collect_locations();
}

async function test_preset() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');
    graph.collect_locations();
}

async function test_race_mode_inventory() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await OotrGraphPlugin.create_remote_graph({}, version, global_cache);
    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', 'seed143.json'), { encoding: 'utf8'}));
    //graph.set_search_mode('Collected Items as Starting Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'starting_items');
    graph.import(plando);

    let inventory = graph.get_player_inventory_for_world(graph.worlds[0]);
    console.log(`Total inventory items: ${Object.values(inventory).reduce((p, a) => p + a, 0)}`);
    graph.collect_locations();
    inventory = graph.get_player_inventory_for_world(graph.worlds[0]);
    console.log(`Total inventory items: ${Object.values(inventory).reduce((p, a) => p + a, 0)}`);

    console.log('Done');
}

async function test_region_visibility() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await OotrGraphPlugin.create_remote_graph({}, version, global_cache);
    //graph.set_search_mode('Collected Items as Starting Items');
    //graph.set_region_search_mode('Logically Reachable');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'starting_items');
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_region_visibility_mode'], 'connected');

    let inventory = graph.get_player_inventory_for_world(graph.worlds[0]);
    console.log(`Total inventory items: ${Object.values(inventory).reduce((p, a) => p + a, 0)}`);
    graph.collect_locations();
    inventory = graph.get_player_inventory_for_world(graph.worlds[0]);
    console.log(`Total inventory items: ${Object.values(inventory).reduce((p, a) => p + a, 0)}`);

    graph.change_setting(graph.worlds[0], graph_settings['shuffle_overworld_entrances'], true);
    graph.change_setting(graph.worlds[0], graph_settings['shuffle_dungeon_entrances'], 'simple');

    let lw = graph.worlds[0].get_entrance('Kokiri Forest -> Lost Woods');
    let zr = graph.worlds[0].get_entrance('Lost Woods -> Zora River');
    let zd = graph.worlds[0].get_entrance('ZR Behind Waterfall -> Zoras Domain');
    let dmt = graph.worlds[0].get_entrance('Kak Behind Gate -> Death Mountain');
    let wl = graph.worlds[0].get_entrance('Wasteland Near Fortress -> GF Outside Gate');
    let me = graph.worlds[0].get_entrance('Market -> Market Entrance');
    graph.set_entrance(lw, zr);
    graph.set_entrance(zd, dmt);
    graph.set_entrance(wl, me);
    graph.collect_locations();

    console.log('Done');
}

async function test_trick_visited_entrances() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await OotrGraphPlugin.create_remote_graph({}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');

    graph.collect_locations();
    console.log(`Visited normal entrances count: ${graph.worlds[0].get_entrances().filter(e => e.visited).length}`);
    console.log(`Cached visited entrances: ${graph.search._cache.visited_entrances.size}`);
    //let entrance = graph.worlds[0].get_entrance('SFM Forest Temple Entrance Ledge -> Forest Temple Lobby');
    console.log(`Visited tricked entrances count: ${graph.all_tricks_worlds[0].get_entrances().filter(e => e.visited_with_other_tricks).length}`);
    console.log(`Cached visited entrances: ${graph.all_tricks_search._cache.visited_entrances.size}`);

    graph.add_starting_item(graph.worlds[0], graph.get_item(graph.worlds[0], 'Progressive Hookshot'));

    console.log(`Visited tricked entrances count: ${graph.all_tricks_worlds[0].get_entrances().filter(e => e.visited_with_other_tricks).length}`);
    console.log(`Cached visited entrances: ${graph.all_tricks_search._cache.visited_entrances.size}`);

    graph.collect_locations();
    console.log(`Visited tricked entrances count: ${graph.all_tricks_worlds[0].get_entrances().filter(e => e.visited_with_other_tricks).length}`);
    console.log(`Cached visited entrances: ${graph.all_tricks_search._cache.visited_entrances.size}`);
    console.log('Done');
}

async function test_skipped_locations() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await OotrGraphPlugin.create_remote_graph({}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');

    console.log(`Visited skipped locations count: ${graph.search._cache.pending_skipped_locations.size}`);
    graph.collect_locations();
    console.log(`Visited skipped locations count: ${graph.search._cache.pending_skipped_locations.size}`);

    let zl = graph.worlds[0].get_location('Song from Impa');
    let song = graph.get_item(graph.worlds[0], 'Zeldas Lullaby');
    graph.set_location_item(zl, song);

    console.log(`Visited skipped locations count: ${graph.search._cache.pending_skipped_locations.size}`);
    graph.collect_locations();
    console.log(`Visited skipped locations count: ${graph.search._cache.pending_skipped_locations.size}`);
    console.log('Done');
}

async function test_undisabling_settings() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');

    let settings = graph.get_settings_options();
    console.log(graph.worlds[0].settings['shuffle_hideoutkeys']);
    graph.change_setting(graph.worlds[0], settings['gerudo_fortress'], 'open');
    console.log(graph.worlds[0].settings['shuffle_hideoutkeys']);
    graph.change_setting(graph.worlds[0], settings['gerudo_fortress'], 'fast');
    console.log(graph.worlds[0].settings['shuffle_hideoutkeys']);
}

async function test_settings_change() {
    let version = '7.1.195 R-1';
    let local_files = 'tests/ootr-local-roman-195';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');
    graph.load_settings_preset('S7 Tournament');

    let settings = graph.get_settings_options();
    console.log(`${graph.worlds[0].settings['shuffle_ganon_bosskey']} ${settings['shuffle_ganon_bosskey'].disabled(graph.worlds[0].settings)}`);
    console.log(graph.worlds[0].settings['triforce_hunt']);
    graph.change_setting(graph.worlds[0], settings['triforce_hunt'], true);
    console.log(`${graph.worlds[0].settings['shuffle_ganon_bosskey']} ${settings['shuffle_ganon_bosskey'].disabled(graph.worlds[0].settings)}`);
    console.log(graph.worlds[0].settings['triforce_hunt']);
}

async function test_collecting_checked_locations() {
    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    //graph.set_search_mode('Collected Items');
    let graph_settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], graph_settings['graphplugin_world_search_mode'], 'collected');

    let locations_to_check: {[location: string]: string} = {
        'KF Midos Top Left Chest': 'Kokiri Sword',
    };
    
    let deku = graph.worlds[0].get_entrance('Kokiri Forest -> KF Outside Deku Tree');
    let graph_items = graph.get_items();
    graph.collect_locations();
    console.log(deku.visited);
    console.log(deku.visited_with_other_tricks);
    for (let [location, item_name] of Object.entries(locations_to_check)) {
        let sourceLocation = graph.worlds[0].get_location(location);
        let item = graph_items[0][item_name];
        graph.set_location_item(sourceLocation, item);
    }
    graph.collect_locations();
    console.log(deku.visited);
    console.log(deku.visited_with_other_tricks);
    for (let location of Object.keys(locations_to_check)) {
        let sourceLocation = graph.worlds[0].get_location(location);
        graph.check_location(sourceLocation);
    }
    graph.collect_locations();
    console.log(deku.visited);
    console.log(deku.visited_with_other_tricks);
}

async function test_reimport_export() {
    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', 'export.json'), { encoding: 'utf8'}));

    graph.import({});
    graph.collect_locations();
}

async function test_search_empty_world() {
    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    let locations_to_check: {[location: string]: string} = {
        'Song from Impa': 'Song of Storms',
    };
    
    let deku = graph.worlds[0].get_entrance('Hyrule Castle Grounds -> HC Storms Grotto');
    let graph_items = graph.get_items();
    graph.collect_locations();
    console.log(deku.visited);
    console.log(deku.visited_with_other_tricks);
    for (let [location, item_name] of Object.entries(locations_to_check)) {
        let sourceLocation = graph.worlds[0].get_location(location);
        let item = graph_items[0][item_name];
        graph.set_location_item(sourceLocation, item);
    }
    graph.collect_locations();
    console.log(deku.visited);
    console.log(deku.visited_with_other_tricks);
}

async function test_search_invalidation() {
    let result_file = 'seed143.json';

    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', result_file), { encoding: 'utf8'}));
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    graph.import(plando);

    let locations_to_clear = [
        'DMC Wall Freestanding PoH',
        'ZR Frogs Ocarina Game',
        'Song from Saria'
    ];
    graph.collect_locations();
    //console.log(graph.worlds[0].get_entrance('Graveyard Warp Pad Region -> Shadow Temple Entryway').visited);
    console.log(graph.worlds[0].get_location('Sheik in Forest').visited);
    console.log(graph.worlds[0].get_location('Sheik in Forest').visited_with_other_tricks);
    for (let location of locations_to_clear) {
        let sourceLocation = graph.worlds[0].get_location(location);
        graph.set_location_item(sourceLocation, null);
    }
    graph.collect_locations();
    //console.log(graph.worlds[0].get_entrance('Graveyard Warp Pad Region -> Shadow Temple Entryway').visited);
    console.log(graph.worlds[0].get_location('Sheik in Forest').visited);
    console.log(graph.worlds[0].get_location('Sheik in Forest').visited_with_other_tricks);
}

async function test_dungeon_region_group_swap() {
    let result_file = 'seed143.json';

    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', result_file), { encoding: 'utf8'}));
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    let settings = graph.get_settings_options();
    graph.import(plando);
    graph.change_setting(graph.worlds[0], settings['mq_dungeons_specific'], ['Ganons Castle']);
    graph.collect_spheres();
}

async function test_entrance_linking() {
    let result_file = 'python_plando_0BB3R39F94_settings_only.json';

    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', result_file), { encoding: 'utf8'}));
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    graph.import(plando);

    let sourceEntrance = graph.worlds[0].get_entrance('ToT Entrance -> Market');
    let targetEntrance = graph.worlds[0].get_entrance('Hyrule Field -> Gerudo Valley');
    graph.set_entrance(sourceEntrance, targetEntrance);
    graph.collect_spheres();
}

async function test_region_viewability() {
    let result_file = 'python_plando_0BB3R39F94_partial.json';

    let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', result_file), { encoding: 'utf8'}));
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    graph.import(plando);
    graph.collect_spheres();
}

async function test_savewarps() {
    let result_files = [
        'fire_temple_savewarp.json',
    ];
    let variant = 'fenhl'
    let initialized = false;

    let graph: GraphPlugin = WorldGraphFactory('empty');
    let global_cache: ExternalFileCache;
    let version: string;
    let local_files:string;
    for (let result_file of result_files) {
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/manual', result_file), { encoding: 'utf8'}));

        if (!initialized) {
            [version, local_files] = get_plando_randomizer_version(plando);
            global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
            graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
            initialized = true;
        }

        graph.import(plando);
        graph.collect_locations();

        let savewarp = graph.worlds[0].get_entrance('Volvagia Boss Room -> Fire Temple Lower');

        console.log(savewarp.connected_region?.name);

        let from = graph.worlds[0].get_entrance('GV Fortress Side -> GV Carpenter Tent');
        let connect = graph.worlds[0].get_entrance('Fire Temple Before Boss -> Volvagia Boss Room');
        graph.set_entrance(from, connect);
        graph.collect_locations();

        console.log(savewarp.connected_region?.name);
    }
}

async function test_entrance_pools() {
    let version = '8.1.51 Fenhl-1';
    let local_files = 'tests/ootr-local-fenhl-8-1-45-3';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    const shuffled_entrance_settings = {
        settings: {
            shuffle_interior_entrances: 'all',
            shuffle_hideout_entrances: 'hideout_savewarp',
            decouple_entrances: true,
        }
    }
    graph.import(shuffled_entrance_settings);
    let entrance = graph.worlds[0].get_entrance('Hideout Kitchen Hallway -> Gerudo Fortress');
    let pool = graph.get_entrance_pool(graph.worlds[0], entrance);
    console.log(JSON.stringify(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        .map(e => `[${e.type}]: ${e.name}`), null, 4) + '\n');
    console.log(Object.values(pool).flat().length);
}

async function test_oneway_entrance_pools() {
    let version = '7.1.143 R-1';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    let settings = graph.get_settings_options();
    let er = settings['warp_songs'];
    //let interior = settings['shuffle_interior_entrances'];
    //let mixed = settings['mix_entrance_pools'];
    //let decoupled = settings['decouple_entrances'];
    graph.change_setting(graph.worlds[0], er, true);
    //graph.change_setting(graph.worlds[0], interior, 'all');
    //graph.change_setting(graph.worlds[0], decoupled, true);
    //graph.change_setting(graph.worlds[0], mixed, [
    //    'Interior',
    //    'GrottoGrave',
    //    'Dungeon',
    //    'Overworld',
    //]);
    let entrance = graph.worlds[0].get_entrance('Prelude of Light Warp -> Temple of Time');
    let pool = graph.get_entrance_pool(graph.worlds[0], entrance);
    console.log(Object.keys(pool).length);
}

async function test_import(debug: boolean = false) {
    let result_files = [
        'python_plando_UFVQU6VUK5.json',
    ];
    let variant = 'realrob-8-2';
    let initialized = false;

    let graph: GraphPlugin = WorldGraphFactory('ootr', {}, '7.1.143', {files: {}, subfolder: ''});
    let global_cache: ExternalFileCache;
    let version: string;
    let local_files: string;
    let seed_path: string = '';
    let spoiler_path: string = '';
    for (let result_file of result_files) {
        let seed = result_file.split('_')[2];
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', variant, `python_spheres_${seed}`), 'utf-8'));
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', variant, `python_plando_${seed}`), { encoding: 'utf8'}));
        
        if (!initialized) {
            [version, local_files, seed_path, spoiler_path] = get_plando_randomizer_version(plando);
            global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
            graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
            initialized = true;
        }

        graph.import(plando);
        graph.collect_spheres();

        console.log(`\nTesting seed ${seed}\n`);

        compare_js_to_python(graph, data);
        if (debug) save_python_output_as_unit_test(plando, graph, data, false, seed_path, spoiler_path);
    }
}

async function test_load(debug: boolean = false) {
    let result_files = [
        'python_plando_8F7AZ9TMNG.json',
    ];
    let variant = 'realrob-8-2';

    let graph: GraphPlugin = WorldGraphFactory('ootr', {}, '8.2.46 Rob-124', {files: {}, subfolder: ''});
    let global_cache: ExternalFileCache;
    let version: string;
    let local_files: string;
    let seed_path: string;
    let spoiler_path: string;
    for (let result_file of result_files) {
        let seed = result_file.split('_')[2];
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', variant, `python_spheres_${seed}`), 'utf-8'));
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', variant, `python_plando_${seed}`), { encoding: 'utf8'}));

        [version, local_files, seed_path, spoiler_path] = get_plando_randomizer_version(plando);
        global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', localstorage_plando, version, global_cache);

        graph.collect_spheres();

        console.log(`\nTesting seed ${seed}\n`);

        compare_js_to_python(graph, data);
        if (debug) save_python_output_as_unit_test(plando, graph, data, false, seed_path, spoiler_path);
    }
}

async function test_remote_files() {
    //let _cache = {files: {}, subfolder: ''};
    let _cache = await ExternalFileCacheFactory('ootr', '7.1.117');
    let graph = WorldGraphFactory('ootr', {}, '7.1.117', _cache);
    console.log(graph.get_game_versions().versions[0].version);
}

async function test_spoiler(convert: boolean = false, debug: boolean = false) {
    // python_plando_U3CJUBQAKH
    // python_plando_VNTW9E7QFO
    // python_plando_YQQVR7YQ0G
    // python_plando_BUYD0FSB96
    let plando_path = resolve('./tests/seeds/fenhl', 'python_plando_SWQFS5C8L4.json');
    let plando_json = JSON.parse(readFileSync(plando_path, 'utf-8'));
    let [version, local_files, seed_path, spoiler_path] = get_plando_randomizer_version(plando_json);
    let [plando, graph, data, success] = await test_settings(plando_path, {sphere_dir: spoiler_path});
    if (convert) save_python_output_as_unit_test(plando, graph, data, success, seed_path, spoiler_path);
    if (debug) save_python_output_as_unit_test(plando, graph, data, false, seed_path, spoiler_path);
}

async function add_entrance_spheres_to_tests() {
    let python_results = readdirSync(resolve('tests/seeds'));

    for (let result_file of python_results) {
        let [plando, graph, data, success] = await test_settings(resolve('./tests/seeds', result_file), {sphere_dir: './tests/spoilers'});
        let [version, local_files, seed_path, spoiler_path] = get_plando_randomizer_version(plando);
        save_python_output_as_unit_test(plando, graph, data, success, seed_path, spoiler_path);
    }
}