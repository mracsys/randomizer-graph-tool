import OotrFileCache from "../src/plugins/ootr-latest/OotrFileCache";
import OotrGraphPlugin from "../src/plugins/ootr-latest/OotrGraphPlugin";
import { expect, test, beforeEach } from "@jest/globals";

let test_version: string;

beforeEach(async () => {
    test_version = '7.1.143';
});

test('local randomizer file cache can be read', async () => {
    // 1348 non-event locations in OOTR 7.1.143, including the Gift from Sages pseudo-location.
    // Gift from Sages is filtered out by the plugin, so test for 1347.
    let _cache = await OotrFileCache.load_ootr_files(test_version, true);
    expect(Object.keys(_cache.files).length).toEqual(59);
});

// test total progression locations against spoiler set

// test total visited locations against spoiler set

// test location spheres against spoiler set