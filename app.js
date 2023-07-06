const WorldGraph = require('./WorldGraph.js');
const { hrtime } = require('node:process');
const { spawnSync } = require('child_process');
//const { writeFileSync } = require('fs');
const { readFileSync } = require('fs');
const { resolve } = require('path');

//let plando = {'settings': settings_list};
//writeFileSync('./plando.json', JSON.stringify(plando, null, 4), 'utf-8');

let plando = JSON.parse(readFileSync(resolve(__dirname, 'seedMW.json'), 'utf-8'));
plando[':collect'] = 'all';

let graph = new WorldGraph(plando);
let locs = graph.worlds[0].get_locations();
//let locs = graph.search.progression_locations();
let loc_names = locs.map((loc) => loc.name);

graph.search.collect_locations();

const pythonGraph = spawnSync('python3', ['/home/mracsys/git/OoT-Randomizer-Fork/LogicAPI.py'], { input: JSON.stringify(plando), encoding: 'utf8', maxBuffer: 10240 * 1024 });

const data = JSON.parse(pythonGraph.stdout);
/*
console.log(`${locs.length} JS progressive locations`);
console.log(`${Object.keys(data).length} python progressive locations`);

for (let loc of locs) {
    if (!(Object.keys(data).includes(loc.name))) {
        console.log(`Extra progressive location ${loc.name}`);
    }
}
for (let loc of Object.keys(data)) {
    if (!(loc_names.includes(loc))) {
        console.log(`Missing progressive location ${loc}`);
    }
}

return;
*/
console.log(`${graph.search._cache.visited_locations.size} visited JS locations`);
console.log(`${Object.keys(data).filter((l) => data[l].visited).length} visited python locations`);

for (const loc of graph.search._cache.visited_locations) {
    if (Object.keys(data).includes(loc.name)) {
        if (graph.search.visited(loc) && !(data[loc.name].visited)) {
            console.log(`Extra visited location ${loc.name}`);
        } else if (graph.search.visited(loc) && data[loc.name].visited) {
            //console.log(`Matching JS location ${loc.name}`);
        }
    } else {
        console.log(`Non-existent JS location ${loc.name}`);
    }
}
console.log('Finished JS comparison');
let meta;
for (let l of Object.keys(data).filter((l) => data[l].visited)) {
    meta = data[l];
    if (loc_names.includes(l)) {
        if (!(graph.search.visited(locs.filter((loc) => loc.name === l)[0])) && meta.visited) {
            console.log(`Missing visited location ${l}`);
        } else if (graph.search.visited(locs.filter((loc) => loc.name === l)[0]) && meta.visited) {
            //console.log(`Matching python location ${l}`);
        }
    } else {
        console.log(`Non-existent python location ${l}`);
    }
}
console.log('Finished python comparison');

//console.log(`Visited locations: ${[...graph.search._cache.visited_locations].map((l) => '\n' + l.name)}`);
//console.log(`Python locations: ${Object.keys(data).filter((l) => data[l].visited).map((l) => '\n' + l)}`);

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