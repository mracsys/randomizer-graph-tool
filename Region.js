const { HintAreas } = require("./Hints");

class TimeOfDay {
    static NONE =  0;
    static DAY = 1;
    static DAMPE = 2;
    static ALL = this.DAY | this.DAMPE;
}

const RegionType = {
    OVERWORLD: 1,
    INTERIOR: 2,
    DUNGEON: 3,
    GROTTO: 4,
}

class Region {
    constructor(name='', { type=RegionType.OVERWORLD } = {}) {
        this.name = name;
        this.type = type;
        this.entrances = [];
        this.exits = [];
        this.locations = [];
        this.dungeon = null;
        this.world = null;
        this.hint_name = null;
        this.alt_hint_name = null;
        this.price = null;
        this.time_passes = false;
        this.provides_time = TimeOfDay.NONE;
        this.scene = null;
        this.is_boss_room = false;
        this.savewarp = null;
    }

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

module.exports = { TimeOfDay, Region };