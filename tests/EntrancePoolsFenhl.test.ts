import World from "../src/plugins/ootr-latest/World";
import { ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphEntrance, GraphPlugin } from "../src/WorldGraph";
import { locationFilter } from "../src/plugins/ootr-latest/Utils.js";
import { describe, expect, test, beforeAll } from "@jest/globals";


describe('OOTR 8.1.51 Fenhl-1 entrance pools', () => {
    let graph: GraphPlugin;

    let overworld_entrance: GraphEntrance;
    let interior_entrance: GraphEntrance;
    let grotto_entrance: GraphEntrance;
    let dungeon_entrance: GraphEntrance;
    let overworld_target: GraphEntrance;
    let interior_target: GraphEntrance;
    let grotto_target: GraphEntrance;
    let dungeon_target: GraphEntrance;
    let interior_reverse: GraphEntrance;
    let hideout_entrance: GraphEntrance;
    let hideout_target: GraphEntrance;

    let overworldoneway_entrance: GraphEntrance;
    let overworldoneway_target: GraphEntrance;
    let owldrop_entrance: GraphEntrance;
    let owldrop_target: GraphEntrance;
    let spawn_entrance: GraphEntrance;
    let spawn_target: GraphEntrance;
    let warp_entrance: GraphEntrance;
    let warp_target: GraphEntrance;
    let bluewarp_entrance: GraphEntrance;
    let bluewarp_target: GraphEntrance;
    let boss_entrance: GraphEntrance;
    let boss_target: GraphEntrance;
    let boss_savewarp: GraphEntrance;

    const base_entrance_settings = {
        settings: {
            shuffle_overworld_entrances: false,
            shuffle_interior_entrances: 'off',
            shuffle_hideout_entrances: 'off',
            shuffle_grotto_entrances: false,
            shuffle_dungeon_entrances: 'off',
            shuffle_bosses: 'off',
            shuffle_ganon_tower: false,
            mix_entrance_pools: [],
            decouple_entrances: false,
            shuffle_gerudo_valley_river_exit: 'off',
            owl_drops: 'off',
            warp_songs: 'off',
            shuffle_child_spawn: 'off',
            shuffle_adult_spawn: 'off',
            blue_warps: 'dungeon',
            dungeon_back_access: false,
        }
    };

    /*
        Entrance types      # forward / # reverse

        Dungeon             11 / 11
        DungeonSpecial       1 /  1
        ChildBoss            3 /  3
        AdultBoss            5 /  5
        SpecialBoss          1 /  1
        Interior            36 / 36
        SpecialInterior      5 /  5
        Hideout             13 / 13
        Grotto              33 / 33
        Grave                4 /  4
        Overworld           26 / 26
        OverworldOneWay      1 / --
        OwlDrop              2 / --
        ChildSpawn           1 / --
        AdultSpawn           1 / --
        WarpSong             6 / --
        BlueWarp             8 / --
        Extra                2 / --

        |—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————|
        |                                   Allowed Target Entrance Types (Fenhl-branch-specific)                                         |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        |                 | Dungeon |  Interior  | Grotto | Overworld |  Boss   | OverworldOneWay | OwlDrop | WarpSong | Spawn | BlueWarp |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Dungeon         | simple  |            |        |           |         |       Full*     |  Full*  |   Full*  | Full* |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | DungeonSpecial  |  all    |            |        |           |         |       Full*     |  Full*  |   Full*  | Full* |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | ChildBoss       |         |            |        |           |  Full   |       Back*     |  Back*  |   Back*  | Back* |  Back*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | AdultBoss       |         |            |        |           |  Full   |       Back*     |  Back*  |   Back*  | Back* |  Back*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | SpecialBoss     |         |            |        |           | shuffle |       Back*     |  Back*  |   Back*  | Back* |  Back*   |
        |                 |         |            |        |           | _ganon  |                 |         |          |       |          |
        |                 |         |            |        |           | _tower  |                 |         |          |       |          |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Interior        |         |   simple   |        |           |         |       Bal**     |  Full** |   Bal*   | Bal*  |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | SpecialInterior |         |    all     |        |           |         |       Bal**     |  Full** |   Bal*   | Bal*  |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Hideout         |         |  shuffle   |        |           |         |       Full*     |  Full*  |   Full*  | Full* |  Full*   |
        |                 |         | _hideout   |        |           |         |                 |         |          |       |          |
        |                 |         | _entrances |        |           |         |                 |         |          |       |          |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Grotto          |         |            |  true  |           |         |       Full*     |  Full*  |   Full*  |       |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Grave           |         |            |  true  |           |         |       Full*     |  Full*  |   Full*  | Full* |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Overworld       |         |            |        |   true    |         |       Bal*      |  Bal*   |   Bal*   | Bal*  |  Full*   |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | OverworldOneWay |         |            |        |           |         |       Bal       |  Bal    |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | OwlDrop         |         |            |        |           |         |       Bal       |  Bal    |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | ChildSpawn      |         |            |        |           |         |       Full      |  Full   |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | AdultSpawn      |         |            |        |           |         |       Full      |  Full   |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | WarpSong        |         |            |        |           |         |       Bal       |  Bal    |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | BlueWarp        |         |            |        |           |         |       Bal       |  Bal    |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|
        | Extra           |         |            |        |           |         |       Bal       |  Bal    |   Bal    | Bal   |  Bal     |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|——————————|

        Notes:
            Bal = "Balanced" option, only forward entrances
            Bal* = Same as Bal plus reverse entrances where applicable
            Bal** = "Balanced" option, only reverse entrances. Forward entrances are included with the "Full" option
            Full = "Full" option, only forward entrances
            Full* = Same as Full option with reverse entrances where applicable
            Full** = "Full" option, but bizarrely only the reverse entrances. Does not depend on dungeon_back_access.
            Back* = "Full" option and dungeon_back_access enabled. Includes both forward/reverse for all types.
    */

    beforeAll(async () => {
        let version = '8.1.45 Fenhl-3';
        let local_files = 'tests/ootr-local-fenhl-8-1-45-3';
        let global_cache = await ExternalFileCacheFactory('ootr', version, { local_files: local_files });
        graph = await WorldGraphRemoteFactory('ootr', {}, version, global_cache);
        overworld_entrance = graph.worlds[0].get_entrance('GV Fortress Side -> Gerudo Fortress');
        overworld_target = graph.worlds[0].get_entrance('LW Bridge -> Hyrule Field');
        interior_entrance = graph.worlds[0].get_entrance('Goron City -> GC Shop');
        interior_target = graph.worlds[0].get_entrance('Market -> Market Treasure Chest Game');
        grotto_entrance = graph.worlds[0].get_entrance('SFM Entryway -> SFM Wolfos Grotto');
        grotto_target = graph.worlds[0].get_entrance('Hyrule Field -> HF Near Market Grotto');
        dungeon_entrance = graph.worlds[0].get_entrance('Lake Hylia -> Water Temple Lobby');
        dungeon_target = graph.worlds[0].get_entrance('Zoras Fountain -> Jabu Jabus Belly Beginning');
        overworldoneway_entrance = graph.worlds[0].get_entrance('GV Lower Stream -> Lake Hylia');
        overworldoneway_target = graph.worlds[0].get_entrance('Market -> Castle Grounds');
        owldrop_entrance = graph.worlds[0].get_entrance('LH Owl Flight -> Hyrule Field');
        owldrop_target = graph.worlds[0].get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region');
        spawn_entrance = graph.worlds[0].get_entrance('Adult Spawn -> Temple of Time');
        spawn_target = graph.worlds[0].get_entrance('ZF Great Fairy Fountain -> Zoras Fountain');
        warp_entrance = graph.worlds[0].get_entrance('Requiem of Spirit Warp -> Desert Colossus');
        warp_target = graph.worlds[0].get_entrance('DMT Owl Flight -> Kak Impas Rooftop Cutscene Entrance');
        bluewarp_entrance = graph.worlds[0].get_entrance('Twinrova Boss Room -> Desert Colossus');
        bluewarp_target = graph.worlds[0].get_entrance('Child Spawn -> KF Links House');
        boss_entrance = graph.worlds[0].get_entrance('Forest Temple Before Boss -> Phantom Ganon Boss Room');
        boss_target = graph.worlds[0].get_entrance('Shadow Temple Before Boss -> Bongo Bongo Boss Room');
        boss_savewarp = graph.worlds[0].get_entrance('Bongo Bongo Boss Room -> Shadow Temple Entryway');
        interior_reverse = graph.worlds[0].get_entrance('DMC Great Fairy Fountain -> DMC Lower Local');
        hideout_entrance = graph.worlds[0].get_entrance('Hideout Kitchen Hallway -> Gerudo Fortress');
        hideout_target = graph.worlds[0].get_entrance('Hideout Hall to Balcony -> GF Balcony');
    });

    test('Overworld pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworld_entrance);

        // all forward/reverse entrances minus loopbacks to source region
        // Exit is from Gerudo Valley, has 2 overworld entrances
        expect(Object.values(pool).flat().length).toEqual(50);

        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworld_target);

        // coupled entrances should remove both forward/reverse targets from pool
        // Alt unconnected exit is from Lost Woods Bridge, which also happens to have 2 entrances
        expect(Object.values(pool).flat().length).toEqual(48);
    });

    test('Interior pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_interior_entrances: 'simple',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], interior_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(36);

        graph.set_entrance(interior_entrance, interior_target);
        pool = graph.get_entrance_pool(graph.worlds[0], interior_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(35);
    });

    test('Full Interior pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_interior_entrances: 'all',
                shuffle_hideout_entrances: 'hideout_savewarp',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], interior_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(54);

        graph.set_entrance(interior_entrance, interior_target);
        pool = graph.get_entrance_pool(graph.worlds[0], interior_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(53);
    });

    test('Full Interior reverse pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_interior_entrances: 'all',
                shuffle_hideout_entrances: 'hideout_savewarp',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], interior_reverse);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(54);

        graph.set_entrance(interior_entrance, interior_target);
        pool = graph.get_entrance_pool(graph.worlds[0], interior_reverse);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(53);
    });

    test('Full Interior reverse decoupled pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_interior_entrances: 'all',
                shuffle_hideout_entrances: 'hideout_savewarp',
                decouple_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], interior_reverse);

        // forward/reverse entrances minus loopback to source region
        expect(Object.values(pool).flat().length).toEqual(107);

        graph.set_entrance(interior_entrance, interior_target);
        pool = graph.get_entrance_pool(graph.worlds[0], interior_reverse);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(106);
    });

    test('Hideout decoupled pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_interior_entrances: 'all',
                shuffle_hideout_entrances: 'hideout_savewarp',
                decouple_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], hideout_entrance);

        // forward/reverse entrances minus loopback to source region
        // Total 108 targets
        // Kitchen has 4 entrances
        expect(Object.values(pool).flat().length).toEqual(104);

        graph.set_entrance(hideout_entrance, hideout_target);
        pool = graph.get_entrance_pool(graph.worlds[0], hideout_target);

        // minus connected and target loopback
        // Break Room has 2 entrances
        expect(Object.values(pool).flat().length).toEqual(105);
    });

    test('Grotto pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_grotto_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], grotto_entrance);

        // forward-only entrances when coupled, no exclusions
        // Both grottos and graves
        expect(Object.values(pool).flat().length).toEqual(37);

        graph.set_entrance(grotto_entrance, grotto_target);
        pool = graph.get_entrance_pool(graph.worlds[0], grotto_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(36);
    });

    test('Dungeon pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_dungeon_entrances: 'simple',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], dungeon_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(11);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], dungeon_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(10);
    });

    test('Full Dungeon pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_dungeon_entrances: 'all',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], dungeon_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(12);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], dungeon_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(11);
    });

    test('Boss pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_bosses: 'full',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(8);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(7);
    });

    test('Full Boss pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_bosses: 'full',
                shuffle_ganon_tower: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(9);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(8);
    });

    test('Partial Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_bosses: 'full',
                shuffle_ganon_tower: true,
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'Boss',
                ],
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(50);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(49);
    });

    test('Full Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: 'hideout_savewarp',
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_ganon_tower: true,
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                    'Boss',
                ],
                shuffle_gerudo_valley_river_exit: 'full',
                owl_drops: 'full',
                warp_songs: 'full',
                shuffle_child_spawn: 'full',
                shuffle_adult_spawn: 'full',
                blue_warps: 'full',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);

        // forward-only entrances when coupled, 164 total entrances.
        // Boss exit from dungeon can't loop back to main dungeon entrance, minus 1 entrance
        expect(Object.values(pool).flat().length).toEqual(163);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(162);
    });

    test('Full Mixed pool length for Overworld', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: 'hideout_savewarp',
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_ganon_tower: true,
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                    'Boss',
                ],
                shuffle_gerudo_valley_river_exit: 'full',
                owl_drops: 'full',
                warp_songs: 'full',
                shuffle_child_spawn: 'full',
                shuffle_adult_spawn: 'full',
                blue_warps: 'full',
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworld_entrance);
        //console.log(JSON.stringify(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name} (${e.type_alias})`), null, 4));

        // all forward/reverse entrances minus loopbacks to source region
        // Exit is from Gerudo Valley, has:
        //      2 overworld entrances
        //      2 grotto entrances
        //      1 interior entrance
        expect(Object.values(pool).flat().length).toEqual(271);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworld_entrance);

        // forward/reverse minus connected
        expect(Object.values(pool).flat().length).toEqual(269);
    });

    test('Full Decoupled Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: 'hideout_savewarp',
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_ganon_tower: true,
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                    'Boss',
                ],
                shuffle_gerudo_valley_river_exit: 'full',
                owl_drops: 'full',
                warp_songs: 'full',
                shuffle_child_spawn: 'full',
                shuffle_adult_spawn: 'full',
                blue_warps: 'full',
                decouple_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);

        // all forward/reverse entrances except reverse into the source region
        expect(Object.values(pool).flat().length).toEqual(274);

        graph.set_entrance(boss_entrance, boss_target);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_target);

        // minus connected
        expect(Object.values(pool).flat().length).toEqual(273);
    });

    test('Overworld One-way pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                owl_drops: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(112);

        // Only the owl drop one-way should remove an entrance from the pool
        graph.set_entrance(owldrop_entrance, owldrop_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(111);
    });

    test('Owl Drop pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                owl_drops: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(71);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(70);
    });

    test('Warp Song pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                warp_songs: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(155);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(154);
    });

    test('Spawn Point pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                shuffle_adult_spawn: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(155);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(154);
    });

    test('Blue Warp pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                blue_warps: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(21);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, warp_entrance);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(20);
    });

    test('Full Overworld One-way pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'full',
                owl_drops: 'balanced',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(279);

        // Only the owl drop one-way should remove an entrance from the pool
        graph.set_entrance(owldrop_entrance, owldrop_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(278);
    });

    test('Full Owl Drop pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                owl_drops: 'full',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(238);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(237);
    });

    test('Full Warp Song pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                warp_songs: 'full',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(279);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(278);
    });

    test('Full Spawn Point pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                shuffle_adult_spawn: 'full',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(213);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(212);
    });

    test('Full Blue Warp pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                blue_warps: 'full',
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(279);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, warp_entrance);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(278);
    });

    test('Back Dungeons & Full Overworld One-way pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'full',
                owl_drops: 'balanced',
                shuffle_overworld_entrances: true,
                dungeon_back_access: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(297);

        // Only the owl drop one-way should remove an entrance from the pool
        graph.set_entrance(owldrop_entrance, owldrop_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(296);
    });

    test('Back Dungeons & Full Owl Drop pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                owl_drops: 'full',
                shuffle_overworld_entrances: true,
                dungeon_back_access: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(256);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], owldrop_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(255);
    });

    test('Back Dungeons & Full Warp Song pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                warp_songs: 'full',
                shuffle_overworld_entrances: true,
                dungeon_back_access: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(297);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], warp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(296);
    });

    test('Back Dungeons & Full Spawn Point pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                shuffle_adult_spawn: 'full',
                shuffle_overworld_entrances: true,
                dungeon_back_access: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(231);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, overworldoneway_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], spawn_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(230);
    });

    test('Back Dungeons & Full Blue Warp pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: 'balanced',
                blue_warps: 'full',
                shuffle_overworld_entrances: true,
                dungeon_back_access: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(297);

        // Only the overworld one-way should remove an entrance from the pool
        graph.set_entrance(overworldoneway_entrance, warp_entrance);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], bluewarp_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(296);
    });
});