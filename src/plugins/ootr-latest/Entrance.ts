import { GraphEntrance, GraphRegion } from '../GraphPlugin.js';

import { Region } from './Region.js';
import World from './World.js';
import WorldState from './WorldState.js';
import { Location } from './Location.js';
import { RegionGroup } from './RegionGroup.js';
import { Boulder } from './Boulders.js';

type Spot = Entrance | Location;
type kwargs = { age?: string | null, spot?: Spot | null, tod?: number | null };
type AccessRule = (worldState: WorldState, { age, spot, tod }: kwargs) => boolean;

class Entrance implements GraphEntrance {
    constructor(
        public name: string,
        public parent_region: Region,
        public world: World,
        public connected_region: Region | null = null,
        public original_connection_name: string | null = null,
        public original_connection: Region | null = null,
        public rule_string: string = '',
        public transformed_rule: string = '',
        public access_rule: AccessRule = (worldState, { age = null, spot = null, tod = null } = {}) => true,
        public static_access_rule: AccessRule = (worldState, { age = null, spot = null, tod = null } = {}) => true,
        public access_rules: AccessRule[] = [],
        public boulders: Boulder[] = [],
        public reverse: Entrance | null = null,
        public alternate: Entrance | null = null,
        public replaces: Entrance | null = null,
        public assumed: Entrance | null = null,
        public type: string | null = null,
        public shuffled: boolean = false,
        public primary: boolean = false,
        public secondary: boolean = false,
        public always: boolean = false,
        public never: boolean = false,
        public alias: string = '',
        public type_alias: string = '',
        public type_priority: number = 0,
        public target_alias: string = '',
        public use_target_alias: boolean = false,
        public coupled: boolean = true,
        public is_warp: boolean = false,
        public is_savewarp: boolean = false,
        public one_way: boolean = false,
        public sphere: number = -1,
        public visited: boolean = false,
        public visited_with_other_tricks: boolean = false,
        public child_visited: boolean = false,
        public child_visited_with_other_tricks: boolean = false,
        public adult_visited: boolean = false,
        public adult_visited_with_other_tricks: boolean = false,
        public checked: boolean = false,
        public source_group: RegionGroup | null = null,
        public target_group: RegionGroup | null = null,
        public user_connection: Entrance | null = null,
        public hinted: boolean = false,
        public savewarp_fallback_name: string = '',
    ) {
        this.world = this.parent_region.world;
        this.alias = this.name;
    }

    add_rule(rule: AccessRule): void {
        if (this.always) {
            this.always = false;
        }
        if (this.never) {
            return;
        }
        this.access_rules.push(rule);
        this.access_rule = this._run_rules;
    }

    _run_rules(worldState: WorldState, kwargs: kwargs): boolean {
        return this.access_rules.every((rule) => {
            rule(worldState, kwargs);
        });
    }

    set_rule(rule: AccessRule): void {
        this.access_rule = rule;
        this.static_access_rule = rule;
        this.access_rules = [rule];
    }

    reset_rules(): void {
        this.access_rule = this.static_access_rule;
        this.access_rules = [this.static_access_rule];
    }

    connect(region: Region): void {
        this.connected_region = region;
        region.entrances.push(this);
        if (!!(region.parent_group)) region.parent_group.entrances.push(this);
    }

    disconnect(): Region {
        if (!!(this.connected_region)) {
            let i = this.connected_region.entrances.indexOf(this);
            if (i > -1) {
                this.connected_region.entrances.splice(i, 1);
            } else {
                throw(`Failed to disconnect entrance ${this.name} from ${this.connected_region.name}`)
            }
            if (!!(this.connected_region.parent_group) && !!(this.type)) {
                i = this.connected_region.parent_group.entrances.indexOf(this);
                if (i > -1) {
                    this.connected_region.parent_group.entrances.splice(i, 1);
                } else {
                    throw(`Failed to disconnect entrance ${this.name} from ${this.connected_region.parent_group.name}`)
                }
            }
            let previously_connected = this.connected_region;
            this.connected_region = null;
            return previously_connected;
        } else {
            throw(`Attempted to disconnect entrance that was already disconnected: ${this.name}`);
        }
    }

    bind_two_way(other_entrance: Entrance): void {
        this.reverse = other_entrance;
        other_entrance.reverse = this;
    }

    unbind_two_way(other_entrance: Entrance): void {
        this.reverse = null;
        other_entrance.reverse = null;
    }

    get_new_target(): Entrance {
        if (!!(this.world) && !!(this.connected_region)) {
            let root = this.world.get_region('Root Exits');
            let target_entrance = new Entrance(`Root -> ${this.connected_region.name}`, root, this.world);
            target_entrance.connect(this.connected_region);
            target_entrance.replaces = this;
            root.exits.push(target_entrance);
            return target_entrance;
        } else {
            throw(`Attempted to create target entrance from uninitialized entrance: ${this.name}`);
        }
    }

    assume_reachable(): Entrance {
        if (this.assumed === null) {
            this.assumed = this.get_new_target();
            this.disconnect();
        }
        return this.assumed;
    }

    viewable(): boolean {
        // only shufflable entrances are given a type from the entrance table
        let target = !!(this.replaces) ? this.replaces : this;
        if (this.type !== null && this.is_warp) { // one way entrances always visible, run before next check because it catches Child Spawn
            return true;
        } else if (this.type !== null && target.target_group !== null) { // filter "dead end" entrances with no locations or connectors
            return target.target_group.page !== '' || target.target_group.locations.filter(l => l.shuffled).length > 0;
        } else if (this.type !== null && this.connected_region === null) { // unconnected shuffled entrances always visible
            return true;
        } else {
            return false;
        }
    }

    set_visited(with_tricks: boolean = false, age: string = '') {
        if (with_tricks) {
            this.visited_with_other_tricks = true;
            if (age === 'child') {
                this.child_visited_with_other_tricks = true;
            } else if (age === 'adult') {
                this.adult_visited_with_other_tricks = true;
            } else if (age === 'both') {
                this.child_visited_with_other_tricks = true;
                this.adult_visited_with_other_tricks = true;
            }
        } else {
            this.visited = true;
            if (age === 'child') {
                this.child_visited = true;
            } else if (age === 'adult') {
                this.adult_visited = true;
            } else if (age === 'both') {
                this.child_visited = true;
                this.adult_visited = true;
            }
        }
    }

    is_reverse(): boolean {
        return !(this.primary || this.type === 'Overworld');
    }

    copy_metadata(other_entrance: Entrance): void {
        this.type = other_entrance.type;
        this.primary = other_entrance.primary;
        this.secondary = other_entrance.secondary;
        this.alias = other_entrance.alias;
        this.target_alias = other_entrance.target_alias;
        this.is_warp = other_entrance.is_warp;
        this.coupled = other_entrance.coupled;
        this.type_alias = other_entrance.type_alias;
        this.savewarp_fallback_name = other_entrance.savewarp_fallback_name;
        // Object reference is updated when swapping dungeons
        this.target_group = other_entrance.target_group;
    }
}

export default Entrance;