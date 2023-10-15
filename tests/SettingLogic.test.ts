import { ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphPlugin } from "../src/WorldGraph";
import { describe, expect, test, beforeAll } from "@jest/globals";

describe('OOTR 7.1.143 world mutation', () => {

    let graph: GraphPlugin;
    beforeAll(async () => {
        let version = '7.1.143 f.LUM';
        let local_files = 'tests/ootr-local-143';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
    });

    test('settings are set to default values when disabled', async () => {
        let settings = graph.get_settings_options();
        let ganon_bosskey = settings['shuffle_ganon_bosskey'];
        let triforce_hunt = settings['triforce_hunt'];
        graph.change_setting(graph.worlds[0], triforce_hunt, true);
        expect(graph.worlds[0].settings['shuffle_ganon_bosskey']).toEqual(ganon_bosskey.disabled_default);
    });
});