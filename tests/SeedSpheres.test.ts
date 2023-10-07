import World from "../src/plugins/ootr-latest/World";
import { ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphEntrance, GraphLocation, GraphPlugin } from "../src/WorldGraph";
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

describe('OOTR 7.1.143 compilation', () => {
    // Only run the compilation tests for a couple seeds as this would take hours.
    // Full logic integration testing is handled in the world mutation tests.
    //let python_results = readdirSync(resolve('tests/spoilers'));
    let python_results = [
        'python_spheres_0BB3R39F94.json',
        'python_spheres_ZZN0FWVENF.json'
    ];
    test.each(python_results)('%s sphere searches match the randomizer', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', `python_plando_${seed}`), { encoding: 'utf8'}));
        let [version, local_files] = get_plando_randomizer_version(plando);
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        let graph = await WorldGraphRemoteFactory('ootr', plando, version, global_cache);
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
        expect(graph.get_visited_locations().filter((l) => l.type !== 'Event').length)
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
                    let ent = ents.filter((entrance: GraphEntrance): boolean => entrance.name === e)[0];
                    expect(ent?.sphere).toEqual(nsphere);
                }
            }
        }

        let sdata = data.spheres;
        for (let [sphere, sphere_locs] of Object.entries(sdata)) {
            let nsphere = parseInt(sphere);
            for (let l of Object.keys(sphere_locs)) {
                // Subrule numbering between python and js can differ, only check real locations being out of order
                if (ldata[l].type !== 'Event') {
                    let loc = locs.filter((location: GraphLocation): boolean => location.name === l)[0];
                    expect(loc?.sphere).toEqual(nsphere);
                }
            }
        }
    });
});


describe('OOTR 7.1.143 world mutation', () => {
    let python_results = readdirSync(resolve('tests/spoilers'));

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '7.1.143 f.LUM';
        let local_files = 'tests/ootr-local-143';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test.each(python_results)('%s sphere searches match the randomizer', async (result_file) => {
        let data: PythonData = JSON.parse(readFileSync(resolve('tests/spoilers', result_file), 'utf-8'));
        let seed = result_file.split('_')[2];
        let plando = JSON.parse(readFileSync(resolve('tests/seeds', `python_plando_${seed}`), { encoding: 'utf8'}));
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
        expect(graph.get_visited_locations().filter((l) => l.type !== 'Event').length)
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

/*
    let settings = graph.get_settings_options();
    graph.change_setting(graph.worlds[0], settings['mq_dungeons_specific'], []);
    graph.change_setting(graph.worlds[0], settings['mq_dungeons_specific'], [
        'Deku Tree',
        'Dodongos Cavern',
        'Jabu Jabus Belly',
        'Bottom of the Well',
        'Ice Cavern',
        'Gerudo Training Ground',
        'Forest Temple',
        'Fire Temple',
        'Water Temple',
        'Spirit Temple',
        'Shadow Temple',
        'Ganons Castle'
    ]);
*/

// test total progression locations against spoiler set

// test total visited locations against spoiler set

// test location spheres against spoiler set