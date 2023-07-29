import { hrtime } from 'node:process';
import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import WorldGraphFactory from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphLocation, GraphPlugin } from '../plugins/GraphPlugin.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';
import { Location } from '../plugins/ootr-latest/Location.js';

var rsl = '/home/mracsys/git/plando-random-settings';
var rando = '/home/mracsys/git/OoT-Randomizer-Fork';

//test_random_settings(1000, true);
benchmark();

async function benchmark() {
    let global_cache = await OotrFileCache.load_ootr_files('7.1.143', true);
    let start = hrtime.bigint();
    let graph = await WorldGraphFactory('ootr', {}, '7.1.143', global_cache);
    let end = hrtime.bigint();

    console.log(`Graph creation time: ${Number(end - start) / 1000000000.0}`);

    benchmark_graph(graph);

    start = hrtime.bigint();
    graph.collect_locations();
    end = hrtime.bigint();

    console.log(`Graph search time: ${Number(end - start) / 1000000000.0}`);
}

async function test_spoiler(convert: boolean = false) {
    let [plando, graph, data, success] = await test_settings(resolve('./tests/seeds', 'seed143.json'));
    if (convert) save_python_output_as_unit_test(plando, graph, data, success);
}

async function test_specific_random_settings(f: string = '') {
    let plando_input: string;
    if (f === '') {
        let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
        plando_input = files[0];
    } else {
        plando_input = f;
    }
    let [plando, graph, data, success] = await test_settings(resolve(rsl, 'patches', plando_input), true);
    save_python_output_as_unit_test(plando, graph, data, success);
    if (success) {
        unlinkSync(resolve(rsl, 'patches', plando_input));
    }
    return success;
}

