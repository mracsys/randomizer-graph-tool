import World from "../src/plugins/ootr-latest/World";
import { ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphEntrance, GraphPlugin } from "../src/WorldGraph";
import { locationFilter } from "../src/plugins/ootr-latest/Utils.js";
import { describe, expect, test, beforeAll } from "@jest/globals";


describe('OOTR 8.1.29 Rob-104 entrance pools', () => {
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
            shuffle_hideout_entrances: false,
            shuffle_grotto_entrances: false,
            shuffle_dungeon_entrances: 'off',
            shuffle_bosses: 'off',
            mix_entrance_pools: [],
            decouple_entrances: false,
            shuffle_gerudo_valley_river_exit: false,
            owl_drops: false,
            warp_songs: false,
            spawn_positions: [],
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
        Spawn                2 / --
        WarpSong             6 / --
        BlueWarp             8 / --
        Extra                2 / --

        |——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————|
        |                                                 Allowed Target Entrance Types                                        |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        |                 | Dungeon |  Interior  | Grotto | Overworld |  Boss   | OverworldOneWay | OwlDrop | WarpSong | Spawn |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Dungeon         | simple  |            |        |           |         |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | DungeonSpecial  |  all    |            |        |           |         |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | ChildBoss       |         |            |        |           |  Full   |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | AdultBoss       |         |            |        |           |  Full   |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Interior        |         |   simple   |        |           |         |                 |         |   true*  | true* |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | SpecialInterior |         |    all     |        |           |         |                 |         |   true*  | true* |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Hideout         |         |  shuffle   |        |           |         |                 |         |          |       |
        |                 |         | _hideout   |        |           |         |                 |         |          |       |
        |                 |         | _entrances |        |           |         |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Grotto          |         |            |  true  |           |         |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Grave           |         |            |  true  |           |         |                 |         |          |       |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Overworld       |         |            |        |   true    |         |       true*     |  true*  |   true*  | true* |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | OverworldOneWay |         |            |        |           |         |       true      |  true   |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | OwlDrop         |         |            |        |           |         |       true      |  true   |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Spawn           |         |            |        |           |         |                 |         |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | WarpSong        |         |            |        |           |         |       true      |  true   |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | BlueWarp        |         |            |        |           |         |       true      |  true   |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|
        | Extra           |         |            |        |           |         |       true      |  true   |   true   | true  |
        |—————————————————|—————————|————————————|————————|———————————|—————————|—————————————————|—————————|——————————|———————|

        Notes:
            true* = Same as true plus reverse entrances where applicable
    */

    beforeAll(async () => {
        let version = '8.1.29 Rob-104';
        let local_files = 'tests/ootr-local-realrob-8-1-29-104';
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
        warp_target = graph.worlds[0].get_entrance('DMT Owl Flight -> Kak Impas Rooftop');
        bluewarp_entrance = graph.worlds[0].get_entrance('Twinrova Boss Room -> Desert Colossus');
        bluewarp_target = graph.worlds[0].get_entrance('Child Spawn -> KF Links House');
        boss_entrance = graph.worlds[0].get_entrance('Forest Temple Before Boss -> Phantom Ganon Boss Room');
        boss_target = graph.worlds[0].get_entrance('Shadow Temple Before Boss -> Bongo Bongo Boss Room');
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
                shuffle_hideout_entrances: true,
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
                shuffle_hideout_entrances: true,
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
                shuffle_hideout_entrances: true,
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
                shuffle_hideout_entrances: true,
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

    test('Partial Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_dungeon_entrances: 'all',
                shuffle_interior_entrances: 'all',
                shuffle_overworld_entrances: true,
                shuffle_grotto_entrances: true,
                shuffle_bosses: 'full',
                mix_entrance_pools: [
                    'Interior',
                    'Dungeon',
                ],
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], dungeon_entrance);

        // forward-only entrances when coupled, no exclusions
        expect(Object.values(pool).flat().length).toEqual(53);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], dungeon_target);

        // forward-only minus connected
        expect(Object.values(pool).flat().length).toEqual(52);

        // Unmixed pools are unaffected
        pool = graph.get_entrance_pool(graph.worlds[0], grotto_entrance);
        expect(Object.values(pool).flat().length).toEqual(37);
        pool = graph.get_entrance_pool(graph.worlds[0], overworld_entrance);
        expect(Object.values(pool).flat().length).toEqual(50);
        pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);
        expect(Object.values(pool).flat().length).toEqual(8);
    });

    test('Full Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: true,
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                ],
                shuffle_gerudo_valley_river_exit: true,
                owl_drops: true,
                warp_songs: true,
                spawn_positions: [
                    'child',
                    'adult',
                ],
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], dungeon_entrance);

        // forward-only entrances when coupled, 155 total entrances.
        // Exclude loop back to Lake Hylia, minus 2 Overworld entrances (Field and Domain)
        expect(Object.values(pool).flat().length).toEqual(153);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], dungeon_target);

        // forward-only minus connected, minus 1 Overworld entrance (Domain)
        expect(Object.values(pool).flat().length).toEqual(153);

        // Always unmixed boss entrance pool is unaffected
        pool = graph.get_entrance_pool(graph.worlds[0], boss_entrance);
        expect(Object.values(pool).flat().length).toEqual(8);
    });

    test('Full Mixed pool length for Overworld', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: true,
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                ],
                shuffle_gerudo_valley_river_exit: true,
                owl_drops: true,
                warp_songs: true,
                spawn_positions: [
                    'child',
                    'adult',
                ],
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
        expect(Object.values(pool).flat().length).toEqual(253);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworld_entrance);

        // forward/reverse minus connected
        expect(Object.values(pool).flat().length).toEqual(251);
    });

    test('Full Decoupled Mixed pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_overworld_entrances: true,
                shuffle_hideout_entrances: true,
                shuffle_grotto_entrances: true,
                shuffle_dungeon_entrances: 'all',
                shuffle_bosses: 'full',
                shuffle_interior_entrances: 'all',
                mix_entrance_pools: [
                    'Interior',
                    'GrottoGrave',
                    'Dungeon',
                    'Overworld',
                ],
                shuffle_gerudo_valley_river_exit: true,
                owl_drops: true,
                warp_songs: true,
                spawn_positions: [
                    'child',
                    'adult',
                ],
                decouple_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], dungeon_entrance);

        // all forward/reverse entrances except reverse into the source region
        // Exit is from Lake Hylia, has:
        //      2 overworld entrances
        //      1 grotto entrance
        //      2 interior entrances
        //      1 dungeon entrance
        expect(Object.values(pool).flat().length).toEqual(252);

        graph.set_entrance(dungeon_entrance, dungeon_target);
        pool = graph.get_entrance_pool(graph.worlds[0], dungeon_target);

        // minus connected
        // Exit is from Zora Fountain, has:
        //      1 overworld entrance
        //      1 interior entrance
        //      2 dungeon entrances
        expect(Object.values(pool).flat().length).toEqual(253);
    });

    test('Overworld One-way pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: true,
                owl_drops: true,
                shuffle_overworld_entrances: true,
            }
        }
        graph.import(shuffled_entrance_settings);
        let pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        //console.log(Object.values(pool).flat().sort((e1, e2) => !!e1.type && !!e2.type ? e1.type.localeCompare(e2.type) : 0)
        //    .map(e => `[${e.type}]: ${e.name}`));
        // Forward/reverse of all allowed entrance types
        expect(Object.values(pool).flat().length).toEqual(71);

        // Only the owl drop one-way should remove an entrance from the pool
        graph.set_entrance(owldrop_entrance, owldrop_target);
        graph.set_entrance(overworld_entrance, overworld_target);
        pool = graph.get_entrance_pool(graph.worlds[0], overworldoneway_entrance);

        // forward/reverse minus connected one-ways of other types
        expect(Object.values(pool).flat().length).toEqual(70);
    });

    test('Owl Drop pool length', async () => {
        graph.import(base_entrance_settings);
        const shuffled_entrance_settings = {
            settings: {
                shuffle_gerudo_valley_river_exit: true,
                owl_drops: true,
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
                shuffle_gerudo_valley_river_exit: true,
                warp_songs: true,
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
                shuffle_gerudo_valley_river_exit: true,
                spawn_positions: [
                    'adult',
                ],
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
});