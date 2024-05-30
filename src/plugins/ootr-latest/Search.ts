import { TimeOfDay } from "./Region.js";
import type WorldState from "./WorldState.js";
import Entrance from "./Entrance.js";
import type { Region } from "./Region.js";
import { Location } from "./Location.js";
import type { Item } from "./Item.js";

type SearchCache = {
    child_queue: Entrance[],
    adult_queue: Entrance[],
    child_regions: Region[],
    adult_regions: Region[],
    child_tod: TimeOfDayMap,
    adult_tod: TimeOfDayMap,
    visited_locations: Set<Location>,
    visited_entrances: Set<Entrance>,
    spheres: { [sphere: number]: Location[] },
    pending_collection_locations: Location[],
    pending_inventory_locations: Set<Location>,
    pending_skipped_locations: Set<Location>,
};
type TimeOfDayMap = {
    [world_id: number]: {
        [region_name: string]: number,
    }
};
type SearchOptionalParams = {
    initial_cache?: SearchCache | null,
    with_tricks?: boolean,
    regions_only?: boolean,
    visit_all_entrances?: boolean;
    visit_all_connected_entrances?: boolean;
    visit_all_trick_entrances?: boolean;
}

class Search {
    public state_list: WorldState[];
    public _cache: SearchCache;
    cached_spheres: SearchCache[];
    public current_sphere: number;
    initial_cache: SearchCache | null;
    with_tricks: boolean;
    regions_only: boolean;

    constructor(state_list: WorldState[], 
    {
        initial_cache = null,
        with_tricks = false,
        regions_only = false,
    }: SearchOptionalParams = {}) {
        this.state_list = state_list;
        this.current_sphere = 0;
        this.initial_cache = initial_cache;
        this.with_tricks = with_tricks || regions_only;
        this.regions_only = regions_only;
        for (let state of this.state_list) {
            state.search = this;
        }
        // make typescript happy
        this._cache = {
            child_queue: [],
            adult_queue: [],
            visited_locations: new Set<Location>(),
            visited_entrances: new Set<Entrance>(),
            spheres: {},
            child_regions: [],
            adult_regions: [],
            child_tod: {},
            adult_tod: {},
            pending_collection_locations: [],
            pending_inventory_locations: new Set<Location>(),
            pending_skipped_locations: new Set<Location>(),
        }
        this.cached_spheres = [this._cache];
        // and do what typescript should have picked up on
        this.reset_cache();
    }

    reset_cache() {
        this.current_sphere = 0;
        this.reset_visits();
        if (this.initial_cache) {
            this._cache = this.initial_cache;
            this.cached_spheres = [this._cache];
        } else {
            let root_regions = this.state_list.map((state) => state.world.get_region('Root'));
            // create parallel ToD objects so that the child/adult maps
            // don't update each other after assignment
            let atod: TimeOfDayMap = {};
            let ctod: TimeOfDayMap = {};
            for (let region of root_regions) {
                if (region.world === null) throw `Invalid world for region ${region.name}`;
                if (!(region.world.id in atod)) atod[region.world.id] = {};
                atod[region.world.id][region.name] = TimeOfDay.NONE;
                if (!(region.world.id in ctod)) ctod[region.world.id] = {};
                ctod[region.world.id][region.name] = TimeOfDay.NONE;
            }
            this._cache = {
                child_queue: root_regions.flatMap((region) => region.exits),
                adult_queue: root_regions.flatMap((region) => region.exits),
                visited_locations: new Set<Location>(),
                visited_entrances: new Set<Entrance>(),
                spheres: {},
                child_regions: [...root_regions],
                adult_regions: [...root_regions],
                child_tod: ctod,
                adult_tod: atod,
                pending_collection_locations: [],
                pending_inventory_locations: new Set<Location>(),
                pending_skipped_locations: new Set<Location>(),
            };
            this.visit_pseudo_starting_items();
            this.cached_spheres = [this._cache];
            this.next_sphere();
        }
    }

