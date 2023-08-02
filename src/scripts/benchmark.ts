import { hrtime } from 'node:process';
import { WorldGraphRemoteFactory } from '..//WorldGraph.js';
import OotrFileCache from '../plugins/ootr-latest/OotrFileCache.js';
import { GraphPlugin } from '../plugins/GraphPlugin.js';
import OotrGraphPlugin from '../plugins/ootr-latest/OotrGraphPlugin.js';

benchmark();

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