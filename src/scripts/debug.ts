import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { WorldGraphRemoteFactory, WorldGraphFactory, ExternalFileCacheFactory } from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphEntrance, GraphLocation, GraphPlugin } from '../plugins/GraphPlugin.js';
import { Location } from '../plugins/ootr-latest/Location.js';
import Entrance from '../plugins/ootr-latest/Entrance.js';
import World from '../plugins/ootr-latest/World.js';

// local paths to RSL script and OOTR for generating/validating world searches
var rsl = '/home/mracsys/git/plando-random-settings';
var rando = '/home/mracsys/git/OoT-Randomizer-Fork';

//test_entrance_pools();
test_import(true);
//test_spoiler(false, true);
//test_remote_files();
//test_random_settings(4, true);
//test_specific_random_settings({legacy_sphere_gen: true, sphere_dir: resolve(rsl, 'patches')});
//add_entrance_spheres_to_tests();

async function test_entrance_pools() {
    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    let settings = graph.get_settings_options();
    let er = settings['shuffle_grotto_entrances'];
    let logic_rules = settings['logic_rules'];
    let triforce_hunt = settings['triforce_hunt'];
    graph.change_setting(graph.worlds[0], triforce_hunt, true);
    let pool = graph.get_entrance_pool(graph.worlds[0], graph.worlds[0].regions[20].exits[3]);
}

async function test_import(debug: boolean = false) {
    let result_file = 'python_spheres_3MSNERF82K.json';

    let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/roman', result_file), 'utf-8'));
    let seed = result_file.split('_')[2];
    let plando = JSON.parse(readFileSync(resolve('tests/seeds/roman', `python_plando_${seed}`), { encoding: 'utf8'}));
    let [version, local_files] = get_plando_randomizer_version(plando);
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);

    graph.import(plando);
    graph.collect_spheres();

    compare_js_to_python(graph, data);

    result_file = 'python_spheres_YC80AE001N.json';
    data = JSON.parse(readFileSync(resolve('tests/spoilers/roman', result_file), 'utf-8'));
    seed = result_file.split('_')[2];
    plando = JSON.parse(readFileSync(resolve('tests/seeds/roman', `python_plando_${seed}`), { encoding: 'utf8'}));
    graph.import(plando);
    graph.collect_spheres();
    compare_js_to_python(graph, data);


    if (debug) save_python_output_as_unit_test(plando, graph, data, false);
}

async function test_remote_files() {
    //let _cache = {files: {}};
    let _cache = await ExternalFileCacheFactory('ootr', '7.1.117');
    let graph = WorldGraphFactory('ootr', {}, '7.1.117', _cache);
    console.log(graph.get_game_versions().versions[0].version);
}

async function test_spoiler(convert: boolean = false, debug: boolean = false) {
    // python_plando_U3CJUBQAKH
    // python_plando_VNTW9E7QFO
    // python_plando_YQQVR7YQ0G
    let [plando, graph, data, success] = await test_settings(resolve('./tests/seeds', 'python_plando_YQQVR7YQ0G.json'), {sphere_dir: './tests/spoilers'});
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
        while (true) {
            let rsl_output = spawnSync('python3', [resolve(rsl, 'RandomSettingsGenerator.py'), '--test_javascript'], { cwd: rsl, encoding: 'utf8', maxBuffer: 10240 * 1024 });
            // restart script if reroll limit exceeded
            if (rsl_output.status === 0) {
                break;
            }
        }
        files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
        if (files.length < 1) {
            throw('Generator Error: no spoiler to load');
        } else if (files.length > 1) {
            throw('Generator Error: more than one spoiler to load');
        }
        let plando = JSON.parse(readFileSync(resolve(rsl, 'patches', files[0]), 'utf-8'));
        plando[':collect'] = 'spheres';
        delete plando.item_pool;
        if (plando.settings.hint_dist === 'custom') {
            delete plando.settings.hint_dist;
        }
        let data;
        if (legacy_sphere_gen) {
            let pythonGraph = spawnSync('python3', [resolve(rando, 'LogicAPI.py')], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
            data = read_python_stdout(pythonGraph);
        } else {
            let seed_string = plando[':seed'];
            data = JSON.parse(readFileSync(resolve(rsl, 'patches', `python_spheres_${seed_string}.json`), 'utf-8'));
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
            case '7.1.195 R-1':
                local_files = 'tests/ootr-local-roman-195';
                break;
            case '7.1.198 Rob-49':
                local_files = 'tests/ootr-local-realrob-198';
                break;
            default:
                throw(`Unknown version for local testing: ${version}`);
        }
    } else {
        // used by random settings generator for bulk plando generation
        version = '7.1.195 R-1';
        local_files = 'tests/ootr-local-roman-195';
    }
    return [version, local_files];
}

function save_python_output_as_unit_test(plando: {[key: string]: any}, graph: GraphPlugin, data: PythonData, success: boolean) {
    let sorted_data = sort_spheres(data);
    if (success) {
        let seed_string = plando[':seed'];
        writeFileSync(resolve('./tests/seeds/roman/', `python_plando_${seed_string}.json`), JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync(resolve('./tests/spoilers/roman/', `python_spheres_${seed_string}.json`), JSON.stringify(sorted_data, null, 4), 'utf-8');
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
            console.log(pythonGraph.stderr);
        } else {
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
    console.log(`${graph.get_visited_locations().filter((l) => l.type !== 'Event' && !(l.type.startsWith('Hint'))).length} visited non-event JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event' && !(ldata[l].type.startsWith('Hint'))).length} visited non-event python locations`);

    // Filter out extra event items as they usually show up because in-place logic settings replacement is removed,
    // which causes some always/never events to no longer be always/never.
    // Testing enough seeds will hopefully show any actual locations affected by extra events.
    let success = graph.get_visited_locations().filter((l) => l.type !== 'Event' && !(l.type.startsWith('Hint'))).length
                    === Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event' && !(ldata[l].type.startsWith('Hint'))).length;
    let locs = graph.get_visited_locations();
    let loc_names = locs.map((loc: GraphLocation): string => loc.name);
    let world = <World>graph.worlds[0];
    let ents = world.get_entrances();

    for (const loc of locs) {
        if (Object.keys(ldata).includes(loc.name)) {
            if (!(ldata[loc.name].visited)) {
                if (loc.item === null) {
                    console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere}, invalid item`);
                } else {
                    console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere},${!!loc.item.player ? ' Player '.concat(loc.item.player.toString()) : ''} ${loc.item.name}`);
                }
                // See above note on why events get filtered.
                if (loc.type !== 'Event') {
                    success = false;
                }
            } else if (ldata[loc.name].visited) {
                //console.log(`Matching JS location ${loc.name}`);
            }
        } else if (loc.type !== 'Event') {
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
        for (const ent of ents) {
            if (!(pyents.includes(ent.name)) && ent.sphere >= 0) {
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