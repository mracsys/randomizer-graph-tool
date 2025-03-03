import World from "../src/plugins/ootr-latest/World";
import { ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphEntrance, GraphLocation, GraphPlugin } from "../src/WorldGraph";
import { locationFilter } from "../src/plugins/ootr-latest/Utils.js";
import { describe, expect, test, beforeAll } from "@jest/globals";
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'path';

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
    [sphere: string]: {
        [location_name: string]: string,
    }
};

const extra_python_entrances = [
    "Dodongos Cavern Back Side Room -> Dodongos Cavern Beginning",
];


describe('OOTR 8.2.0 Release world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/main-8-2'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.2.0 Release';
        let local_files = 'tests/ootr-local-8-2-0';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match 8.2 stable', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/main-8-2', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/main-8-2', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 7.1.195 R-1 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/roman'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '7.1.195 R-1';
        let local_files = 'tests/ootr-local-roman-195';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match Roman971\'s branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/roman', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/roman', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 7.1.198 Rob-49 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/realrob'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '7.1.198 Rob-49';
        let local_files = 'tests/ootr-local-realrob-198';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match RealRob\'s branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/realrob', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/realrob', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 8.1.29 Rob-104 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/realrob-8'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.1.29 Rob-104';
        let local_files = 'tests/ootr-local-realrob-8-1-29-104';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match RealRob\'s 8.1.29 branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/realrob-8', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/realrob-8', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 8.1.81 Rob-117 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/realrob-8-1'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.1.81 Rob-117';
        let local_files = 'tests/ootr-local-realrob-8-1-81-117';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match RealRob\'s 8.1.81 branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/realrob-8-1', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/realrob-8-1', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 8.2.46 Rob-124 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/realrob-8-2'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.2.46 Rob-124';
        let local_files = 'tests/ootr-local-realrob-8-2-46-124';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match RealRob\'s 8.2 branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/realrob-8-2', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/realrob-8-2', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 8.1.45 Fenhl-3 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/fenhl'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.1.45 Fenhl-3';
        let local_files = 'tests/ootr-local-fenhl-8-1-45-3';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match Fenhl\'s branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/fenhl', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/fenhl', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 8.2.50 Fenhl-1 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers/fenhl-8-2-50-1'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '8.2.50 Fenhl-1';
        let local_files = 'tests/ootr-local-fenhl-8-2-50-1';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match Fenhl\'s 8.2.50 branch', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers/fenhl-8-2-50-1', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds/fenhl-8-2-50-1', `python_plando_${seed}`), { encoding: 'utf8'}));
        graph.import(plando);
        graph.collect_spheres();

        let ldata = data.locations;            
        // All locations visited by the randomizer should be visited by our graph
        // In-place logic settings replacement is removed from the rule parser,
        // which causes some always/never events to no longer be always/never, so
        // they can show up as extra collected locations.
        expect(graph.get_visited_locations().length)
            .toBeGreaterThanOrEqual(Object.keys(ldata).filter((l) => ldata[l].visited).length);
        // Filter out extra event items to verify regular item locations match.
        // Testing enough seeds will hopefully show any actual locations affected by extra events.
        expect(graph.get_visited_locations().filter(locationFilter).length)
            .toEqual(Object.keys(ldata).filter((l) => ldata[l].visited && ldata[l].type !== 'Event').length)

        let locs = graph.get_visited_locations();
        let world = <World>graph.worlds[0];
        let ents = world.get_entrances();

        // entrance spheres more impactful than locations, so check first
        let edata = data.entrance_spheres;
        if (!!edata) {
            for (let [sphere, sphere_entrance] of Object.entries(edata)) {
                let nsphere = parseInt(sphere);
                for (let e of Object.keys(sphere_entrance)) {
                    if (extra_python_entrances.includes(e)) {
                        continue;
                    }
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ because js does not evaluate settings
                // at compile time. The main randomizer does this to reduce rule complexity and increase
                // search speed, leading to some events that are always true/false and thus not needed for the
                // parent rule. Only check real locations being out of order.
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});