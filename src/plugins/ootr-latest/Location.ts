import { GraphLocation } from "../GraphPlugin.js";

import { Region } from "./Region.js";
import World from './World.js';
import WorldState from './WorldState.js';
import { Item, ItemFactory } from './Item.js';
import { display_names } from './DisplayNames.js';
import { Hint } from "./Hints.js";
import type { AccessRule, kwargs } from "./RuleParser.js";
import { Boulder } from "./Boulders.js";
import HintArea from "./HintArea.js";
import Entrance from "./Entrance.js";

const DisableType = {
    ENABLED: 0,
    PENDING: 1,
    DISABLED: 2,
}

const viewable_events = [
    'Wake Up Adult Talon from Kak Carpenter Boss House',
    "Kakariko Village Child Trade 1",
    "Lost Woods Child Trade 2",
    "Graveyard Child Trade 1",
    "Hyrule Field Child Trade 1",
    "Hyrule Castle Grounds Child Trade 1",
    "Epona from Lon Lon Ranch",
    "Links Cow from Lon Lon Ranch",
    "Bonooru from Lake Hylia",
    "Pierre",
    'Kokiri Forest Soil Patch 1',
    'Lost Woods Soil Patch 1',
    'LW Beyond Mido Soil Patch 1',
    'Lake Hylia Soil Patch 1',
    'Desert Colossus Soil Patch 1',
    'Graveyard Soil Patch 2',
    'Death Mountain Soil Patch 1',
    'DMC Central Nearby Soil Patch 1',
    'Zora River Soil Patch 1',
];

export class Location implements GraphLocation {
    constructor(
        public name: string = '',
        public type: string = 'Chest',
        public parent_region: Region | null = null,
        public internal: boolean = false,
        public world: World,
        public vanilla_item_name: string | null = null,
        public scene: number | null = null,
        public vanilla_item: Item | null = null,
        public item: Item | null = null,
        public staleness_count: number = 0,
        public rule_string: string = '',
        public transformed_rule: string = '',
        public access_rule: AccessRule = (worldState, { age = null, spot = null, tod = null } = {}) => true,
        // original non-dynamic access rule from the logic files, referenced when resetting dynamic shop rules
        public static_access_rule: AccessRule = (worldState, { age = null, spot = null, tod = null } = {}) => true,
        public access_rules: AccessRule[] = [],
        public boulders: Boulder[] = [],
        public locked: boolean = false,
        public price: number | null = null,
        public minor_only: boolean = false,
        public disabled: number = DisableType.ENABLED,
        public always: boolean = false,
        public never: boolean = false,
        public sphere: number = -1,
        public visited: boolean = false,
        public visited_with_other_tricks: boolean = false,
        public child_visited: boolean = false,
        public child_visited_with_other_tricks: boolean = false,
        public adult_visited: boolean = false,
        public adult_visited_with_other_tricks: boolean = false,
        public skipped: boolean = false,
        public checked: boolean = false,
        public alias: string = '',
        public shuffled: boolean = true,
        public is_hint: boolean = false,
        public is_shop: boolean = false,
        public holds_shop_refill: boolean = false,
        public is_restricted: boolean = false,
        public user_item: Item | null = null,
        public hint: Hint | null = null,
        public hint_text: string = '',
        public hinted: boolean = false,
        public viewable_if_unshuffled: boolean = false,
        public explicitly_collect_item: boolean = false,
        public public_event: boolean = false,
    ) {
        this.vanilla_item = !!vanilla_item_name ? ItemFactory(vanilla_item_name, this.world)[0] : null;
        if (this.type === "Event" || this.type === "GraphEvent" || this.name === "Gift from Sages") {
            this.internal = true;
            this.shuffled = false;
            if (viewable_events.includes(this.name)) this.public_event = true;
        }
        if (this.type.startsWith('Hint')) {
            this.shuffled = false;
        }
        if (Object.keys(display_names.location_aliases).includes(this.name)) {
            this.alias = display_names.location_aliases[this.name];
        } else {
            this.alias = this.name;
        }
        if (this.type.startsWith('Hint')) {
            this.is_hint = true;
        }
        if (this.type === 'Shop') {
            this.is_shop = true;
        }
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
            return rule(worldState, kwargs);
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

    dungeon(): string | null {
        return !!(this.parent_region) ? this.parent_region.dungeon : null; 
    }

    get hint_area(): string {
        if (this.parent_region === null || this.parent_region.parent_group === null) return '';
        let hint_group = this.parent_region.parent_group.parent_group !== null ?
            this.parent_region.parent_group.parent_group :
            this.parent_region.parent_group;
        if (hint_group.page === '') {
            type Spot = Entrance | Location | Region;
            let spot: Spot = this;
            let already_checked: Array<Spot> = [];
            let spot_queue: Array<Spot> = [spot];
            let fallback_spot_queue: Array<Spot> = [];
            let current_spot: Spot | undefined, parent_region: Region;
    
            while(spot_queue.length > 0 || fallback_spot_queue.length > 0) {
                if (spot_queue.length <= 0) {
                    spot_queue = fallback_spot_queue;
                    fallback_spot_queue = [];
                }
                current_spot = spot_queue.pop();
                if (!!current_spot) {
                    already_checked.push(current_spot);
    
                    if (current_spot instanceof Region) {
                        parent_region = current_spot;
                    } else {
                        if (!!(current_spot.parent_region)) {
                            parent_region = current_spot.parent_region;
                        } else {
                            throw(`Null parent region found when searching hint region for spot ${spot.name}`);
                        }
                    }
    
                    if (!!parent_region.parent_group) {
                        hint_group = parent_region.parent_group;
                        if (!!hint_group.parent_group) hint_group = hint_group.parent_group;
                        // Return the subgroup area name, but check the highest level group page
                        if (hint_group.page !== '') return parent_region.parent_group.name;
                    }
    
                    for (const entrance of parent_region.entrances) {
                        if (!(already_checked.includes(entrance))) {
                            if (!!(entrance.type) && ['OverworldOneWay', 'OwlDrop', 'Spawn', 'WarpSong'].includes(entrance.type)) {
                                fallback_spot_queue.push(entrance);
                            } else {
                                spot_queue.push(entrance);
                            }
                        }
                    }
                }
            }
            return '';
        } else {
            return hint_group.name;
        }
    }

    viewable(use_unshuffled_items_filter: boolean = false): boolean {
        return ((!this.internal && this.shuffled) || (use_unshuffled_items_filter && this.viewable_if_unshuffled && !this.skipped)) && !this.holds_shop_refill;
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

    get hint_locked(): boolean {
        return this.locked
            || !this.shuffled
            || (this.name === 'Boss Key (Ganons Castle)' && (['ToT Light Arrows Cutscene', 'Gift from Sages'].includes(this.name)))
            || (this.name === 'Song from Impa' && this.world.skip_child_zelda);
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
            let [type, vanilla_item, scene] = location_table[match_location];
            ret.push(new Location(match_location, type, null, false, world, vanilla_item, scene));
        } else {
            throw `Unknown location ${location}`;
        }
    }
    return ret;
}