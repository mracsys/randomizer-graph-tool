import { GraphRegion } from "../GraphPlugin.js";

import Entrance from './Entrance.js';
import { Location } from "./Location.js";
import World from './World.js';
import { Region } from "./Region.js";
import { display_names } from './DisplayNames.js';

export class RegionGroup implements GraphRegion {
    constructor(
        public name: string = '',
        public world: World,
        private first_region: Region,
        public sub_regions: Region[] = [],
        public entrances: Entrance[] = [],
        public exits: Entrance[] = [],
        public locations: Location[] = [],
        public alias: string = '',
    ) {
        for (let [group_alias, sub_regions] of Object.entries(display_names.region_groups)) {
            if (sub_regions.includes(this.first_region.name)) {
                this.alias = group_alias;
                break;
            }
        }
        this.add_region(this.first_region);
    }

    add_region(region: Region): void {
        this.sub_regions.push(region);
        region.parent_group = this;
    }
}