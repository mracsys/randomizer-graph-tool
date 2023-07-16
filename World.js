const { merge } = require("lodash");
const { MakeEventItem } = require("./Item.js");
const { Location, LocationFactory } = require("./Location.js");
const Entrance = require('./Entrance.js');
const { TimeOfDay } = require("./Region.js");
const { Region } = require("./Region.js");
const RuleParser = require("./RuleParser.js");
const { read_json, replace_python_booleans } = require("./Utils.js");
const WorldState = require("./WorldState.js");
const { HintAreas } = require('./Hints.js');
const { HintArea } = require("./HintArea.js");
const path = require('path');

class World {
    constructor(id, settings, ootr_version) {
        if (Object.keys(settings).includes('randomized_settings')) {
            if (settings.settings.world_count > 1) {
                this.settings = merge(settings.settings, settings.randomized_settings[`World ${id+1}`]);
            } else {
                this.settings = merge(settings.settings, settings.randomized_settings);
            }
        } else {
            this.settings = settings.settings;
        }
        if (!(Object.keys(this.settings).includes('debug_parser'))) {
            this.settings.debug_parser = false;
        }
        this.id = id;
        this.version = ootr_version;
        this.dungeons = [];
        this.regions = [];
        this.itempool = [];
        this._cached_locations = null;
        this._cached_entrances = null;
        this._entrance_cache = {};
        this._region_cache = {};
        this._location_cache = {};

        this.parser = new RuleParser(this, this.version, this.settings.debug_parser);
        this.event_items = new Set();

        if (Object.keys(settings).includes('trials')) {
            let trials_settings;
            if (settings.settings.world_count > 1) {
                trials_settings = settings.trials[`World ${id+1}`];
            } else {
                trials_settings = settings.trials;
            }
            this.skipped_trials = {};
            for (let [trial, enabled] of Object.entries(trials_settings)) {
                this.skipped_trials[trial] = enabled == 'inactive';
            }
        } else {
            this.skipped_trials = {
                "Forest": false,
                "Fire":   false,
                "Water":  false,
                "Spirit": false,
                "Shadow": false,
                "Light":  false
            };
        }

        if (Object.keys(settings).includes('dungeons')) {
            let dungeon_settings;
            if (settings.settings.world_count > 1) {
                dungeon_settings = settings.dungeons[`World ${id+1}`];
            } else {
                dungeon_settings = settings.dungeons;
            }
            this.dungeon_mq = {};
            for (let [dungeon, dtype] of Object.entries(dungeon_settings)) {
                this.dungeon_mq[dungeon] = dtype === 'mq';
            }
        } else {
            this.dungeon_mq = {
                'Deku Tree': false,
                'Dodongos Cavern': false,
                'Jabu Jabus Belly': false,
                'Bottom of the Well': false,
                'Ice Cavern': false,
                'Gerudo Training Ground': false,
                'Forest Temple': false,
                'Fire Temple': false,
                'Water Temple': false,
                'Spirit Temple': false,
                'Shadow Temple': false,
                'Ganons Castle': false
            }
        }

        if (Object.keys(settings).includes('songs')) {
            this.song_notes = settings.songs;
        } else {
            this.song_notes = {
                "Zeldas Lullaby":     "<^><^>",
                "Eponas Song":        "^<>^<>",
                "Sarias Song":        "v><v><",
                "Suns Song":          ">v^>v^",
                "Song of Time":       ">Av>Av",
                "Song of Storms":     "Av^Av^",
                "Minuet of Forest":   "A^<><>",
                "Bolero of Fire":     "vAvA>v>v",
                "Serenade of Water":  "Av>><",
                "Requiem of Spirit":  "AvA>vA",
                "Nocturne of Shadow": "<>>A<>v",
                "Prelude of Light":   "^>^><^"
              }
        }

        this.keysanity = ['keysanity', 'remove', 'any_dungeon', 'overworld', 'regional'].includes(this.settings.shuffle_smallkeys);
        this.shuffle_silver_rupees = this.settings.shuffle_silver_rupees !== 'vanilla';
        this.check_beatable_only = this.settings.reachable_locations !== 'all';
        this.shuffle_special_interior_entrances = this.settings.shuffle_interior_entrances === 'all';
        this.shuffle_interior_entrances = ['simple', 'all'].includes(this.settings.shuffle_interior_entrances);
        this.shuffle_special_dungeon_entrances = this.settings.shuffle_dungeon_entrances === 'all';
        this.shuffle_dungeon_entrances = ['simple', 'all'].includes(this.settings.shuffle_dungeon_entrances);
        this.entrance_shuffle = this.shuffle_interior_entrances || this.settings.shuffle_grotto_entrances || this.shuffle_dungeon_entrances
            || this.settings.shuffle_overworld_entrances || this.settings.shuffle_gerudo_valley_river_exit || this.settings.owl_drops || this.settings.warp_songs
            || this.settings.spawn_positions.length > 0 || (this.settings.shuffle_bosses !== 'off');
        this.mixed_pools_bosses = false;
        this.ensure_tod_access = this.shuffle_interior_entrances || this.settings.shuffle_overworld_entrances || this.settings.spawn_positions;
        this.disable_trade_revert = this.shuffle_interior_entrances || this.settings.shuffle_overworld_entrances || this.settings.adult_trade_shuffle;
        this.skip_child_zelda = !(this.settings.shuffle_child_trade.includes('Zeldas Letter')) && 'Zeldas Letter' in this.settings.starting_items;

        if (this.settings.open_forest === 'closed' && 
            (this.shuffle_special_interior_entrances || this.settings.shuffle_hideout_entrances || this.settings.shuffle_overworld_entrances
            || this.settings.warp_songs || this.settings.spawn_positions)) {
            this.settings.open_forest = 'closed_deku';
        }

        this.triforce_goal = this.settings.triforce_goal_per_world * this.settings.world_count;
        if (this.settings.triforce_hunt) {
            this.settings.shuffle_ganon_bosskey = 'triforce';
        }

        this.shuffled_entrance_types = [];
        if (this.shuffle_dungeon_entrances) this.shuffled_entrance_types.push('Dungeon');
        if (this.shuffle_special_dungeon_entrances) this.shuffled_entrance_types.push('DungeonSpecial');
        if (this.settings.shuffle_bosses !== 'off') this.shuffled_entrance_types.push('ChildBoss', 'AdultBoss');
        if (this.shuffle_interior_entrances) this.shuffled_entrance_types.push('Interior');
        if (this.shuffle_special_interior_entrances) this.shuffled_entrance_types.push('SpecialInterior');
        if (this.settings.shuffle_hideout_entrances) this.shuffled_entrance_types.push('Hideout');
        if (this.settings.shuffle_grotto_entrances) this.shuffled_entrance_types.push('Grotto', 'Grave');
        if (this.settings.shuffle_overworld_entrances) this.shuffled_entrance_types.push('Overworld');
        if (this.settings.shuffle_gerudo_valley_river_exit) this.shuffled_entrance_types.push('OverworldOneWay');
        if (this.settings.owl_drops) this.shuffled_entrance_types.push('OwlDrop');
        if (this.settings.warp_songs) this.shuffled_entrance_types.push('WarpSong');

        this.state = new WorldState(this);
    }

