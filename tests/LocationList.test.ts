import OotrFileCache from "../src/plugins/ootr-latest/OotrFileCache";
import OotrGraphPlugin from "../src/plugins/ootr-latest/OotrGraphPlugin";
import { describe, expect, test, beforeAll } from "@jest/globals";

let test_version: string;
let _cache: OotrFileCache;

describe('OOTR 7.1.143', () => {
    beforeAll(async () => {
        test_version = '7.1.143';
        _cache = await OotrFileCache.load_ootr_files(test_version);
    });
    
    test('total non-event locations match the randomizer', async () => {
        // 1348 non-event locations in OOTR 7.1.143, including the Gift from Sages pseudo-location.
        // Gift from Sages is filtered out by the plugin, so test for 1347.
        let full_graph = await OotrGraphPlugin.create_graph({}, test_version, _cache, false, false);
        expect(full_graph.get_locations_for_world(full_graph.worlds[0]).length).toEqual(1347);
    })
});

describe('OOTR 7.1.117', () => {
    beforeAll(async () => {
        test_version = '7.1.117';
        _cache = await OotrFileCache.load_ootr_files(test_version);
    });
    
    test('total non-event locations match the randomizer', async () => {
        // 1348 non-event locations in OOTR 7.1.143, including the Gift from Sages pseudo-location.
        // Gift from Sages is filtered out by the plugin, so test for 1347.
        let full_graph = await OotrGraphPlugin.create_graph({}, test_version, _cache, false, false);
        expect(full_graph.get_locations_for_world(full_graph.worlds[0]).length).toEqual(1347);
    })
});


// test total progression locations against spoiler set

// test total visited locations against spoiler set

// test location spheres against spoiler set