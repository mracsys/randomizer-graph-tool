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
};
type TimeOfDayMap = {
    [world_id: number]: {
        [region_name: string]: number,
    }
}


class Search {
    public state_list: WorldState[];
    public _cache: SearchCache;
    cached_spheres: SearchCache[];

    constructor(state_list: WorldState[], initial_cache=null) {
        this.state_list = state_list;

        for (let state of this.state_list) {
            state.search = this;
        }

        if (initial_cache) {
            this._cache = initial_cache;
            this.cached_spheres = [this._cache];
        } else {
            let root_regions = this.state_list.map((state) => state.world.get_region('Root'));
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
            };
            this.cached_spheres = [this._cache];
            this.next_sphere();
        }
    }

    collect_all(itempool: Item[]): void {
        for (let item of itempool) {
            if (item.world === null) throw `Failed to collect item ${item.name} for invalid world`;
            this.state_list[item.world.id].collect(item);
        }
    }

    collect(item: Item): void {
        if (item.world === null) throw `Failed to collect item ${item.name} for invalid world`;
        this.state_list[item.world.id].collect(item);
    }

    uncollect(item: Item): void {
        if (item.world === null) throw `Failed to collect item ${item.name} for invalid world`;
        this.state_list[item.world.id].remove(item);
    }

    _expand_regions(exit_queue: Entrance[], regions: Region[], tods: TimeOfDayMap, age: string): Entrance[] {
        let failed = [];
        for (const exit of exit_queue) {
            if (!!exit.connected_region && !(regions.includes(exit.connected_region))) {
                if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age})) {
                    if (exit.connected_region.provides_time && !((tods[exit.world.id][exit.world.get_region('Root').name] & exit.connected_region.provides_time) === exit.connected_region.provides_time)) {
                        exit_queue.push(...failed);
                        failed = [];
                        tods[exit.world.id][exit.world.get_region('Root').name] |= exit.connected_region.provides_time;
                    }
                    this._cache.visited_entrances.add(exit);
                    regions.push(exit.connected_region);
                    tods[exit.world.id][exit.connected_region.name] |= exit.connected_region.provides_time;
                    exit_queue.push(...exit.connected_region.exits);
                } else {
                    failed.push(exit);
                }
            } else if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age})) {
                this._cache.visited_entrances.add(exit);
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
                        had_reachable_locations = true;
                        visited_locations.add(l);
                        yield l;
                    } else if (child_regions.includes(l.parent_region) && l.access_rule(this.state_list[l.world.id], {'spot': l, 'age': 'child'})) {
                        had_reachable_locations = true;
                        visited_locations.add(l);
                        yield l;
                    }
                }
            }
        }
    }

    collect_locations(locations=null) {
        let l = !!locations ? locations : this.progression_locations();
        for (let location of this.iter_reachable_locations(l)) {
            if (!!(location.item)) {
                this.collect(location.item);
            }
        }
    }

    collect_spheres(locations=null) {
        this.collect_pseudo_starting_items();
        let l = !!locations ? locations : this.progression_locations();
        let collected;
        let sphere = 0;
        while (true) {
            collected = Array.from(this.iter_reachable_locations(l));
            if (collected.length === 0) {
                break;
            }
            this._cache.spheres[sphere] = collected;
            for (let location of collected) {
                location.sphere = sphere;
                if (!!(location.item)) {
                    this.collect(location.item);
                }
            }
            sphere++;
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

    collect_pseudo_starting_items() {
        for (let location of this.iter_pseudo_starting_locations()) {
            if (!!(location.item)) {
                location.sphere = -1;
                this.collect(location.item);
            }
        }
    }

    visit_locations(locations=null) {
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

    visited(location: Location): boolean {
        return (this._cache.visited_locations.has(location));
    }
}

export default Search;