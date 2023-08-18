import { GraphLocation } from "../GraphPlugin.js";

import { Region } from "./Region.js";
import World from './World.js';
import WorldState from './WorldState.js';
import Entrance from './Entrance.js';
import { Item, ItemFactory } from './Item.js';

type Spot = Entrance | Location;
type kwargs = { age?: string | null, spot?: Spot | null, tod?: number | null };
type AccessRule = (worldState: WorldState, { age, spot, tod }: kwargs) => boolean;

const DisableType = {
    ENABLED: 0,
    PENDING: 1,
    DISABLED: 2,
}

export class Location implements GraphLocation {
    constructor(
        public name: string = '',
        public type: string = 'Chest',
        public parent_region: Region | null = null,
        public internal: boolean = false,
        public world: World,
        public vanilla_item_name: string | null = null,
        public vanilla_item: Item | null = null,
        public item: Item | null = null,
        public staleness_count: number = 0,
        public rule_string: string = '',
        public transformed_rule: string = '',
        public access_rule: AccessRule = (worldState, { age = null, spot = null, tod = null } = {}) => true,
        public access_rules: AccessRule[] = [],
        public locked: boolean = false,
        public price: number | null = null,
        public minor_only: boolean = false,
        public disabled: number = DisableType.ENABLED,
        public always: boolean = false,
        public never: boolean = false,
        public sphere: number = -1,
        public alias: string = '',
        public shuffled: boolean = true,
    ) {
        this.vanilla_item = !!vanilla_item_name ? ItemFactory(vanilla_item_name, this.world)[0] : null;
        if (this.type === "Event" || this.name === "Gift from Sages") {
            this.internal = true;
            this.shuffled = false;
        }
    }

    add_rule(rule: AccessRule): void {
        if (this.always) {
            this.set_rule(rule);
            this.always = false;
            return;
        }
        if (this.never) {
            return;
        }
        this.access_rules.push(rule);
        this.access_rule = this._run_rules;
    }

    _run_rules(worldState: WorldState, kwargs: kwargs): boolean {
        return this.access_rules.every((rule) => {
            return rule(worldState, kwargs);
        });
    }

    set_rule(rule: AccessRule): void {
        this.access_rule = rule;
        this.access_rules = [rule];
    }

    dungeon(): string | null {
        return !!(this.parent_region) ? this.parent_region.dungeon : null; 
    }

    viewable(): boolean {
        return !(this.internal);
    }
}

export function LocationFactory(locations: string | string[], world: World): Location[] {
    let ret = [];
    let locations_to_build = locations;
    const location_table = world.parent_graph.location_list.locations;
    if (typeof(locations_to_build) === 'string') {
        locations_to_build = [locations_to_build];
    }
    for (let location of locations_to_build) {
        let match_location;
        if (Object.keys(location_table).includes(location)) {
            match_location = location;
        } else {
            match_location = Object.keys(location_table).filter((k: string): boolean => k.toLowerCase() === location.toLowerCase())[0];
        }
        if (match_location) {
            let [type, vanilla_item] = location_table[match_location];
            ret.push(new Location(match_location, type, null, false, world, vanilla_item));
        } else {
            throw `Unknown location ${location}`;
        }
    }
    return ret;
}