    reset_visits() {
        if (this.with_tricks && !this.regions_only) {
            this.reset_tricked_visits();
        } else if (!this.regions_only) {
            this.reset_logical_visits();
        }
    }

    reset_logical_visits() {
        for (let state of this.state_list) {
            for (let entrance of state.world.get_entrances()) {
                entrance.visited = false;
            }
            for (let location of state.world.get_locations()) {
                location.visited = false;
            }
        }
    }

    reset_tricked_visits() {
        for (let state of this.state_list) {
            for (let entrance of state.world.get_entrances()) {
                entrance.visited_with_other_tricks = false;
            }
            for (let location of state.world.get_locations()) {
                location.visited_with_other_tricks = false;
            }
        }
    }

    reset_spheres() {
        for (let state of this.state_list) {
            for (let entrance of state.world.get_entrances()) {
                entrance.sphere = -1;
            }
            for (let location of state.world.get_locations()) {
                location.sphere = -1;
            }
        }
    }

    reset_states() {
        for (let state of this.state_list) {
            state.reset();
            state.collect_starting_items();
            state.world.collect_skipped_locations();
        }
        //this.collect_pseudo_starting_items();
    }

    static max_explore(state_list: WorldState[], {itempool = [], with_tricks = false}: {itempool?: Item[], with_tricks?: boolean} = {}): Search {
        let s = new Search(state_list);
        s.with_tricks = with_tricks;
        s.reset_visits();
        if (itempool.length > 0) {
            s.collect_all(itempool);
        }
        let max_locations = s.state_list.flatMap((state) => state.world.get_locations().filter((location) => { return !!location.item || location.shuffled }));
        s.collect_locations(max_locations);
        return s;
    }

    static with_items(state_list: WorldState[], itempool: Item[] = []): Search {
        let s = new Search(state_list);
        if (itempool.length > 0) {
            s.collect_all(itempool);
        }
        s.next_sphere();
        return s;
    }

    * iter_visited_regions() {
        for (let region of this._cache.adult_regions) {
            yield region;
        }
        for (let region of this._cache.child_regions) {
            yield region;
        }
    }

    collect_all(itempool: Item[]): void {
        for (let item of itempool) {
            if (item.world === null) throw `Failed to collect item ${item.name} for invalid world`;
            this.state_list[item.world.id].collect(item);
        }
    }

    collect(item: Item, add_to_progression: boolean = true, add_to_inventory: boolean = true): void {
        if (item.world === null) throw `Failed to collect item ${item.name} for invalid world`;
        this.state_list[item.world.id].collect(item, add_to_progression, add_to_inventory);
    }

    uncollect(item: Item): void {
        if (item.world === null) throw `Failed to uncollect item ${item.name} for invalid world`;
        this.state_list[item.world.id].remove(item);
    }

