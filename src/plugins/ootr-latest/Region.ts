import { GraphRegion } from "../GraphPlugin.js";

import { HintAreas } from "./Hints.js";
import Entrance from './Entrance.js';
import { Location } from "./Location.js";
import World from './World.js';

export const TimeOfDay = {
    NONE: 0,
    DAY: 1,
    DAMPE: 2,
    ALL: 3,
};

const RegionType = {
    OVERWORLD: 1,
    INTERIOR: 2,
    DUNGEON: 3,
    GROTTO: 4,
}

export class Region implements GraphRegion {
    constructor(
        public name: string = '',
        public world: World,
        public type: number = RegionType.OVERWORLD,
        public entrances: Entrance[] = [],
        public exits: Entrance[] = [],
        public locations: Location[] = [],
        public dungeon: string | null = null,
        public hint_name: string | null = null,
        public alt_hint_name: string | null = null,
        public time_passes: boolean = false,
        public provides_time: number = TimeOfDay.NONE,
        public scene: string | null = null,
        public is_boss_room: boolean = false,
        public savewarp: Entrance | null = null,
    ) {}

    hint() {
        if (!!this.hint_name) {
            return HintAreas[this.hint_name];
        }
        if (this.dungeon) {
            return HintAreas[this.dungeon.toUpperCase().replaceAll(' ', '_')];
        }
        return null;
    }

    alt_hint() {
        if (!!this.alt_hint_name) {
            return HintAreas[this.alt_hint_name];
        }
        return null;
    }
}