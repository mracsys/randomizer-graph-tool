import OotrFileCache from "../src/plugins/ootr-latest/OotrFileCache";
import { expect, test, beforeEach } from "@jest/globals";

let test_version: string;

beforeEach(async () => {
    test_version = '7.1.143';
});

test('local randomizer file cache can be read', async () => {
    let _cache = await OotrFileCache.load_ootr_files(test_version, { local_files: 'tests/ootr-local-143' });
    expect(Object.keys(_cache.files).length).toEqual(60);
});

test('github randomizer file cache can be read', async () => {
    let _cache = await OotrFileCache.load_ootr_files(test_version);
    expect(Object.keys(_cache.files).length).toEqual(60);
}, 30000);