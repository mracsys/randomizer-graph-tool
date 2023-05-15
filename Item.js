const item_table = require("./ItemList.js");
var { allowed_globals, escape_name } = require("./RulesCommon.js");

var ItemInfo = {
    items: {},
    events: {},
    bottles: new Set(),
    medallions: new Set(),
    stones: new Set(),
    junk: {},

    solver_ids: {},
    bottle_ids: new Set(),
    medallion_ids: new Set(),
    stone_ids: new Set(),
};

Object.keys(item_table).map((item_name) => {
    ItemInfo.items[item_name] = _ItemInfo(item_name);
    if (ItemInfo.items[item_name].bottle) {
        ItemInfo.bottles.push(item_name);
        ItemInfo.bottle_ids.add(ItemInfo.solver_ids[escape_name(item_name)]);
    }
    if (ItemInfo.items[item_name].medallion) {
        ItemInfo.medallions.push(item_name);
        ItemInfo.medallion_ids.add(ItemInfo.solver_ids[escape_name(item_name)]);
    }
    if (ItemInfo.items[item_name].stone) {
        ItemInfo.stones.push(item_name);
        ItemInfo.stone_ids.add(ItemInfo.solver_ids[escape_name(item_name)]);
    }
    if (ItemInfo.items[item_name].junk !== null) {
        ItemInfo.junk[item_name] = ItemInfo.items[item_name].junk;
    }
});

class _ItemInfo {
    constructor(name='', event=false) {
        if (event) {
            var type = 'Event';
            var progressive = true;
            var itemID = null;
            var special = null;
        } else {
            var [type, progressive, itemID, special] = item_table[name];
        }
        this.name = name;
        this.advancement = (progressive === true);
        this.priority = (progressive === false);
        this.type = type;
        this.special = special === null ? {} : special;
        this.index = itemID;
        this.price = ('price' in this.special) ? this.special['price'] : null;
        this.bottle = ('bottle' in this.special) ? this.special['bottle'] : false;
        this.medallion = ('medallion' in this.special) ? this.special['medallion'] : false;
        this.stone = ('stone' in this.special) ? this.special['stone'] : false;
        this.alias = ('alias' in this.special) ? this.special['alias'] : null;
        this.junk = ('junk' in this.special) ? this.special['junk'] : null;
        this.trade = ('trade' in this.special) ? this.special['trade'] : false;

        this.solver_id = null;
        if (name !== '' && this.junk === null) {
            let esc = escape_name(name);
            if (!(esc in ItemInfo.solver_ids)) {
                allowed_globals[esc] = Object.keys(ItemInfo.solver_ids).length;
                ItemInfo.solver_ids[esc] = Object.keys(ItemInfo.solver_ids).length;
            }
            this.solver_id = ItemInfo.solver_ids[esc];
        }
    }
}

class Item {
    constructor(name='', world=null, event=false) {
        this.name = name;
        this.location = null;
        this.event = event;
        if (event) {
            if (!(name in ItemInfo.events)) {
                ItemInfo.events[name] = _ItemInfo(name, true);
            }
            this.info = ItemInfo.events[name];
        } else {
            this.info = ItemInfo.items[name];
        }
        this.price = ('price' in this.info.special) ? this.info.special['price'] : null;
        this.world = world;
        this.looks_like_item = null;
        this.advancement = this.info.advancement;
        this.priority = this.info.priority;
        this.type = this.info.type;
        this.special = this.info.special;
        this.index = this.info.index;
        this.alias = this.info.alias;

        this.solver_id = this.info.solver_id;
        this.alias_id = this.alias !== null ? ItemInfo.solver_ids[escape_name(this.alias[0])] : null;
    }
}

function ItemFactory(items, world=null, event=false) {
    if (typeof(items) === 'string') {
        if (!(event) && !(items in ItemInfo.items)) {
            throw('Unknown item: ' + items);
        } else {
            return Item(items, world, event);
        }
    }
    var ret = [];
    items.map((item) => {
        if (!(event) && !(item in ItemInfo.items)) {
            throw('Unknown item: ' + item);
        } else {
            ret.push(Item(item, world, event));
        }
    });
    return ret;
}

function MakeEventItem(name, location, item=null) {
    if (item === null) {
        item = ItemFactory(name, location.world, true);
    }
    location.world.push_item(location, item);
    location.locked = true;
    if (!(name in item_table)) {
        location.internal = true;
    }
    location.world.event_items.add(name);
    return item;
}

module.exports = {
    ItemInfo,
    _ItemInfo,
    Item,
    MakeEventItem
};