import { GraphRegion, GraphHintGoal } from "../GraphPlugin.js";

import Entrance from './Entrance.js';
import { Location } from "./Location.js";
import World from './World.js';
import { Region } from "./Region.js";
import { display_names } from './DisplayNames.js';
import { Item } from "./Item.js";
import { Boulder } from "./Boulders.js";

export class RegionGroup implements GraphRegion {
    constructor(
        public name: string = '',
        public world: World,
        public parent_group: RegionGroup | null = null,
        public sub_groups: RegionGroup[] = [],
        public _sub_regions: Region[] = [],
        public _entrances: Entrance[] = [],
        public _exits: Entrance[] = [],
        public _locations: Location[] = [],
        public boulders: Boulder[] = [],
        public alias: string = '',
        public page: string = 'Overworld',
        public viewable: boolean = false,
        public hint_names: string[] = [],
        public is_required: boolean = false,
        public required_for: GraphHintGoal[] = [],
        public is_not_required: boolean = false,
        public hinted_items: Item[] = [],
        public num_major_items: number | null = null,
    ) {
        this.alias = this.name;
        if (Object.keys(display_names.region_aliases).includes(this.alias)) {
            this.alias = display_names.region_aliases[this.alias];
        }
    }

    get child_regions(): RegionGroup[] {
        return this.sub_groups;
    }

    get sub_regions(): Region[] {
        let region_list: Region[] = [...this._sub_regions];
        if (this.sub_groups.length > 0) {
            region_list.push(...this.sub_groups.flatMap(r => r._sub_regions))
        }
        return region_list;
    }

    get entrances(): Entrance[] {
        let entrance_list: Entrance[] = [...this._entrances];
        if (this.sub_groups.length > 0) {
            entrance_list.push(...this.sub_groups.flatMap(r => r._entrances))
        }
        return entrance_list;
    }

    get exits(): Entrance[] {
        let exit_list: Entrance[] = [...this._exits];
        if (this.sub_groups.length > 0) {
            exit_list.push(...this.sub_groups.flatMap(r => r._exits))
        }
        return exit_list;
    }

    get locations(): Location[] {
        let location_list: Location[] = [...this._locations];
        if (this.sub_groups.length > 0) {
            location_list.push(...this.sub_groups.flatMap(r => r._locations))
        }
        return location_list;
    }

    get local_entrances(): Entrance[] {
        return [...this._entrances];
    }

    get local_exits(): Entrance[] {
        return [...this._exits];
    }

    get local_locations(): Location[] {
        return [...this._locations];
    }

    get is_hint_region(): boolean {
        return this.hint_names.length > 0;
    }

    // I was half awake writing this. Probably nonsense.
    get nested_locations(): Location[] {
        let all_locations = this.locations;
        let visited_regions = this.sub_regions;
        let exit_queue = this.exits;
        let exit: Entrance | undefined;
        while (exit_queue.length > 0) {
            exit = exit_queue.pop();
            if (!!exit && !!exit.connected_region && !(visited_regions.includes(exit.connected_region))
                // indoors region
                && exit.connected_region.parent_group?.page === ''
                // indoors subregion (does not exist yet, added for completeness)
                && (exit.connected_region.parent_group?.parent_group === null || exit.connected_region.parent_group?.parent_group?.page === '')
                // Hack to prevent Temple of Time regions from getting added to Market group
                && (exit.connected_region.hint_name === '' || exit.connected_region.hint_name === null || this.hint_names.includes(exit.connected_region.hint_name))) {
                // Check if the first exit from the target leads to a top-level group
                let visited_region: Region | RegionGroup | null = exit.connected_region;
                if (!!visited_region && visited_region.exits.length > 0) {
                    visited_region = visited_region.exits[0].connected_region;
                } else {
                    visited_region = null;
                }
                // Convert the exit group to from a subgroup to top-level if necessary
                if (!!visited_region) visited_region = visited_region.parent_group;
                if (!!visited_region && visited_region.parent_group !== null) visited_region = visited_region.parent_group;
                // Only add nested regions that aren't already in a top-level group,
                // or that are in this top-level group.
                let this_region_name = !!this.parent_group ? this.parent_group.name : this.name;
                if (visited_region === undefined || visited_region === null || visited_region.page === '' || visited_region.name === this_region_name) {
                    visited_regions.push(exit.connected_region);
                    exit_queue.push(...exit.connected_region.exits);
                    all_locations.push(...exit.connected_region.locations);
                }
            }
        }
        return all_locations;
    }

