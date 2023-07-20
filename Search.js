const { TimeOfDay } = require("./Region");

class Search {
    constructor(state_list, initial_cache=null) {
        this.state_list = state_list;

        for (let state of this.state_list) {
            state.search = this;
        }

        if (initial_cache) {
            this._cache = initial_cache;
            this.cached_spheres = [this._cache];
        } else {
            let root_regions = this.state_list.map((state) => state.world.get_region('Root'));
            let atod = {};
            let ctod = {};
            for (let region of root_regions) {
                atod[region.world.id] = {};
                atod[region.world.id][region.name] = TimeOfDay.NONE;
                ctod[region.world.id] = {};
                ctod[region.world.id][region.name] = TimeOfDay.NONE;
            }

            this._cache = {
                child_queue: root_regions.flatMap((region) => region.exits),
                adult_queue: root_regions.flatMap((region) => region.exits),
                visited_locations: new Set(),
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

    collect_all(itempool) {
        for (let item of itempool) {
            this.state_list[item.world.id].collect(item);
        }
    }

    collect(item) {
        this.state_list[item.world.id].collect(item);
    }

    uncollect(item) {
        this.state_list[item.world.id].remove(item);
    }

    _expand_regions(exit_queue, regions, tods, age) {
        let failed = [];
        for (const exit of exit_queue) {
            if (!!exit.connected_region && !(regions.includes(exit.connected_region))) {
                if (exit.access_rule(this.state_list[exit.world.id], {'spot': exit, 'age': age})) {
                    if (exit.connected_region.provides_time && !(tods[exit.world.id][exit.world.get_region('Root').name] & exit.connected_region.provides_time === exit.connected_region.provides_time)) {
                        exit_queue.push(...failed);
                        failed = [];
                        tods[exit.world.id][exit.world.get_region('Root').name] |= exit.connected_region.provides_time;
                    }
                    regions.push(exit.connected_region);
                    tods[exit.world.id][exit.connected_region.name] |= exit.connected_region.provides_time;
                    exit_queue.push(...exit.connected_region.exits);
                } else {
                    failed.push(exit);
                }
            }
        }
        return failed;
    }

    _expand_tod_regions(regions, tods, goal_region, age, tod) {
        let has_tod_world = (r) => { return r.world.id === goal_region.world.id && tods[r.world.id][r.name] & tod };
        let exit_queue = regions.filter(has_tod_world).flatMap((r) => r.exits);
        for (let exit of exit_queue) {
            if (!!exit.connected_region && regions.includes(exit.connected_region) && exit.connected_region.name in tods[exit.world.id]) {
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

    next_sphere() {
        this._cache.adult_queue = this._expand_regions(this._cache.adult_queue, this._cache.adult_regions, this._cache.adult_tod, 'adult');
        this._cache.child_queue = this._expand_regions(this._cache.child_queue, this._cache.child_regions, this._cache.child_tod, 'child');
        return [this._cache.child_regions, this._cache.adult_regions, this._cache.visited_locations];
    }

    * iter_reachable_locations(item_locations) {
        let had_reachable_locations = true;
        while (had_reachable_locations) {
            let [child_regions, adult_regions, visited_locations] = this.next_sphere();
            had_reachable_locations = false;
            for (let l of item_locations) {
                if (!(visited_locations.has(l))) {
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

    can_reach(region, age=null, tod=TimeOfDay.NONE) {
        if (age === 'adult') {
            if (Object.keys(this._cache.adult_tod).includes(''+region.world.id)) {
                if (Object.keys(this._cache.adult_tod[region.world.id]).includes(region.name)) {
                    if (tod) {
                        return this._cache.adult_tod[region.world.id][region.name] & tod || this._expand_tod_regions(this._cache.adult_regions, this._cache.adult_tod, region, age, tod);
                    } else {
                        return true;
                    }
                }
            } else {
                return false;
            }
        } else if (age === 'child') {
            if (Object.keys(this._cache.child_tod).includes(''+region.world.id)) {
                if (Object.keys(this._cache.child_tod[region.world.id]).includes(region.name)) {
                    if (tod) {
                        return this._cache.child_tod[region.world.id][region.name] & tod || this._expand_tod_regions(this._cache.child_regions, this._cache.child_tod, region, age, tod);
                    } else {
                        return true;
                    }
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

    visited(location) {
        return (this._cache.visited_locations.has(location));
    }
}

module.exports = Search;