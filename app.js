const WorldGraph = require('./WorldGraph.js');
const { hrtime } = require('node:process');
const { spawnSync } = require('child_process');
const { readFileSync, readdirSync, unlinkSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const OotrVersion = require('./OotrVersion.js');

//test_specific_random_settings();
test_random_settings(1000);
//test_spoiler();

function test_spoiler() {
    test_settings(resolve(__dirname, 'test', 'seed143.json'));
}

function test_specific_random_settings() {
    let rsl = '/home/mracsys/git/plando-random-settings';
    let files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    test_settings(resolve(rsl, 'patches', files[0]), true);
}

function test_settings(plando_file, export_spheres=false) {
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

    let graph = new WorldGraph(plando, new OotrVersion('7.1.143'));
    graph.search.collect_spheres();

    success = compare_js_to_python(graph, data);
}

function test_random_settings(max_seeds=1) {
    var rsl = '/home/mracsys/git/plando-random-settings';
    var rsl_output, pythonGraph, data, files, plando, graph;
    files = readdirSync(resolve(rsl, 'patches')).filter(fn => fn.endsWith('_Spoiler.json'));
    if (files.length > 0) {
        for (let f of files) {
            unlinkSync(resolve(rsl, 'patches', f));
        }
    }
    for (let i = 0; i < max_seeds; i++) {
        console.log(`Testing seed ${i + 1} of ${max_seeds}`)
        console.log('Running python search')
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
        graph = new WorldGraph(plando, new OotrVersion('7.1.143'));
        graph.search.collect_spheres();

        success = compare_js_to_python(graph, data);

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

function read_python_stdout(pythonGraph) {
    try {
        var data = JSON.parse(pythonGraph.stdout);
    } catch (error) {
        if (pythonGraph.strerr !== '') {
            console.log(pythonGraph.stderr);
        } else {
            console.log(pythonGraph.stdout.split('\n')[0]);
        }
        throw(error);
    }
    return data;
}

function compare_js_to_python(graph, data) {
    let ldata = data.locations;
    console.log(`${graph.search._cache.visited_locations.size} visited JS locations`);
    console.log(`${Object.keys(ldata).filter((l) => ldata[l].visited).length} visited python locations`);

    let success = graph.search._cache.visited_locations.size === Object.keys(ldata).filter((l) => ldata[l].visited).length;
    let locs = graph.worlds[0].get_locations();
    let loc_names = locs.map((loc) => loc.name);

    for (const loc of graph.search._cache.visited_locations) {
        if (Object.keys(ldata).includes(loc.name)) {
            if (graph.search.visited(loc) && !(ldata[loc.name].visited)) {
                console.log(`Extra visited location ${loc.name}, sphere ${loc.sphere}, Player ${loc.item.world.id + 1} ${loc.item.name}`);
                success = false;
            } else if (graph.search.visited(loc) && ldata[loc.name].visited) {
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