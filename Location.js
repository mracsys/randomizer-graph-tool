const { location_table } = require('./LocationList.js');
const { ItemFactory } = require('./Item.js')

const DisableType = {
    ENABLED: 0,
    PENDING: 1,
    DISABLED: 2,
}

class Location {
    constructor({
            name='',
            address=null,
            address2=null,
            _default=null,
            type='Chest',
            scene=null,
            parent=null,
            filter_tags=null,
            internal=false,
            vanilla_item=null,
        } = {}) {
        this.name = name;
        this.parent_region = parent;
        this.item = null;
        this.vanilla_item = !!vanilla_item ? ItemFactory(vanilla_item) : null;
        this.address = address;
        this.address2 = address2;
        this._default = _default;
        this.type = type;
        this.scene = scene;
        this.internal = internal;
        this.staleness_count = 0;
        this.access_rule = (worldState, { age = null, spot = null, tod = null } = {}) => true;
        this.access_rules = [];
        this.item_rule = (location, item) => true;
        this.locked = false;
        this.price = null;
        this.minor_only = false;
        this.world = null;
        this.disabled = DisableType.ENABLED;
        this.always = false;
        this.never = false;
        if (filter_tags === null) {
            this.filter_tags = null;
        } else if (typeof(filter_tags) === 'string') {
            this.filter_tags = [filter_tags];
        } else {
            this.filter_tags = [...filter_tags];
        }
    }

    add_rule(rule) {
        if (this.always) {
            this.set_rule(rule);
            this.always = false;
            return;
        }
        if (this.never) {
            return;
        }
        this.access_rules.push(rule);
        this.access_rule = this._run_rules;
    }

    _run_rules(worldState, kwargs) {
        return this.access_rules.every((rule) => {
            return rule(worldState, kwargs);
        });
    }

    set_rule(rule) {
        this.access_rule = rule;
        this.access_rules = [rule];
    }

    dungeon() {
        return !!(this.parent_region) ? this.parent_region.dungeon : null; 
    }
}

function LocationFactory(locations, world=null) {
    let ret = [];
    let singleton = false;
    let locations_to_build = locations;
    if (typeof(locations_to_build) === 'string') {
        locations_to_build = [locations_to_build];
        singleton = true;
    }
    for (let location of locations_to_build) {
        let match_location;
        if (Object.keys(location_table).includes(location)) {
            match_location = location;
        } else {
            match_location = location_table.filter((k) => k.toLowerCase() === location.toLowerCase())[0];
        }
        if (match_location) {
            [type, scene, def, addresses, vanilla_item, filter_tags] = location_table[match_location];
            ret.push(new Location({ name: match_location, _default: def, type: type, scene: scene, filter_tags: filter_tags, vanilla_item: vanilla_item }));
        } else {
            throw `Unknown location ${location}`;
        }
    }
    if (singleton) {
        return ret[0];
    }
    return ret;
}

module.exports = {
    Location,
    LocationFactory
};