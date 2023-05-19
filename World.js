const Location = require("./Location.js");
const { Region } = require("./Region.js");
const RuleParser = require("./RuleParser.js");

class World {
    constructor(id=0) {
        this.settings = {
            keyring_give_bk: false,
            bridge: 'vanilla',
            logic_no_night_tokens_without_suns_song: false,
        };
        this.id = id;
        this.dungeons = [];
        this.regions = [];
        this.itempool = [];
        this._cached_locations = null;
        this._entrance_cache = {};
        this._region_cache = {};
        this._location_cache = {};

        this.parser = new RuleParser();
        this.event_items = new Set();

        this.triforce_hunt = false;
        this.ensure_tod_access = true;
        this.skipped_trials = {
            'Forest': true,
            'Fire': false,
            'Water': false,
            'Shadow': false,
            'Spirit': false,
            'Light': false,
        };
        //this.logic_no_night_tokens_without_suns_song = false;
        //this.bridge = 'vanilla';
    }

    create_internal_locations() {
        this.parser.create_delayed_rules();
        if (this.parser.events.size > this.event_items.size) {
            // TODO: add set difference, ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#implementing_basic_set_operations
            throw('Parse error: undefined items in parser event list');
        }
    }

    get_region(region_name) {
        if (region_name instanceof Region) {
            return region_name;
        }
        if (region_name in this._region_cache) {
            return this._region_cache[region_name];
        } else {
            let region = this.regions.filter(r => r.name === region_name);
            if (region.length === 1) {
                this._region_cache[region_name] = region[0];
                return region[0];
            } else {
                throw(`No such region ${region_name}`);
            }
        }
    }

    get_entrance(entrance) {
        if (entrance instanceof entrance) {
            return entrance;
        }
        if (entrance in this._region_cache) {
            return this._entrance_cache[entrance];
        } else {
            for (let i = 0; i < this.regions.length; i++) {
                for (let j = 0; j < this.regions[i].exits.length; j++) {
                    if (this.regions[i].exits[j].name === entrance) {
                        this._entrance_cache[entrance] = this.regions[i].exits[j];
                        return this.regions[i].exits[j];
                    }
                }
            }
            throw(`No such entrance ${entrance}`);
        }
    }

    get_location(location) {
        if (location instanceof Location) {
            return location;
        }
        if (location in this._region_cache) {
            return this._location_cache[location];
        } else {
            for (let i = 0; i < this.regions.length; i++) {
                for (let j = 0; j < this.regions[i].locations.length; j++) {
                    if (this.regions[i].locations[j].name === location) {
                        this._location_cache[location] = this.regions[i].locations[j];
                        return this.regions[i].locations[j];
                    }
                }
            }
            throw(`No such location ${location}`);
        }
    }

    push_item(location, item, manual=false) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }

        location.item = item;
        item.location = location;
        item.price = location.price !== null ? location.price : item.price;
        location.price = item.price;
    }
}

module.exports = World;