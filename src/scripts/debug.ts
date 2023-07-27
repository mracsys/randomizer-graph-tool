import { hrtime } from 'node:process';
import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import WorldGraphFactory from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphLocation, GraphPlugin } from '../plugins/GraphPlugin.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';

//test_specific_random_settings();
test_random_settings(1000, true);
//test_spoiler();

async function test_spoiler() {
    await test_settings(resolve(__dirname, 'test', 'seed143.json'));
}

async function test_specific_random_settings() {
    let rsl = '/home/mracsys/git/plando-random-settings';
    let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    await test_settings(resolve(rsl, 'patches', files[0]), true);
}

async function test_settings(plando_file: string, export_spheres: boolean = false) {
    let plando = JSON.parse(readFileSync(plando_file, 'utf-8'));
    plando[':collect'] = 'spheres';
    delete plando.item_pool;
    if (plando.settings.hint_dist === 'custom') {
        delete plando.settings.hint_dist;
    }
    var pythonGraph = spawnSync('python3', ['/home/mracsys/git/OoT-Randomizer-Fork/LogicAPI.py'], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
    var data = read_python_stdout(pythonGraph);

    if (export_spheres) {
        writeFileSync('./python_spheres.json', JSON.stringify(data.spheres, null, 4), 'utf-8');
    }

    let global_cache = await OotrFileCache.load_ootr_files('7.1.143', true);
    let graph = await WorldGraphFactory('ootr', plando, '7.1.143', global_cache);
    graph.collect_spheres();

    compare_js_to_python(graph, data);
}

async function test_random_settings(max_seeds: number = 1, local_files: boolean = false) {
    var rsl = '/home/mracsys/git/plando-random-settings';
    var rsl_output, pythonGraph, data, files, plando, graph;
    files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    if (files.length > 0) {
        for (let f of files) {
            unlinkSync(resolve(rsl, 'patches', f));
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
        pythonGraph = spawnSync('python3', ['/home/mracsys/git/OoT-Randomizer-Fork/LogicAPI.py'], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
        data = read_python_stdout(pythonGraph);

        console.log('Running JS search')
        graph = await WorldGraphFactory('ootr', plando, '7.1.143', global_cache);
        graph.collect_spheres();

        let success = compare_js_to_python(graph, data);

        if (success) {
            unlinkSync(resolve(rsl, 'patches', files[0]));
        } else {
            writeFileSync('./python_spheres.json', JSON.stringify(data.spheres, null, 4), 'utf-8');
            console.log('Problem detected, stopping random seed generation')
            // stop looping to allow re-testing the failed plando
            break;
        }
    }
}

type PythonData = {
    locations: PythonLocation,
    spheres: PythonSphere,
};
type PythonLocation = {
    [location_name: string]: {
        name: string,
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
    let world0 = graph.worlds[0];
    console.log(`${graph.get_visited_locations().length} visited JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited).length} visited python locations`);

    let success = graph.get_visited_locations().length === Object.keys(ldata).filter((l) => ldata[l].visited).length;
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
                success = false;
            } else if (ldata[loc.name].visited) {
                //console.log(`Matching JS location ${loc.name}`);
            }
        } else {
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
                success = false;
            }
        } else if (!(meta.visited)) {
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
                if (loc.sphere !== nsphere) {
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

    //console.log(`Visited locations: ${[...graph.search._cache.visited_locations].map((l) => '\n' + l.name)}`);
    //console.log(`Python locations: ${Object.keys(data).filter((l) => data[l].visited).map((l) => '\n' + l)}`);

    return success;
}

function benchmark_graph(graph: OotrGraphPlugin) {
    for (const l of graph.worlds[0].get_locations()) {
        if (l.world === null) throw `World not defined for location ${l.name}`;
        console.log(`name: ${l.name}, rule_string: ${l.rule_string}, transformed_rule: ${l.transformed_rule}`);
        console.log(`child_access_rule: ${l.access_rule(l.world.state, {spot: l, age: 'child'})}`);
        console.log(`adult_access_rule: ${l.access_rule(l.world.state, {spot: l, age: 'adult'})}`);
    }

    for (const e of graph.worlds[0].get_entrances()) {
        if (e.world === null) throw `World not defined for entrance ${e.name}`;
        console.log(`name: ${e.name}, rule_string: ${e.rule_string}, transformed_rule: ${e.transformed_rule}`);
        console.log(`child_access_rule: ${e.access_rule(e.world.state, {spot: e, age: 'child'})}`);
        console.log(`adult_access_rule: ${e.access_rule(e.world.state, {spot: e, age: 'adult'})}`);
    }

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

    console.log(`${Number(end - start) / 1000000000.0}`);
    console.log('done creating graph');
}