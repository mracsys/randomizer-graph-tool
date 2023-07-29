import WorldState from "../src/plugins/ootr-latest/WorldState";
import World  from "../src/plugins/ootr-latest/World";
import RuleParser, { AccessRule } from "../src/plugins/ootr-latest/RuleParser";
import OotrFileCache from "../src/plugins/ootr-latest/OotrFileCache";
import OotrVersion from "../src/plugins/ootr-latest/OotrVersion";
import { Item, ItemFactory } from "../src/plugins/ootr-latest/Item";
import { Region } from "../src/plugins/ootr-latest/Region";
import { Location } from "../src/plugins/ootr-latest/Location";
import OotrGraphPlugin from "../src/plugins/ootr-latest/OotrGraphPlugin";
import { describe, expect, it, beforeEach } from "@jest/globals";

let test_version: string;
let _cache: OotrFileCache;
let _graph: OotrGraphPlugin;
let _version: OotrVersion;
let world: World;
let state: WorldState;
let parser: RuleParser;

beforeEach(async () => {
    test_version = '7.1.143';
    _cache = await OotrFileCache.load_ootr_files(test_version, true);
    _graph = await OotrGraphPlugin.create_graph({}, test_version, _cache, false, true);
    _version = new OotrVersion(test_version);
    world = new World(0, _graph.settings_list, _version, _graph);
    parser = new RuleParser(world, _version);
    state = new WorldState(world);
});

describe('visit_Name', () => {
    let boomerang: Item;
    let logic: AccessRule;
    beforeEach(() => {
        boomerang = ItemFactory('Boomerang', world)[0];
        const jabu = "Boomerang && is_child";
        logic = parser.parse_rule(jabu);
    });

    it('evaluates without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('returns false if items are required but age satisfied', () => {
        expect(logic(state, {})).toBeFalsy();
    });

    it('returns false if age is required but items satisfied', () => {
        state.collect(boomerang);
        expect(logic(state, {})).toBeFalsy();
    });

    it('returns false if incorrect age but items satisfied', () => {
        state.collect(boomerang);
        expect(logic(state, { age: 'adult' })).toBeFalsy();
    });

    it('returns true when all conditions satisfied', () => {
        state.collect(boomerang);
        expect(logic(state, { age: 'child' })).toBeTruthy();
    });

    it('transitions from true to false when required items are removed', () => {
        state.collect(boomerang);
        expect(logic(state, { age: 'child' })).toBeTruthy();
        state.remove(boomerang);
        expect(logic(state, { age: 'child' })).toBeFalsy();
    });
});

describe('visit_Call', () => {
    let poh: Item;
    let logic_hearts: AccessRule;
    beforeEach(() => {
        const statehearts = "has_hearts(4)";
        logic_hearts = parser.parse_rule(statehearts);
        poh = ItemFactory('Piece of Heart', world)[0];
    });

    it('evaluates without error', () => {
        expect(() => { logic_hearts(state, {})}).not.toThrowError();
    });

    it('runs rules referencing state methods', () => {
        expect(logic_hearts(state, {})).toBeFalsy();
        state.collect(poh);
        state.collect(poh);
        state.collect(poh);
        state.collect(poh);
        expect(logic_hearts(state, {})).toBeTruthy();
        state.remove(poh);
        expect(logic_hearts(state, {})).toBeFalsy();
    });
});

describe('visit_BoolOp', () => {
    let bow: Item;
    let logic: AccessRule;
    beforeEach(() => {
        const rule = "Boomerang || Slingshot || (is_adult && (Bow || Hookshot))";
        logic = parser.parse_rule(rule);
        bow = ItemFactory('Bow', world)[0];
    });

    it('evaluates without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('parses boolean expressions correctly', () => {
        expect(logic(state, {})).toBeFalsy();
        expect(logic(state, { age: 'adult' })).toBeFalsy();
        state.collect(bow);
        expect(logic(state, {})).toBeFalsy();
        expect(logic(state, { age: 'adult' })).toBeTruthy();
    });
});

