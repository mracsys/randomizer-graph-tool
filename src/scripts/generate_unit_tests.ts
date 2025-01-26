import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { WorldGraphRemoteFactory } from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphEntrance, GraphLocation, GraphPlugin } from '../plugins/GraphPlugin.js';
import { locationFilter } from '../plugins/ootr-latest/Utils.js';
import { Location } from '../plugins/ootr-latest/Location.js';
import Entrance from '../plugins/ootr-latest/Entrance.js';
import World from '../plugins/ootr-latest/World.js';

export type PythonData = {
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

// local paths to RSL script and OOTR for generating/validating world searches
var rsl = '/Users/mracsys/git/plando-random-settings';
var rando = '/Users/mracsys/git/OoT-Randomizer-Fork';

export async function test_random_settings(max_seeds: number = 1, legacy_sphere_gen: boolean = false) {
    let [version, local_files, seed_path, spoiler_path] = get_plando_randomizer_version({
        ':version': '8.2.50 Fenhl-1'
    });
    let files;
    files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    if (files.length > 0) {
        console.log('Re-testing failed random spoilers');
        for (let f of files) {
            console.log(`Testing ${f}`);
            if (!(await test_specific_random_settings({f: f, legacy_sphere_gen: legacy_sphere_gen, sphere_dir: resolve(rsl, 'patches'), seed_dir: seed_path, spoiler_dir: spoiler_path}))) {
                console.log('Problem detected, stopping random seed generation');
                return;
            }
        }
    }
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

        save_python_output_as_unit_test(plando, graph, data, success, seed_path, spoiler_path);

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

async function test_specific_random_settings({f = '', legacy_sphere_gen = false, sphere_dir = '', seed_dir = '', spoiler_dir = ''}: {f?: string, legacy_sphere_gen?: boolean, sphere_dir?: string, seed_dir?: string, spoiler_dir?: string} = {}) {
    let plando_input: string;
    if (f === '') {
        let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
        plando_input = files[0];
    } else {
        plando_input = f;
    }
    let [plando, graph, data, success] = await test_settings(resolve(rsl, 'patches', plando_input), {export_spheres: true, legacy_sphere_gen: legacy_sphere_gen, sphere_dir: sphere_dir});
    save_python_output_as_unit_test(plando, graph, data, success, seed_dir, spoiler_dir);
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

export async function test_settings(plando_file: string, {export_spheres = false, legacy_sphere_gen = false, sphere_dir = ''}: {export_spheres?: boolean, legacy_sphere_gen?: boolean, sphere_dir?: string} = {}) {
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

export function get_plando_randomizer_version(plando: {[key: string]: any}): [string, string, string, string] {
    let version: string;
    let local_files: string;
    let seed_path: string;
    let spoiler_path: string;
    if (Object.keys(plando).includes(':version')) {
        version = plando[':version'];
        switch (version) {
            case '7.1.117 f.LUM':
                local_files = 'tests/ootr-local-117';
                seed_path = './tests/seeds/main/';
                spoiler_path = './tests/spoilers/main/';
                break;
            case '7.1.143 f.LUM':
                local_files = 'tests/ootr-local-143';
                seed_path = './tests/seeds/main/';
                spoiler_path = './tests/spoilers/main/';
                break;
            case '8.2.0 Release':
                local_files = 'tests/ootr-local-8-2-0';
                seed_path = './tests/seeds/main-8-2/';
                spoiler_path = './tests/spoilers/main-8-2/';
                break;
            case '7.1.198 R-1':
            case '7.1.195 R-1':
                local_files = 'tests/ootr-local-roman-195';
                seed_path = './tests/seeds/roman/';
                spoiler_path = './tests/spoilers/roman/';
                break;
            case '7.1.198 Rob-49':
                local_files = 'tests/ootr-local-realrob-198';
                seed_path = './tests/seeds/realrob/';
                spoiler_path = './tests/spoilers/realrob/';
                break;
            case '8.1.29 Rob-104':
                local_files = 'tests/ootr-local-realrob-8-1-29-104';
                seed_path = './tests/seeds/realrob-8/';
                spoiler_path = './tests/spoilers/realrob-8/';
                break;
            case '8.1.81 Rob-117':
                local_files = 'tests/ootr-local-realrob-8-1-81-117';
                seed_path = './tests/seeds/realrob-8-1/';
                spoiler_path = './tests/spoilers/realrob-8-1/';
                break;
            case '8.2.46 Rob-124':
                local_files = 'tests/ootr-local-realrob-8-2-46-124';
                seed_path = './tests/seeds/realrob-8-2/';
                spoiler_path = './tests/spoilers/realrob-8-2/';
                break;
            case '8.1.45 Fenhl-3':
                local_files = 'tests/ootr-local-fenhl-8-1-45-3';
                seed_path = './tests/seeds/fenhl/';
                spoiler_path = './tests/spoilers/fenhl/';
                break;
            case '8.1.51 Fenhl-1':
                local_files = 'tests/ootr-local-fenhl-8-1-45-3';
                seed_path = './tests/seeds/fenhl/';
                spoiler_path = './tests/spoilers/fenhl/';
                break;
            case '8.2.50 Fenhl-1':
                local_files = 'tests/ootr-local-fenhl-8-2-50-1';
                seed_path = './tests/seeds/fenhl-8-2-50-1/';
                spoiler_path = './tests/spoilers/fenhl-8-2-50-1/';
                break;
            default:
                throw(`Unknown version for local testing: ${version}`);
        }
    } else {
        // used by random settings generator for bulk plando generation
        version = '';
        local_files = '';
        seed_path = '';
        spoiler_path = '';
        //version = '8.1.29 Rob-104';
        //local_files = 'tests/ootr-local-realrob-8-1-29-104';
        //version = '8.1.45 Fenhl-3';
        //local_files = 'tests/ootr-local-fenhl-8-1-45-3';
    }
    return [version, local_files, seed_path, spoiler_path];
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

export function compare_js_to_python(graph: GraphPlugin, data: PythonData) {
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
        let extra_python_entrances = [
            "Dodongos Cavern Back Side Room -> Dodongos Cavern Beginning",
        ];
        for (let e of pyents) {
            if (extra_python_entrances.includes(e)) {
                continue;
            }
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
                if (extra_python_entrances.includes(e)) {
                    continue;
                }
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

export function save_python_output_as_unit_test(plando: {[key: string]: any}, graph: GraphPlugin, data: PythonData, success: boolean, seedPath: string, spoilerPath: string) {
    let sorted_data = sort_spheres(data);
    if (success) {
        let seed_string = plando[':seed'];
        writeFileSync(resolve(seedPath, `python_plando_${seed_string}.json`), JSON.stringify(plando, null, 4), 'utf-8');
        writeFileSync(resolve(spoilerPath, `python_spheres_${seed_string}.json`), JSON.stringify(sorted_data, null, 4), 'utf-8');
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