    add_region(region: Region): void {
        this._sub_regions.push(region);
        if (this.parent_group === null) {
            region.parent_group = this;
            if (region.dungeon) this.page = 'Dungeons';
        } else {
            region.parent_group = this;
            this.page = this.parent_group.page;
        }
        for (let exit of region.exits) {
            if (!!exit.type && exit.type !== 'Extra') {
                this._exits.push(exit);
            }
        }
        for (let entrance of region.entrances) {
            if (!!entrance.type) {
                this._entrances.push(entrance);
            }
        }
        for (let location of region.locations) {
            if ((location.type !== 'Event' || location.public_event) && location.type !== 'Drop') {
                this._locations.push(location);
            }
        }
        if (!!region.hint_name && !(this.hint_names.includes(region.hint_name))) {
            this.hint_names.push(region.hint_name);
        }
    }

    get_new_sub_group(name: string): RegionGroup {
        let sub_group = this.sub_groups.filter(r => r.name === name);
        if (sub_group.length === 1) {
            return sub_group[0];
        } else if (sub_group.length === 0) {
            let new_group = new RegionGroup(name, this.world, this);
            this.sub_groups.push(new_group);
            return new_group;
        } else {
            throw(`Multiple region group definitions for subgroup ${name}`);
        }
    }

    sort_lists(): void {
        let location_order = Object.keys(display_names.location_aliases);
        let entrance_order = Object.keys(display_names.entrance_aliases);
        this._locations.sort((a, b) => location_order.findIndex(l => l === a.name) - location_order.findIndex(l => l === b.name));
        this._exits.sort((a, b) => entrance_order.findIndex(e => e === a.name) - entrance_order.findIndex(e => e === b.name));
    }

    update_exits(): void {
        for (let region of this._sub_regions) {
            for (let exit of region.exits) {
                if (!!exit.type && exit.type !== 'Extra') {
                    this._exits.push(exit);
                }
            }
            for (let entrance of region.entrances) {
                if (!!entrance.type) {
                    this._entrances.push(entrance);
                    // Set reverse interior source groups
                    if (entrance.source_group === null && !!entrance.parent_region.parent_group) {
                        entrance.source_group = entrance.parent_region.parent_group;
                    }
                }
            }
        }
    }

    get_sub_group_for_exit(e: Entrance): RegionGroup | null {
        // assumes the exit is contained in this group or its subgroups
        if (this._exits.includes(e)) {
            return this;
        } else {
            for (let sub_group of this.sub_groups) {
                if (sub_group._exits.includes(e)) {
                    return sub_group;
                }
            }
        }
        return null;
    }

    connect_entrance_from_sub_region(r: Region, e: Entrance): void {
        if (this._sub_regions.includes(r)) {
            this._entrances.push(e);
        } else if (this.sub_groups.length > 0) {
            let pushes = 0;
            for (let sub_group of this.sub_groups) {
                if (sub_group._sub_regions.includes(r)) {
                    sub_group._entrances.push(e);
                    pushes++;
                }
            }
            if (pushes <= 0) {
                throw(`Failed to connect entrance ${e.name} to ${this.name}: Entrance does not exist in region group`);
            }
        } else {
            throw(`Failed to connect entrance ${e.name} to ${this.name}: Entrance connected region does not exist in region group`)
        }
    }

    disconnect_entrance_from_sub_region(r: Region, e: Entrance): void {
        if (this._sub_regions.includes(r)) {
            if (!this.disconnect_entrance(e)) {
                throw(`Failed to disconnect entrance ${e.name} from ${this.name}: Entrance does not exist in region group`);
            };
        } else if (this.sub_groups.length > 0) {
            let splices = 0;
            for (let sub_group of this.sub_groups) {
                if (sub_group._sub_regions.includes(r)) {
                    sub_group.disconnect_entrance(e);
                    splices++;
                }
            }
            if (splices <= 0) {
                throw(`Failed to disconnect entrance ${e.name} from ${this.name}: Entrance does not exist in region group`);
            }
        } else {
            throw(`Failed to disconnect entrance ${e.name} from ${this.name}: Entrance connected region does not exist in region group`)
        }
    }

    disconnect_entrance(e: Entrance): boolean {
        let i = this._entrances.indexOf(e);
        if (i > -1) {
            this._entrances.splice(i, 1);
            return true;
        } else {
            return false;
        }
    }
}