async function test_settings(plando_file: string, export_spheres: boolean = false) {
    let plando = JSON.parse(readFileSync(plando_file, 'utf-8'));
    plando[':collect'] = 'spheres';
    delete plando.item_pool;
    if (plando.settings.hint_dist === 'custom') {
        delete plando.settings.hint_dist;
    }
    console.log('Running python search');
    var pythonGraph = spawnSync('python3', [resolve(rando, 'LogicAPI.py')], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
    var data = read_python_stdout(pythonGraph);

    if (export_spheres) {
        writeFileSync('./python_spheres.json', JSON.stringify(data.spheres, null, 4), 'utf-8');
    }

    console.log('Running JS search');
    let global_cache = await OotrFileCache.load_ootr_files('7.1.143', true);
    let graph = await WorldGraphFactory('ootr', plando, '7.1.143', global_cache);
    graph.collect_spheres();

    let success = compare_js_to_python(graph, data);
    return [plando, graph, data, success];
}

async function test_random_settings(max_seeds: number = 1, local_files: boolean = false) {
    var rsl_output, pythonGraph, data, files, plando, graph;
    files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    if (files.length > 0) {
        console.log('Re-testing failed random spoilers');
        for (let f of files) {
            console.log(`Testing ${f}`);
            if (!(await test_specific_random_settings(f))) {
                console.log('Problem detected, stopping random seed generation');
                return;
            }
        }
    }

    let global_cache = await OotrFileCache.load_ootr_files('7.1.143', local_files);

    for (let i = 0; i < max_seeds; i++) {
        console.log(`Testing seed ${i + 1} of ${max_seeds}`);
        console.log('Running python search');
        while (true) {
            rsl_output = spawnSync('python3', [resolve(rsl, 'RandomSettingsGenerator.py'), '--test_javascript'], { cwd: rsl, encoding: 'utf8', maxBuffer: 10240 * 1024 });
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

        plando = JSON.parse(readFileSync(resolve(rsl, 'patches', files[0]), 'utf-8'));
        plando[':collect'] = 'spheres';
        delete plando.item_pool;
        if (plando.settings.hint_dist === 'custom') {
            delete plando.settings.hint_dist;
        }
        pythonGraph = spawnSync('python3', [resolve(rando, 'LogicAPI.py')], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
        data = read_python_stdout(pythonGraph);

        console.log('Running JS search');
        graph = await WorldGraphFactory('ootr', plando, '7.1.143', global_cache);
        graph.collect_spheres();

        let success = compare_js_to_python(graph, data);

        save_python_output_as_unit_test(plando, graph, data, success);

        if (success) {
            unlinkSync(resolve(rsl, 'patches', files[0]));
        } else {
            console.log('Problem detected, stopping random seed generation');
            // stop looping to allow re-testing the failed plando
            break;
        }
    }
}

function save_python_output_as_unit_test(plando: {[key: string]: any}, graph: GraphPlugin, data: PythonData, success: boolean) {
    if (success) {
        let seed_string = plando[':seed'];
        writeFileSync(resolve('./tests/seeds/', `python_plando_${seed_string}.json`), JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync(resolve('./tests/spoilers/', `python_spheres_${seed_string}.json`), JSON.stringify(data, null, 4), 'utf-8');
    } else {
        writeFileSync('./python_plando.json', JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync('./python_spheres.json', JSON.stringify(data.spheres, null, 4), 'utf-8');
        writeFileSync('./python_sphere_logic.json', JSON.stringify(data.sphere_logic_rules, null, 4), 'utf-8');
        let locs = graph.get_visited_locations();
        let jsdata: PythonData = {
            locations: {},
            spheres: {},
            sphere_logic_rules: {},
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
        writeFileSync('./js_spheres.json', JSON.stringify(jsdata.spheres, null, 4), 'utf-8');
        writeFileSync('./js_sphere_logic.json', JSON.stringify(jsdata.sphere_logic_rules, null, 4), 'utf-8');
    }
}

type PythonData = {
    locations: PythonLocation,
    spheres: PythonSphere,
    sphere_logic_rules: PythonSphere,
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
    [sphere: string]: {
        [location_name: string]: string,
    }
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
    console.log(`${graph.get_visited_locations().filter((l) => l.type !== 'Event').length} visited non-event JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length} visited non-event python locations`);

    // Filter out extra event items as they usually show up because in-place logic settings replacement is removed,
    // which causes some always/never events to no longer be always/never.
    // Testing enough seeds will hopefully show any actual locations affected by extra events.
    let success = graph.get_visited_locations().filter((l) => l.type !== 'Event').length
                    === Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length;
    let locs = graph.get_visited_locations();
    let loc_names = locs.map((loc: GraphLocation): string => loc.name);

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
        if (!(loc_names.includes(l))) {
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

    // Only do sphere comparison if searched locations match
    if (success && Object.keys(data).includes('spheres')) {
        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                // Subrule numbering between python and js can differ, rely on real locations being out of order
                if (loc === undefined && ldata[l].type !== 'Event'){
                    console.log(`Location in python spheres not found in JS: ${l} in python sphere ${nsphere}`);
                    success = false;
                } else if (loc === undefined && ldata[l].type === 'Event') {
                    continue;
                } else if (loc.sphere !== nsphere && loc.type !== 'Event') {
                    console.log(`Sphere mismatch: ${l} in python sphere ${nsphere} and JS sphere ${loc.sphere}`);
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
    console.log('Finished sphere comparison');

    return success;
}

function benchmark_graph(plugin: GraphPlugin) {
    let graph = <OotrGraphPlugin>plugin;
    let child_access, adult_access;

    const start = hrtime.bigint();
    for (const l of graph.worlds[0].get_locations()) {
        if (l.world === null) throw `World not defined for location ${l.name}`;
        child_access = l.access_rule(l.world.state, {spot: l, age: 'child'});
        adult_access = l.access_rule(l.world.state, {spot: l, age: 'adult'});
    }
    for (const e of graph.worlds[0].get_entrances()) {
        if (e.world === null) throw `World not defined for entrance ${e.name}`;
        child_access = e.access_rule(e.world.state, {spot: e, age: 'child'});
        adult_access = e.access_rule(e.world.state, {spot: e, age: 'adult'});
    }
    const end = hrtime.bigint();

    console.log(`Logic rule pass time: ${Number(end - start) / 1000000000.0}`);
}