const WorldGraph = require('./WorldGraph.js');
const { hrtime } = require('node:process');
const { spawnSync } = require('child_process');
const { readFileSync, readdirSync, unlinkSync } = require('fs');
const { resolve } = require('path');
const OotrVersion = require('./OotrVersion.js');

test_specific_random_settings();
//test_random_settings();
//test_spoiler();

function test_spoiler() {
    test_settings(resolve(__dirname, 'test', 'seed143.json'));
}

function test_specific_random_settings() {
    let rsl = '/home/mracsys/git/plando-random-settings';
    let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    test_settings(resolve(rsl, 'patches', files[0]));
}

function test_settings(plando_file) {
    let plando = JSON.parse(readFileSync(plando_file, 'utf-8'));
    plando[':collect'] = 'spheres';
    delete plando.item_pool;
    if (plando.settings.hint_dist === 'custom') {
        delete plando.settings.hint_dist;
    }
    var pythonGraph = spawnSync('python3', ['/home/mracsys/git/OoT-Randomizer-Fork/LogicAPI.py'], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });
    var data;
    try {
        data = JSON.parse(pythonGraph.stdout);
    } catch (error) {
        if (pythonGraph.strerr !== '') {
            console.log(pythonGraph.stderr);
        } else {
            console.log(pythonGraph.stdout.split('\n')[0]);
        }
        throw(error);
    }

    let graph = new WorldGraph(plando, new OotrVersion('7.1.143'));

    graph.search.collect_spheres();

    success = compare_js_to_python(graph, data);
}

function test_random_settings() {
    var rsl = '/home/mracsys/git/plando-random-settings';
    var pythonGraph, data, files, plando, graph;
    for (let i = 0; i < 1000; i++) {
        pythonGraph = spawnSync('python3', [resolve(rsl, 'RandomSettingsGenerator.py'), '--test_javascript'], { cwd: rsl, encoding: 'utf8', maxBuffer: 10240 * 1024 });
        try {
            data = JSON.parse(pythonGraph.stdout);
        } catch (error) {
            if (pythonGraph.strerr !== '') {
                console.log(pythonGraph.stderr);
            } else {
                console.log(pythonGraph.stdout.split('\n')[0]);
            }
            throw(error);
        }

        files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
        if (files.length < 1) {
            throw('Generator Error: no spoiler to load');
        } else if (files.length > 1) {
            throw('Generator Error: more than one spoiler to load');
        }

        plando = JSON.parse(readFileSync(resolve(rsl, 'patches', files[0]), 'utf-8'));
        plando[':collect'] = 'spheres';

        graph = new WorldGraph(plando, new OotrVersion('7.1.143'));

        graph.search.collect_spheres();

        success = compare_js_to_python(graph, data);

        if (success) {
            unlinkSync(resolve(rsl, 'patches', files[0]));
        } else {
            // stop looping to allow re-testing the failed plando
            break;
        }
    }
}

function compare_js_to_python(graph, data) {
    console.log(`${graph.search._cache.visited_locations.size} visited JS locations`);
    console.log(`${Object.keys(data).filter((l) => data[l].visited).length} visited python locations`);

    let success = graph.search._cache.visited_locations.size === Object.keys(data).filter((l) => data[l].visited).length;
    let locs = graph.worlds[0].get_locations();
    let loc_names = locs.map((loc) => loc.name);

    for (const loc of graph.search._cache.visited_locations) {
        if (Object.keys(data).includes(loc.name)) {
            if (graph.search.visited(loc) && !(data[loc.name].visited)) {
                console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere}, Player ${loc.item.world.id + 1} ${loc.item.name}`);
                success = false;
            } else if (graph.search.visited(loc) && data[loc.name].visited) {
                //console.log(`Matching JS location ${loc.name}`);
            }
        } else {
            console.log(`Non-existent JS location ${loc.name}`);
            success = false;
        }
    }
    console.log('Finished JS comparison');
    let meta;
    let python_locations = Object.keys(data).filter((l) => data[l].visited).sort((a, b) => data[a].sphere - data[b].sphere);
    for (let l of python_locations) {
        meta = data[l];
        if (loc_names.includes(l)) {
            if (!(graph.search.visited(locs.filter((loc) => loc.name === l)[0])) && meta.visited) {
                console.log(`Missing visited location ${l}, sphere ${meta.sphere}, ${meta.item_name}`);
                success = false;
            } else if (graph.search.visited(locs.filter((loc) => loc.name === l)[0]) && meta.visited) {
                //console.log(`Matching python location ${l}`);
            }
        } else {
            console.log(`Non-existent python location ${l}`);
            success = false;
        }
    }
    console.log('Finished python comparison');

    //console.log(`Visited locations: ${[...graph.search._cache.visited_locations].map((l) => '\n' + l.name)}`);
    //console.log(`Python locations: ${Object.keys(data).filter((l) => data[l].visited).map((l) => '\n' + l)}`);

    return success;
}

function benchmark_graph(graph) {
    for (const l of graph.worlds[0].get_locations()) {
        console.log(`name: ${l.name}, rule_string: ${l.rule_string}, transformed_rule: ${l.transformed_rule}`);
        console.log(`child_access_rule: ${l.access_rule(l.world.state, {spot: l, age: 'child'})}`);
        console.log(`adult_access_rule: ${l.access_rule(l.world.state, {spot: l, age: 'adult'})}`);
    }

    for (const e of graph.worlds[0].get_entrances()) {
        console.log(`name: ${e.name}, rule_string: ${e.rule_string}, transformed_rule: ${e.transformed_rule}`);
        console.log(`child_access_rule: ${e.access_rule(e.world.state, {spot: e, age: 'child'})}`);
        console.log(`adult_access_rule: ${e.access_rule(e.world.state, {spot: e, age: 'adult'})}`);
    }

    let child_access, adult_access;

    const start = hrtime.bigint();
    for (const l of graph.worlds[0].get_locations()) {
        child_access = l.access_rule(l.world.state, {spot: l, age: 'child'});
        adult_access = l.access_rule(l.world.state, {spot: l, age: 'adult'});
    }
    for (const e of graph.worlds[0].get_entrances()) {
        child_access = e.access_rule(e.world.state, {spot: e, age: 'child'});
        adult_access = e.access_rule(e.world.state, {spot: e, age: 'adult'});
    }
    const end = hrtime.bigint();

    console.log(`${Number(end - start) / 1000000000.0}`);
    console.log('done creating graph');
}