describe('visit_Compare', () => {
    let logic: AccessRule;
    beforeEach(() => {
        const rule = "bridge === 'medallions'";
        logic = parser.parse_rule(rule);
    });

    it('evaluates without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('parses world settings correctly', () => {
        expect(logic(state, {})).toBeTruthy();
    });
});

describe('visit_Unary', () => {
    let logic: AccessRule;
    beforeEach(() => {
        const rule = "!(bridge === 'stones')";
        logic = parser.parse_rule(rule);
    });

    it('evaluates without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('inverts logic rules', () => {
        expect(logic(state, {})).toBeTruthy();
    });
});

describe('visit_Subscript', () => {
    let logic_forest: AccessRule;
    let logic_water: AccessRule;
    beforeEach(() => {
        const trials = "skipped_trials[Forest]";
        const trials2 = "skipped_trials[Water]";
        logic_forest = parser.parse_rule(trials);
        logic_water = parser.parse_rule(trials2);
        state.world.skipped_trials.Forest = true;
    });

    it('evaluates without error', () => {
        expect(() => { logic_forest(state, {})}).not.toThrowError();
        expect(() => { logic_water(state, {})}).not.toThrowError();
    });

    it('parses member expressions correctly', () => {
        expect(logic_forest(state, {})).toBeTruthy();
        expect(logic_water(state, {})).toBeFalsy();
    });
});

describe('visit_Tuple', () => {
    let fire_small_key: Item;
    let logic: AccessRule;
    beforeEach(() => {
        const rule = "(Small_Key_Fire_Temple, 2)";
        logic = parser.parse_rule(rule);
        fire_small_key = ItemFactory('Small Key (Fire Temple)', world)[0];
    });

    it('evaluates without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('accounts for total required item copies', () => {
        expect(logic(state, {})).toBeFalsy();
        state.collect(fire_small_key);
        expect(logic(state, {})).toBeFalsy();
        state.collect(fire_small_key);
        expect(logic(state, {})).toBeTruthy();
    });
});

describe('delayed rules', () => {
    let bow: Item;
    let bomb_bag: Item;
    let hookshot: Item;
    let logic: AccessRule;
    beforeEach(() => {
        let region = new Region('Deku Tree', world);
        let location = new Location('Deku Tree GS Basement Back Room', 'Chest', region, false, world);
        region.locations.push(location);
        world.regions.push(region);

        const rule = "here(has_fire_source_with_torch || can_use(Bow)) && here(can_blast_or_smash) && (can_use(Boomerang) || can_use(Hookshot))";
        logic = parser.parse_rule(rule, location);
        parser.create_delayed_rules();
        bow = ItemFactory('Bow', world)[0];
        bomb_bag = ItemFactory('Bomb Bag', world)[0];
        hookshot = ItemFactory('Progressive Hookshot', world)[0];
    });

    it('evaluate without error', () => {
        expect(() => { logic(state, {})}).not.toThrowError();
    });

    it('creates the correct number of internal event locations', () => {
        expect(world.regions[0].locations.length).toBe(3);
    });

    it('create collectable internal events that satisfy the original spot rule', () => {
        expect(logic(state, {})).toBeFalsy();
        state.collect(bow);
        state.collect(bomb_bag);
        state.collect(hookshot);
        expect(logic(state, {})).toBeFalsy();
        for(let l of world.regions[0].locations) {
            if (l.internal) expect(_graph.ItemInfo.events).toHaveProperty(l.name);
            if (l.access_rule(state, { age: 'adult' }) && !!l.item) {
                state.collect(l.item);
            }
        }
        expect(logic(state, { age: 'adult' })).toBeTruthy();
        expect(logic(state, { age: 'child' })).toBeFalsy();
    });
});