    _expand_regions(exit_queue: Entrance[], regions: Region[], tods: TimeOfDayMap, age: string): Entrance[] {
        let failed = [];
        // If this search is just determining region viewability for trackers, skip
        // entrance access rules for worlds where the user wants to always see every
        // region group.
        // Also handle connected overworld/warp entrances if selected and there is
        // a connected island somewhere that can't be reached from the root region,
        // and thus would not end up in the exit queue.
        if (this.regions_only) {
            for (let state of this.state_list) {
                if (state.world.visit_all_entrances) {
                    let all_regions = this.state_list.flatMap((state) => [...state.world.regions]);
                    regions.push(...all_regions);
                } else if (state.world.visit_all_connected_entrances) {
                    // Don't check for warps here, wait until the warp is available through the queue.
                    // Also don't add time of day as these could be hinted connections with no actual
                    // access yet.
                    let connected_regions = this.state_list.flatMap((state) => [...state.world.regions.filter(r => r.exits.filter(e => !!e.connected_region && e.shuffled).length)]);
                    regions.push(...connected_regions);
                    exit_queue.push(...connected_regions.flatMap(r => r.exits));
                }
            }
        }
        // Normal search
        for (let exit of exit_queue) {
            if (!!exit.connected_region && !(regions.includes(exit.connected_region))) {
                if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age})) {
                    if (exit.connected_region.provides_time && !((tods[exit.world.id][exit.world.get_region('Root').name] & exit.connected_region.provides_time) === exit.connected_region.provides_time)) {
                        exit_queue.push(...failed);
                        failed = [];
                        tods[exit.world.id][exit.world.get_region('Root').name] |= exit.connected_region.provides_time;
                    }
                    this._cache.visited_entrances.add(exit);
                    if (!this.regions_only) exit.set_visited(this.with_tricks);
                    regions.push(exit.connected_region);
                    tods[exit.world.id][exit.connected_region.name] |= exit.connected_region.provides_time;
                    exit_queue.push(...exit.connected_region.exits);
                } else {
                    failed.push(exit);
                    // If the user for this exit's world wants to always show regions for
                    // which they have found an entrance, add it to the list and assume
                    // the user has found a repeatable way there for time-of-day. This
                    // only affects region viewability for trackers, not location logic.
                    if (exit.world.visit_all_connected_entrances && this.regions_only && (exit.shuffled || exit.is_warp)) {
                        regions.push(exit.connected_region);
                        tods[exit.world.id][exit.connected_region.name] |= exit.connected_region.provides_time;
                        exit_queue.push(...exit.connected_region.exits);
                    }
                }
            } else if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age})) {
                if (exit.connected_region === null) {
                    failed.push(exit);
                }
                this._cache.visited_entrances.add(exit);
                if (!this.regions_only) exit.set_visited(this.with_tricks);
            }
        }
        return failed;
    }

    _expand_tod_regions(regions: Region[], tods: TimeOfDayMap, goal_region: Region, age: string, tod: number): boolean {
        let has_tod_world = (r: Region): boolean => { return !!r.world && !!goal_region.world && r.world.id === goal_region.world.id && (tods[r.world.id][r.name] & tod) !== 0 };
        let exit_queue = regions.filter(has_tod_world).flatMap((r) => r.exits);
        for (let exit of exit_queue) {
            if (!!exit.connected_region && !!exit.world && regions.includes(exit.connected_region) && exit.connected_region.name in tods[exit.world.id]) {
                if (tod & ~tods[exit.world.id][exit.connected_region.name]) {
                    if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age, 'tod': tod})) {
                        tods[exit.world.id][exit.connected_region.name] |= tod;
                        if (exit.connected_region === goal_region) {
                            return true;
                        }
                        exit_queue.push(...exit.connected_region.exits);
                    }
                }
            }
        }
        return false;
    }

    next_sphere(): [Region[], Region[], Set<Location>] {
        this._cache.adult_queue = this._expand_regions(this._cache.adult_queue, this._cache.adult_regions, this._cache.adult_tod, 'adult');
        this._cache.child_queue = this._expand_regions(this._cache.child_queue, this._cache.child_regions, this._cache.child_tod, 'child');
        return [this._cache.child_regions, this._cache.adult_regions, this._cache.visited_locations];
    }

    * iter_reachable_locations(item_locations: Location[]) {
        let had_reachable_locations = true;
        while (had_reachable_locations) {
            let [child_regions, adult_regions, visited_locations] = this.next_sphere();
            had_reachable_locations = false;
            for (let l of item_locations) {
                if (!(visited_locations.has(l)) && !!l.parent_region && !!l.world) {
                    if (adult_regions.includes(l.parent_region) && l.access_rule(this.state_list[l.world.id], {'spot': l, 'age': 'adult'})) {
                        if (!!l.item && (l.checked || !l.world.collect_checked_only || !(l.viewable()))) {
                            had_reachable_locations = true;
                            visited_locations.add(l);
                        }
                        if (!this.regions_only) l.set_visited(this.with_tricks);
                        yield l;
                    } else if (child_regions.includes(l.parent_region) && l.access_rule(this.state_list[l.world.id], {'spot': l, 'age': 'child'})) {
                        if (!!l.item && (l.checked || !l.world.collect_checked_only || !(l.viewable()))) {
                            had_reachable_locations = true;
                            visited_locations.add(l);
                        }
                        if (!this.regions_only) l.set_visited(this.with_tricks);
                        yield l;
                    // Collect completely out of logic checks if the player obtains them, such as
                    // using glitches to bypass glitchless logic. Only apply to tricked searches
                    // to preserve logical state in the main world.
                    } else if (l.checked && this.with_tricks) {
                        if (!!l.item) {
                            had_reachable_locations = true;
                            visited_locations.add(l);
                        }
                        if (!this.regions_only) l.set_visited(this.with_tricks);
                        yield l;
                    }
                }
            }
        }
    }

    collect_locations(locations: Location[] | null = null) {
        // update player inventory with known items that are now checked
        let new_pending_locations: Location[] = [];
        for (let location of this._cache.pending_collection_locations) {
            if (location.checked && !!location.item) {
                this.collect(location.item, false, true);
            } else {
                new_pending_locations.push(location);
            }
        }
        this._cache.pending_collection_locations = new_pending_locations;
        let l = !!locations ? locations : this.progression_locations();
        // Collect checked locations regardless of logic if desired by the user ("race mode")
        // Applies to all worlds if enabled for any world.
        let race_mode = this.state_list.some((state) => state.world.collect_as_starting_items);
        if (race_mode) {
            this.reset_states();
            for (let location of l) {
                if (location.checked && !!location.item) this.collect(location.item);
            }
        }
        // Pending starting items have to be collected after race mode checks
        // to handle the state reset
        this.check_pending_starting_items();
        // search world for items and events to collect
        for (let location of this.iter_reachable_locations(l)) {
            if (!!location.item && ((location.checked && !race_mode) || !location.world.collect_checked_only || !(location.viewable()) || location.skipped)) {
                if (!location.checked && location.explicitly_collect_item && !location.skipped) {
                    this.collect(location.item, true, false);
                    this._cache.pending_collection_locations.push(location);
                } else {
                    if (this._cache.pending_inventory_locations.has(location)) {
                        this.collect(location.item, true, false);
                        this._cache.pending_inventory_locations.delete(location);
                    } else {
                        this.collect(location.item);
                    }
                }
            }
        }
        // Add checked out-of-logic locations to inventory if
        // they aren't being dumped into the starting inventory.
        if (!race_mode) {
            for (let location of l) {
                if (!(this._cache.visited_locations.has(location)) && !(this._cache.pending_inventory_locations.has(location)) && location.checked && !!location.item) {
                    this.collect(location.item, false, true);
                    this._cache.pending_inventory_locations.add(location);
                }
            }
        }
    }

    // changes to the world may have changed earlier spheres,
    // so this method has to run from sphere 0 every time
    collect_spheres(locations: Location[] | null = null) {
        this.reset_cache();
        this.check_pending_starting_items();
        //this.collect_pseudo_starting_items();
        let l = !!locations ? locations : this.progression_locations();
        let remaining_entrances = new Set(this.state_list.flatMap((state) => state.world.get_entrances()));
        let unaccessed_entrances: Set<Entrance>;
        let collected;
        while (true) {
            collected = Array.from(this.iter_reachable_locations(l));
            if (collected.length === 0) {
                break;
            }
            unaccessed_entrances = new Set();
            for (let e of remaining_entrances) {
                if (this.spot_access(e)) {
                    e.sphere = this.current_sphere;
                } else {
                    unaccessed_entrances.add(e);
                }
            }
            remaining_entrances = unaccessed_entrances;
            this._cache.spheres[this.current_sphere] = collected;
            for (let location of collected) {
                location.sphere = this.current_sphere;
                if (!!(location.item)) {
                    this.collect(location.item);
                }
            }
            this.current_sphere++;
        }
    }


    * iter_pseudo_starting_locations() {
        for (let state of this.state_list) {
            for (let location of state.world.skipped_locations) {
                this._cache.visited_locations.add(location);
                yield location;
            }
        }
    }

    visit_pseudo_starting_items() {
        for (let location of this.iter_pseudo_starting_locations()) {
            this._cache.pending_skipped_locations.add(location);
            location.sphere = -1;
            this._cache.visited_locations.add(location);
            if (!this.regions_only) location.set_visited(this.with_tricks);
        }
    }

    check_pending_starting_items() {
        // check skipped locations that didn't have items set at search start
        let new_skipped_locations = new Set<Location>();
        for (let location of this._cache.pending_skipped_locations) {
            if (!!location.item) {
                this.collect(location.item);
            } else {
                new_skipped_locations.add(location);
            }
        }
        this._cache.pending_skipped_locations = new_skipped_locations;
    }

    collect_pseudo_starting_items() {
        for (let location of this.iter_pseudo_starting_locations()) {
            if (!!(location.item)) {
                this.collect(location.item);
            } else {
                this._cache.pending_skipped_locations.add(location);
            }
            location.sphere = -1;
            this._cache.visited_locations.add(location);
            if (!this.regions_only) location.set_visited(this.with_tricks);
        }
    }

    visit_locations(locations: Location[] | null = null) {
        let l = !!locations ? locations : this.progression_locations();
        for (let location of this.iter_reachable_locations(l)) {
            // pass
        }
    }

    progression_locations() {
        return this.state_list.flatMap((state) => state.world.get_locations().filter((location) => { return !!location.item && location.item.advancement; }));
    }

    can_reach(region: Region, age: string | null = null, tod: number = TimeOfDay.NONE): boolean {
        if (region.world === null) throw `Invalid world for region ${region.name}`;
        if (age === 'adult') {
            if (Object.keys(this._cache.adult_tod).includes(''+region.world.id)) {
                if (Object.keys(this._cache.adult_tod[region.world.id]).includes(region.name)) {
                    if (tod) {
                        return (this._cache.adult_tod[region.world.id][region.name] & tod) === tod || this._expand_tod_regions(this._cache.adult_regions, this._cache.adult_tod, region, age, tod);
                    } else {
                        return true;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else if (age === 'child') {
            if (Object.keys(this._cache.child_tod).includes(''+region.world.id)) {
                if (Object.keys(this._cache.child_tod[region.world.id]).includes(region.name)) {
                    if (tod) {
                        return (this._cache.child_tod[region.world.id][region.name] & tod) === tod || this._expand_tod_regions(this._cache.child_regions, this._cache.child_tod, region, age, tod);
                    } else {
                        return true;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else if (age === 'both') {
            return this.can_reach(region, 'adult', tod) && this.can_reach(region, 'child', tod);
        } else {
            return this.can_reach(region, 'adult', tod) || this.can_reach(region, 'child', tod);
        }
    }

    spot_access(spot: Entrance | Location, age: string | null = null, tod: number = TimeOfDay.NONE): boolean {
        if (spot.parent_region === null) return false;
        if (age === 'adult' || age === 'child') {
            return (
                this.can_reach(spot.parent_region, age, tod) &&
                spot.access_rule(this.state_list[spot.world.id], {age: age, spot: spot, tod: tod})
            );
        } else if (age === 'both') {
            return (
                this.can_reach(spot.parent_region, age, tod) &&
                spot.access_rule(this.state_list[spot.world.id], {age: 'adult', spot: spot, tod: tod}) &&
                spot.access_rule(this.state_list[spot.world.id], {age: 'child', spot: spot, tod: tod})
            );
        } else {
            return (
                (this.can_reach(spot.parent_region, 'adult', tod) &&
                spot.access_rule(this.state_list[spot.world.id], {age: 'adult', spot: spot, tod: tod})) ||
                (this.can_reach(spot.parent_region, 'child', tod) &&
                spot.access_rule(this.state_list[spot.world.id], {age: 'child', spot: spot, tod: tod}))
            );
        }
    }

    visited(location: Location): boolean {
        return (this._cache.visited_locations.has(location));
    }
}

export default Search;