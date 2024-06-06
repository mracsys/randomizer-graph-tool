import { GraphRegion, GraphHintGoal } from "../GraphPlugin.js";

import Entrance from './Entrance.js';
import { Location } from "./Location.js";
import World from './World.js';
import { Region } from "./Region.js";
import { display_names } from './DisplayNames.js';
import { Item } from "./Item.js";

export class RegionGroup implements GraphRegion {
    constructor(
        public name: string = '',
        public world: World,
        public sub_regions: Region[] = [],
        public entrances: Entrance[] = [],
        public exits: Entrance[] = [],
        public locations: Location[] = [],
        public alias: string = '',
        public page: string = 'Overworld',
        public viewable: boolean = false,
        public is_required: boolean = false,
        public required_for: GraphHintGoal[] = [],
        public is_not_required: boolean = false,
        public hinted_items: Item[] = [],
        public num_major_items: number | null = null,
    ) {
        this.alias = this.name;
    }

    add_region(region: Region): void {
        this.sub_regions.push(region);
        region.parent_group = this;
        if (region.dungeon) this.page = 'Dungeons';
        for (let exit of region.exits) {
            if (!!exit.type && exit.type !== 'Extra') {
                this.exits.push(exit);
            }
        }
        for (let entrance of region.entrances) {
            if (!!entrance.type) {
                this.entrances.push(entrance);
            }
        }
        for (let location of region.locations) {
            if ((location.type !== 'Event' || location.public_event) && location.type !== 'Drop') {
                this.locations.push(location);
            }
        }
    }

    sort_lists(): void {
        let location_order = Object.keys(display_names.location_aliases);
        let entrance_order = Object.keys(display_names.entrance_aliases);
        this.locations.sort((a, b) => location_order.findIndex(l => l === a.name) - location_order.findIndex(l => l === b.name));
        this.exits.sort((a, b) => entrance_order.findIndex(e => e === a.name) - entrance_order.findIndex(e => e === b.name));
    }

    update_exits(): void {
        for (let region of this.sub_regions) {
            for (let exit of region.exits) {
                if (!!exit.type && exit.type !== 'Extra') {
                    this.exits.push(exit);
                }
            }
            for (let entrance of region.entrances) {
                if (!!entrance.type) {
                    this.entrances.push(entrance);
                    // Set reverse interior source groups
                    if (entrance.source_group === null && !!entrance.parent_region.parent_group) {
                        entrance.source_group = entrance.parent_region.parent_group;
                    }
                }
            }
        }
    }
}