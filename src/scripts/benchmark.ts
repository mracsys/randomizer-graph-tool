import { hrtime } from 'node:process';
import { WorldGraphRemoteFactory, ExternalFileCacheFactory } from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphPlugin } from '../plugins/GraphPlugin.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

benchmark_compilation();

async function benchmark() {
    let global_cache = await OotrFileCache.load_ootr_files('7.1.143', { local_files: 'tests/ootr-local-143' });
    console.log(`Creat Rules   Search`);
    for (let i=0; i<10; i++) {
        let start = hrtime.bigint();
        let graph = await WorldGraphRemoteFactory('ootr', {}, '7.1.143', global_cache);
        let end = hrtime.bigint();

        let created = Number(end - start) / 1000000000.0;

        let ruled = benchmark_graph(graph);

        start = hrtime.bigint();
        graph.collect_locations();
        end = hrtime.bigint();

        let searched = Number(end - start) / 1000000000.0;

        console.log(`${created.toFixed(3)} ${ruled.toFixed(5)} ${searched.toFixed(6)}`);
    }
}

function benchmark_graph(plugin: GraphPlugin): Number {
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

    return Number(end - start) / 1000000000.0;
}

async function benchmark_mutation() {
    let python_results = readdirSync(resolve('tests/spoilers'));

    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    let graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    for (let result_file of python_results) {
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', `python_plando_${seed}`), { encoding: 'utf8'}));
        let start = hrtime.bigint();
        graph.import(plando);
        let end = hrtime.bigint();
        let search_start = hrtime.bigint();
        graph.collect_spheres();
        let search_end = hrtime.bigint();
        let imported = Number(end - start) / 1000000000.0
        let searched = Number(search_end - search_start) / 1000000000.0;
        console.log(`${imported.toFixed(6)} ${searched.toFixed(6)}`);
    }
}


async function benchmark_compilation() {
    let python_results = [
        'python_spheres_0BB3R39F94.json',
        'python_spheres_ZZN0FWVENF.json'
    ];

    let version = '7.1.143 f.LUM';
    let local_files = 'tests/ootr-local-143';
    let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
    for (let result_file of python_results) {
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', `python_plando_${seed}`), { encoding: 'utf8'}));
        let start = hrtime.bigint();
        let graph = await WorldGraphRemoteFactory('ootr', plando, version, global_cache);
        let end = hrtime.bigint();
        let search_start = hrtime.bigint();
        graph.collect_spheres();
        let search_end = hrtime.bigint();
        let imported = Number(end - start) / 1000000000.0
        let searched = Number(search_end - search_start) / 1000000000.0;
        console.log(`${imported.toFixed(6)} ${searched.toFixed(6)}`);
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
            default:
                local_files = 'tests/ootr-local-143';
        }
    } else {
        version = '7.1.143';
        local_files = 'tests/ootr-local-143';
    }
    return [version, local_files];
}
