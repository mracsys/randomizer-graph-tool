class Entrance {
    constructor(name='', parent=null) {
        this.name = name;
        this.parent_region = parent;
        this.world = parent.world;
        this.connected_region = null;
        this.original_connection = null;
        this.access_rule = (worldState, { age = null, spot = null, tod = null } = {}) => true;
        this.access_rules = [];
        this.reverse = null;
        this.replaces = null;
        this.assumed = null;
        this.type = null;
        this.shuffled = false;
        this.data = null;
        this.primary = false;
        this.always = false;
        this.never = false;
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
            rule(worldState, kwargs);
        });
    }

    set_rule(rule) {
        this.access_rule = rule;
        this.access_rules = [rule];
    }

    connect(region) {
        this.connected_region = region;
        region.entrances.push(this);
    }

    disconnect() {
        let i = this.connected_region.entrances.indexOf(this);
        if (i > -1) {
            this.connected_region.entrances.splice(i, 1);
        } else {
            throw(`Failed to disconnect entrance ${this.name} from ${this.connected_region.name}`)
        }
        let previously_connected = this.connected_region;
        this.connected_region = null;
        return previously_connected;
    }

    bind_two_way(other_entrance) {
        this.reverse = other_entrance;
        other_entrance.reverse = this;
    }

    get_new_target() {
        let root = this.world.get_region('Root Exits');
        let target_entrance = new Entrance(`Root -> ${this.connected_region.name}`, root);
        target_entrance.connect(this.connected_region);
        target_entrance.replaces = this;
        root.exits.push(target_entrance);
        return target_entrance;
    }

    assume_reachable() {
        if (this.assumed === null) {
            this.assumed = this.get_new_target();
            this.disconnect();
        }
        return this.assumed;
    }
}

module.exports = Entrance;