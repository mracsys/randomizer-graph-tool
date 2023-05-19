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
        this.vanilla_item = vanilla_item;
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
            rule(worldState, kwargs);
        });
    }

    set_rule(rule) {
        this.access_rule = rule;
        this.access_rules = [rule];
    }
}

module.exports = Location;