import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { WorldGraphRemoteFactory, WorldGraphFactory, ExternalFileCacheFactory, ExternalFileCache } from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphEntrance, GraphLocation, GraphPlugin } from '../plugins/GraphPlugin.js';
import { Location } from '../plugins/ootr-latest/Location.js';
import Entrance from '../plugins/ootr-latest/Entrance.js';
import World from '../plugins/ootr-latest/World.js';
import { non_required_items } from '../plugins/ootr-latest/ItemList.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';
import { locationFilter } from '../plugins/ootr-latest/Utils.js';

// local paths to RSL script and OOTR for generating/validating world searches
var rsl = '/home/mracsys/git/plando-random-settings';
var rando = '/home/mracsys/git/OoT-Randomizer-Fork';

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
        'python_plando_07DLRR1OYW.json',
    ];
    let variant = 'fenhl'
    let initialized = false;

    let graph: GraphPlugin = WorldGraphFactory('ootr', {}, '8.1.45 Fenhl-3', {files: {}, subfolder: ''});
    let global_cache: ExternalFileCache;
    let version: string;
    let local_files:string;
    for (let result_file of result_files) {
        let seed = result_file.split('_')[2];
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', variant, `python_spheres_${seed}`), 'utf-8'));
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', variant, `python_plando_${seed}`), { encoding: 'utf8'}));
        
        if (!initialized) {
            [version, local_files] = get_plando_randomizer_version(plando);
            global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
            graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
            initialized = true;
        }

        graph.import(plando);
        graph.collect_spheres();

        console.log(`\nTesting seed ${seed}\n`);

        compare_js_to_python(graph, data);
        if (debug) save_python_output_as_unit_test(plando, graph, data, false);
    }
}

