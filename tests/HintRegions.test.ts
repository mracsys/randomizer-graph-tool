import OotrFileCache from "../src/plugins/ootr-latest/OotrFileCache";
import OotrGraphPlugin from "../src/plugins/ootr-latest/OotrGraphPlugin";
import { describe, expect, test, beforeAll } from "@jest/globals";

let test_version: string;
let _cache: OotrFileCache;
let full_graph: OotrGraphPlugin;
let hint_regions: string[];

describe('OOTR 7.1.143', () => {
    beforeAll(async () => {
        test_version = '7.1.143';
        _cache = await OotrFileCache.load_ootr_files(test_version, { local_files: 'tests/ootr-local-143' });
        full_graph = await OotrGraphPlugin.create_graph({}, test_version, _cache, false, false);
        hint_regions = full_graph.get_hint_regions();
    });

    //`hint region '${hint_region}'`
    test('hint regions match a region group, subgroup, or interior name', async () => {
        for (let hint_region of hint_regions) {
            expect(
                full_graph.worlds[0].region_groups.filter(r => r.alias === hint_region).length +
                full_graph.worlds[0].region_groups.flatMap(r => r.sub_groups).filter(r => r.alias === hint_region).length +
                full_graph.worlds[0].regions.flatMap(r => r.exits).filter(e => e.alias === hint_region).length
            ).toBeGreaterThan(0);
        }
    })
});