    load_regions_from_json(file_path) {
        let world_folder;
        if (this.settings.logic_rules === 'glitched') {
            world_folder = 'Glitched World';
        } else {
            world_folder = 'World';
        }
        let region_json = read_json(path.join(world_folder, file_path), this.version);
        let savewarps_to_connect = [];
        //console.log(`parsing ${file_path}`);
        for (const region of region_json) {
            let new_region = new Region(region.region_name);
            new_region.world = this;
            if (Object.keys(region).includes('scene')) {
                new_region.scene = region.scene;
            }
            if (Object.keys(region).includes('hint')) {
                new_region.hint_name = region.hint;
            }
            if (Object.keys(region).includes('alt_hint')) {
                new_region.alt_hint_name = region.alt_hint;
            }
            if (Object.keys(region).includes('dungeon')) {
                new_region.dungeon = region.dungeon;
            }
            if (Object.keys(region).includes('is_boss_room')) {
                new_region.is_boss_room = region.is_boss_room;
            }
            if (Object.keys(region).includes('time_passes')) {
                new_region.time_passes = region.time_passes;
                new_region.provides_time = TimeOfDay.ALL;
            }
            if (new_region.name === 'Ganons Castle Grounds') {
                new_region.provides_time = TimeOfDay.DAMPE;
            }
            if (Object.keys(region).includes('locations')) {
                for (const [location, rule] of Object.entries(region.locations)) {
                    let new_location = LocationFactory(location);
                    new_location.parent_region = new_region;
                    new_location.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        //console.log(`parsing ${new_location.name}`);
                        this.parser.parse_spot_rule(new_location);
                    }
                    new_location.world = this;
                    if (!!(new_location.item)) {
                        
                    }
                    new_region.locations.push(new_location);
                }
            }
            if (Object.keys(region).includes('events')) {
                for (const [event, rule] of Object.entries(region.events)) {
                    let lname = `${event} from ${new_region.name}`;
                    let new_location = new Location({ name: lname, type: 'Event', parent: new_region });
                    new_location.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        //console.log(`parsing ${new_location.name}`);
                        this.parser.parse_spot_rule(new_location);
                    }
                    if (!(new_location.never)) {
                        new_location.world = this;
                        new_region.locations.push(new_location);
                        MakeEventItem(event, new_location);
                    }
                }
            }
            if (Object.keys(region).includes('exits')) {
                for (const [exit, rule] of Object.entries(region.exits)) {
                    let new_exit = new Entrance(`${new_region.name} -> ${exit}`, new_region);
                    new_exit.connected_region = exit;
                    new_exit.rule_string = replace_python_booleans(rule);
                    if (this.settings.logic_rules !== 'none') {
                        //console.log(`parsing ${new_exit.name}`);
                        this.parser.parse_spot_rule(new_exit);
                    }
                    new_region.exits.push(new_exit);
                }
            }
            if (Object.keys(region).includes('savewarp')) {
                let savewarp_target = region.savewarp.split(' -> ')[1];
                let new_exit = new Entrance(`${new_region.name} -> ${savewarp_target}`, new_region);
                new_exit.connected_region = savewarp_target;
                new_region.exits.push(new_exit);
                new_region.savewarp = new_exit;
                savewarps_to_connect.push([new_exit, region.savewarp]);
            }
            this.regions.push(new_region);
        }
        return savewarps_to_connect;
    }

    create_dungeons() {
        let savewarps_to_connect = [];
        for (const hint_area in HintAreas) {
            if (!!HintAreas[hint_area].dungeon_name) {
                let name = HintAreas[hint_area].dungeon_name;
                let dungeon_json;
                if (!this.dungeon_mq[name]) {
                    dungeon_json = `${name}.json`;
                } else {
                    dungeon_json = `${name} MQ.json`;
                }
                savewarps_to_connect.push(...(this.load_regions_from_json(dungeon_json)));
            }
        }
        return savewarps_to_connect;
    }

    create_internal_locations() {
        this.parser.create_delayed_rules();
        if (this.parser.events.size > this.event_items.size) {
            // TODO: add set difference, ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#implementing_basic_set_operations
            throw('Parse error: undefined items in parser event list');
        }
    }

    initialize_entrances() {
        let target_region;
        for (let region of this.regions) {
            for (let exit of region.exits) {
                target_region = this.get_region(exit.connected_region);
                exit.connect(target_region);
                exit.world = this;
                exit.original_connection = target_region;
            }
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
        if (entrance instanceof Entrance) {
            return entrance;
        }
        if (entrance in this._entrance_cache) {
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

    get_entrance_from_target(target) {
        let t;
        if (typeof(target) === 'string') {
            t = {'region': target};
        } else {
            t = target;
        }
        let entrances = this.get_entrances();
        let candidates = entrances.filter((e) => e.original_connection.name === t.region && !!(e.type));
        let match;
        if (Object.keys(t).includes('from')) {
            match = candidates.filter((c) => c.parent_region.name === t.from);
        } else {
            // string targets can only be certain entrance types, see EntranceRecord.from_entrance in the ootr source
            match = candidates.filter((c) => ['Interior', 'SpecialInterior', 'Grotto', 'Grave'].includes(c.type));
        }
        if (match.length === 1) {
            return match[0];
        } else {
            throw(`Could not find entrance matching target ${JSON.stringify(target)}`);
        }
    }

    get_location(location) {
        if (location instanceof Location) {
            return location;
        }
        if (location in this._location_cache) {
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

    push_vanilla_item(location, manual=false) {
        if (!(location instanceof Location)) {
            location = this.get_location(location);
        }

        location.item = location.vanilla_item;
        location.vanilla_item.location = location;
        location.vanilla_item.price = location.price !== null ? location.price : location.vanilla_item.price;
        location.price = location.vanilla_item.price;
    }

    get_locations() {
        if (!(!!this._cached_locations)) {
            this._cached_locations = [];
            for (const region of this.regions) {
                this._cached_locations.push(...(region.locations));
            }
        }
        return this._cached_locations;
    }

    get_entrances() {
        if (!(!!this._cached_entrances)) {
            this._cached_entrances = [];
            for (const region of this.regions) {
                this._cached_entrances.push(...(region.exits));
            }
        }
        return this._cached_entrances;
    }

    region_has_shortcuts(region_name) {
        let region = this.get_region(region_name);
        let dungeon_name = HintArea.at(region).dungeon_name;
        return this.settings.dungeon_shortcuts.includes(dungeon_name);
    }
}

module.exports = World;