async function test_load(debug: boolean = false) {
    let result_files = [
        'python_plando_1BKILJ35R9.json',
    ];
    let variant = 'realrob-8'

    let graph: GraphPlugin = WorldGraphFactory('ootr', {}, '8.1.29 Rob-104', {files: {}, subfolder: ''});
    let global_cache: ExternalFileCache;
    let version: string;
    let local_files:string;
    for (let result_file of result_files) {
        let seed = result_file.split('_')[2];
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', variant, `python_spheres_${seed}`), 'utf-8'));
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', variant, `python_plando_${seed}`), { encoding: 'utf8'}));

        [version, local_files] = get_plando_randomizer_version(plando);
        global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', localstorage_plando, version, global_cache);

        graph.collect_spheres();

        console.log(`\nTesting seed ${seed}\n`);

        compare_js_to_python(graph, data);
        if (debug) save_python_output_as_unit_test(plando, graph, data, false);
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
    let [plando, graph, data, success] = await test_settings(resolve('./tests/seeds/fenhl', 'python_plando_SWQFS5C8L4.json'), {sphere_dir: './tests/spoilers/fenhl'});
    if (convert) save_python_output_as_unit_test(plando, graph, data, success);
    if (debug) save_python_output_as_unit_test(plando, graph, data, false);
}

async function add_entrance_spheres_to_tests() {
    let python_results = readdirSync(resolve('tests/seeds'));

    for (let result_file of python_results) {
        let [plando, graph, data, success] = await test_settings(resolve('./tests/seeds', result_file), {sphere_dir: './tests/spoilers'});
        save_python_output_as_unit_test(plando, graph, data, success);
    }
}

async function test_specific_random_settings({f = '', legacy_sphere_gen = false, sphere_dir = ''}: {f?: string, legacy_sphere_gen?: boolean, sphere_dir?: string} = {}) {
    let plando_input: string;
    if (f === '') {
        let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
        plando_input = files[0];
    } else {
        plando_input = f;
    }
    let [plando, graph, data, success] = await test_settings(resolve(rsl, 'patches', plando_input), {export_spheres: true, legacy_sphere_gen: legacy_sphere_gen, sphere_dir: sphere_dir});
    save_python_output_as_unit_test(plando, graph, data, success);
    if (success) {
        unlinkSync(resolve(rsl, 'patches', plando_input));
        if (!legacy_sphere_gen) {
            let seed_string = plando[':seed'];
            unlinkSync(resolve(rsl, 'patches', `python_spheres_${seed_string}.json`));
            unlinkSync(resolve(rsl, 'patches', `python_plando_${seed_string}.json`));
        }
    }
    return success;
}

async function test_settings(plando_file: string, {export_spheres = false, legacy_sphere_gen = false, sphere_dir = ''}: {export_spheres?: boolean, legacy_sphere_gen?: boolean, sphere_dir?: string} = {}) {
    let plando = JSON.parse(readFileSync(plando_file, 'utf-8'));
    plando[':collect'] = 'spheres';
    delete plando.item_pool;
    if (plando.settings.hint_dist === 'custom') {
        delete plando.settings.hint_dist;
    }
    console.log('Running python search');
    var data;
    if (legacy_sphere_gen) {
        var pythonGraph = spawnSync('python3', [resolve(rando, 'LogicAPI.py')], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
        data = read_python_stdout(pythonGraph);
    } else {
        let seed_string = plando[':seed'];
        data = JSON.parse(readFileSync(resolve(sphere_dir, `python_spheres_${seed_string}.json`), 'utf-8'));
    }

    console.log('Running JS search');
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await OotrFileCache.load_ootr_files(version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', plando, version, global_cache);
    graph.collect_spheres();

    let success = compare_js_to_python(graph, data);
    return [plando, graph, data, success];
}

async function test_random_settings(max_seeds: number = 1, legacy_sphere_gen: boolean = false) {
    let files;
    files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    if (files.length > 0) {
        console.log('Re-testing failed random spoilers');
        for (let f of files) {
            console.log(`Testing ${f}`);
            if (!(await test_specific_random_settings({f: f, legacy_sphere_gen: legacy_sphere_gen, sphere_dir: resolve(rsl, 'patches')}))) {
                console.log('Problem detected, stopping random seed generation');
                return;
            }
        }
    }

    let [version, local_files] = get_plando_randomizer_version({});
    let global_cache = await OotrFileCache.load_ootr_files(version, { local_files: local_files });

    for (let i = 0; i < max_seeds; i++) {
        console.log(`Testing seed ${i + 1} of ${max_seeds}`);
        console.log('Running python search');
        let data, plando;
        let attempts = 0;
        while (true) {
            console.log(`Generating random plando (attempt ${attempts})`)
            let rsl_output = spawnSync('python3', [resolve(rsl, 'RandomSettingsGenerator.py'), '--test_javascript'], { cwd: rsl, encoding: 'utf8', maxBuffer: 10240 * 1024 });
            // restart script if reroll limit exceeded
            if (rsl_output.status !== 0) {
                attempts++;
                continue;
            }
            files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
            if (files.length < 1) {
                throw('Generator Error: no spoiler to load');
            } else if (files.length > 1) {
                throw('Generator Error: more than one spoiler to load');
            }
            try {
                console.log('Attempting to generate sphere data');
                plando = JSON.parse(readFileSync(resolve(rsl, 'patches', files[0]), 'utf-8'));
                plando[':collect'] = 'spheres';
                delete plando.item_pool;
                if (plando.settings.hint_dist === 'custom') {
                    delete plando.settings.hint_dist;
                }
                console.log('Parsing sphere output');
                if (legacy_sphere_gen) {
                    let pythonGraph = spawnSync('python3', [resolve(rando, 'LogicAPI.py')], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
                    data = read_python_stdout(pythonGraph);
                } else {
                    let seed_string = plando[':seed'];
                    data = JSON.parse(readFileSync(resolve(rsl, 'patches', `python_spheres_${seed_string}.json`), 'utf-8'));
                }
                attempts = 0
                break;
            } catch (e) {
                console.log(e);
                unlinkSync(resolve(rsl, 'patches', files[0]));
                attempts++;
            }
        }

        console.log('Running JS search');
        let graph = await WorldGraphRemoteFactory('ootr', plando, version, global_cache);
        graph.collect_spheres();

        let success = compare_js_to_python(graph, data);

        save_python_output_as_unit_test(plando, graph, data, success);

        if (success) {
            unlinkSync(resolve(rsl, 'patches', files[0]));
            if (!legacy_sphere_gen) {
                let seed_string = plando[':seed'];
                unlinkSync(resolve(rsl, 'patches', `python_spheres_${seed_string}.json`));
                unlinkSync(resolve(rsl, 'patches', `python_plando_${seed_string}.json`));
            }
    
        } else {
            console.log('Problem detected, stopping random seed generation');
            // stop looping to allow re-testing the failed plando
            break;
        }
    }
}

function get_plando_randomizer_version(plando: {[key: string]: any}): [string, string] {
    let version: string;
    let local_files: string;
    if (Object.keys(plando).includes(':version')) {
        version = plando[':version'];
        switch (version) {
            case '7.1.117 f.LUM':
                local_files = 'tests/ootr-local-117';
                break;
            case '7.1.143 f.LUM':
                local_files = 'tests/ootr-local-143';
                break;
            case '7.1.198 R-1':
            case '7.1.195 R-1':
                local_files = 'tests/ootr-local-roman-195';
                break;
            case '7.1.198 Rob-49':
                local_files = 'tests/ootr-local-realrob-198';
                break;
            case '8.1.29 Rob-104':
                local_files = 'tests/ootr-local-realrob-8-1-29-104';
                break;
            case '8.1.45 Fenhl-3':
                local_files = 'tests/ootr-local-fenhl-8-1-45-3';
                break;
            case '8.1.51 Fenhl-1':
                local_files = 'tests/ootr-local-fenhl-8-1-45-3';
                break;
            default:
                throw(`Unknown version for local testing: ${version}`);
        }
    } else {
        // used by random settings generator for bulk plando generation
        version = '8.1.29 Rob-104';
        local_files = 'tests/ootr-local-realrob-8-1-29-104';
        //version = '8.1.45 Fenhl-3';
        //local_files = 'tests/ootr-local-fenhl-8-1-45-3';
    }
    return [version, local_files];
}

function save_python_output_as_unit_test(plando: {[key: string]: any}, graph: GraphPlugin, data: PythonData, success: boolean) {
    let sorted_data = sort_spheres(data);
    if (success) {
        let seed_string = plando[':seed'];
        writeFileSync(resolve('./tests/seeds/realrob-8/', `python_plando_${seed_string}.json`), JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync(resolve('./tests/spoilers/realrob-8/', `python_spheres_${seed_string}.json`), JSON.stringify(sorted_data, null, 4), 'utf-8');
    } else {
        writeFileSync('./python_plando.json', JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync('./python_spheres.json', JSON.stringify(sorted_data.spheres, null, 4), 'utf-8');
        writeFileSync('./python_sphere_logic.json', JSON.stringify(sorted_data.sphere_logic_rules, null, 4), 'utf-8');
        if (!!(data.entrance_spheres))
            writeFileSync('./python_entrance_sphere_logic.json', JSON.stringify(sorted_data.entrance_spheres, null, 4), 'utf-8');
        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();
        let jsdata: PythonData = {
            locations: {},
            spheres: {},
            sphere_logic_rules: {},
            entrance_spheres: {},
        };
        for (let l of locs) {
            if (!!l.item) {
                if (!(Object.keys(jsdata.spheres).includes(l.sphere.toString()))) {
                    jsdata.spheres[l.sphere.toString()] = {};
                    jsdata.sphere_logic_rules[l.sphere.toString()] = {};
                }
                jsdata.spheres[l.sphere.toString()][l.name] = l.item.name;
                let ootr_loc = <Location>l;
                jsdata.sphere_logic_rules[l.sphere.toString()][l.name] = ootr_loc.transformed_rule;
            }
        }
        for (let e of ents) {
            if (e.sphere === -1) continue;
            if (!(Object.keys(jsdata.entrance_spheres).includes(e.sphere.toString()))) {
                jsdata.entrance_spheres[e.sphere.toString()] = {};
            }
            let ootr_ent = <Entrance>e;
            jsdata.entrance_spheres[e.sphere.toString()][e.name] = ootr_ent.transformed_rule;
        }
        let sorted_jsdata = sort_spheres(jsdata);
        writeFileSync('./js_spheres.json', JSON.stringify(sorted_jsdata.spheres, null, 4), 'utf-8');
        writeFileSync('./js_sphere_logic.json', JSON.stringify(sorted_jsdata.sphere_logic_rules, null, 4), 'utf-8');
        writeFileSync('./js_entrance_sphere_logic.json', JSON.stringify(sorted_jsdata.entrance_spheres, null, 4), 'utf-8');
    }
}

function sort_spheres(data: PythonData): PythonData {
    let ordered_spheres: PythonData = {
        locations: data.locations,
        spheres: {},
        sphere_logic_rules: {},
        entrance_spheres: {},
    };
    for (let sphere_num of Object.keys(data.spheres).sort()) {
        ordered_spheres.spheres[sphere_num] = sphere_reducer(data.spheres[sphere_num]);
    }
    for (let sphere_num of Object.keys(data.sphere_logic_rules).sort()) {
        ordered_spheres.sphere_logic_rules[sphere_num] = sphere_reducer(data.sphere_logic_rules[sphere_num]);
    }
    if (!!(data.entrance_spheres)) {
        for (let sphere_num of Object.keys(data.entrance_spheres).sort()) {
            ordered_spheres.entrance_spheres[sphere_num] = sphere_reducer(data.entrance_spheres[sphere_num]);
        }
    }
    return ordered_spheres;
}

function sphere_reducer(sphere: SinglePythonSphere): SinglePythonSphere {
    return Object.keys(sphere).sort().reduce(
        (obj: SinglePythonSphere, key: string) => {
            obj[key] = sphere[key];
            return obj;
        },
        {}
    );
}

type PythonData = {
    locations: PythonLocation,
    spheres: PythonSphere,
    sphere_logic_rules: PythonSphere,
    entrance_spheres: PythonSphere,
};
type PythonLocation = {
    [location_name: string]: {
        name: string,
        type: string,
        world: string,
        rule_string: string,
        transformed_rule: string,
        visited: boolean,
        sphere: number,
        item_name: string,
        child_access_rule: boolean,
        adult_access_rule: boolean,
    }
};
type PythonSphere = {
    [sphere: string]: SinglePythonSphere,
};
type SinglePythonSphere = {
    [location_name: string]: string,
};

function read_python_stdout(pythonGraph: SpawnSyncReturns<string>): PythonData {
    try {
        var data = JSON.parse(pythonGraph.stdout);
    } catch (error) {
        if (pythonGraph.stderr !== '') {
            console.log('Problem with spawned process return value');
            console.log(pythonGraph.stderr);
        } else {
            console.log('Problem reading python stdout');
            console.log(pythonGraph.stdout.split('\n')[0]);
        }
        throw(error);
    }
    return data;
}

function compare_js_to_python(graph: GraphPlugin, data: PythonData) {
    let ldata = data.locations;
    console.log(`${graph.get_visited_locations().length} total visited JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited).length} total visited python locations`);
    console.log(`${graph.get_visited_locations().filter((l) => locationFilter(l) && !(l.type.startsWith('Hint'))).length} visited non-event JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event' && !(ldata[l].type.startsWith('Hint'))).length} visited non-event python locations`);

    // Filter out extra event items as they usually show up because in-place logic settings replacement is removed,
    // which causes some always/never events to no longer be always/never.
    // Testing enough seeds will hopefully show any actual locations affected by extra events.
    let success = graph.get_visited_locations().filter((l) => locationFilter(l) && !(l.type.startsWith('Hint'))).length
                    === Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event' && !(ldata[l].type.startsWith('Hint'))).length;
    let locs = graph.get_visited_locations();
    let loc_names = locs.map((loc: GraphLocation): string => loc.name);
    let world = <World>graph.worlds[0];
    let ents = world.get_entrances();

    for (const loc of locs) {
        if (Object.keys(ldata).includes(loc.name)) {
            if (!(ldata[loc.name].visited)) {
                if (loc.item === null && locationFilter(loc)) {
                    console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere}, invalid item`);
                } else if (loc.item !== null && locationFilter(loc)) {
                    console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere},${!!loc.item.player ? ' Player '.concat(loc.item.player.toString()) : ''} ${loc.item.name}`);
                }
                // See above note on why events get filtered.
                if (locationFilter(loc)) {
                    success = false;
                }
            } else if (ldata[loc.name].visited) {
                //console.log(`Matching JS location ${loc.name}`);
            }
        } else if (locationFilter(loc)) {
            // See above note on why events get filtered.
            console.log(`Non-existent JS location ${loc.name}`);
            success = false;
        }
    }
    console.log('Finished JS comparison');
    let meta;
    let python_locations = Object.keys(ldata).filter((l) => ldata[l].visited).sort((a, b) => ldata[a].sphere - ldata[b].sphere);
    for (let l of python_locations) {
        meta = ldata[l];
        if (!(loc_names.includes(l)) && !(meta.type.startsWith('Hint'))) {
            if (meta.visited) {
                console.log(`Missing visited location ${l}, sphere ${meta.sphere}, ${meta.item_name}`);
                if (ldata[l].type !== 'Event') {
                    success = false;
                }
            }
        } else if (!(meta.visited)) {
            // no need for event filtering as JS will always have at least as many event subrules in each region as python
            console.log(`Non-existent python location ${l}`);
            success = false;
        }
    }
    console.log('Finished python comparison');

    if (Object.keys(data).includes('entrance_spheres')) {
        let pyents = Object.keys(data.entrance_spheres).flatMap((sphere) => Object.keys(data.entrance_spheres[sphere]));
        let custom_entrances = [
            'Ganons Castle Tower -> Ganons Castle Main',
            'Ganons Castle Tower -> Ganons Castle Lobby',
        ];
        for (const ent of ents) {
            if (!(pyents.includes(ent.name)) && ent.sphere >= 0 && !(custom_entrances.includes(ent.name))) {
                console.log(`Extra entrance: ${ent.name}`);
                success = false;
            }
        }
        for (let e of pyents) {
            let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
            if (ent === undefined){
                console.log(`Missing entrance: ${e}`);
                success = false;
            } else if (ent.sphere === -1) {
                console.log(`Missing entrance: ${e}`);
                success = false;
            }
        }

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        for (let [sphere, sphere_entrance] of Object.entries(edata)) {
            let nsphere = parseInt(sphere);
            for (let e of Object.keys(sphere_entrance)) {
                let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                if (ent === undefined){
                    console.log(`Missing entrance in python spheres not found in JS: ${e} in python sphere ${nsphere}`);
                    success = false;
                } else if (ent.sphere !== nsphere) {
                    console.log(`Entrance sphere mismatch: ${e} in python sphere ${nsphere} and JS sphere ${ent.sphere}`);
                    success = false;
                }
            }
            // out of order spheres will affect later spheres,
            // so skip them if a problem was found in this sphere.
            if (!success) {
                break;
            }
        }
    }
    if (Object.keys(data).includes('spheres')) {
        // Only do location sphere comparison if searched locations and entrance spheres match
        if (success) {
            let sdata = data.spheres;
            for (let [sphere, sphere_locs] of Object.entries(sdata)) {
                let nsphere = parseInt(sphere);
                for (let l of Object.keys(sphere_locs)) {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    // Subrule numbering between python and js can differ, rely on real locations being out of order
                    if (loc === undefined && ldata[l].type !== 'Event' && !(ldata[l].type.startsWith('Hint'))){
                        console.log(`Location in python spheres not found in JS: ${l} in python sphere ${nsphere}`);
                        success = false;
                    } else if (loc === undefined && ldata[l].type === 'Event' || ldata[l].type.startsWith('Hint')) {
                        continue;
                    } else if (loc.sphere !== nsphere && loc.type !== 'Event' && !(ldata[l].type.startsWith('Hint'))) {
                        console.log(`Location sphere mismatch: ${l} in python sphere ${nsphere} and JS sphere ${loc.sphere}`);
                        success = false;
                    }
                }
                // out of order spheres will affect later spheres,
                // so skip them if a problem was found in this sphere.
                if (!success) {
                    break;
                }
            }
        }
    }
    console.log('Finished sphere comparison');

    return success;
}