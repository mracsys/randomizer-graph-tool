const item_table = require("./ItemList.js");

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
    }
}

var ItemInfo = {
    items: {},
    events: {},
    bottles: new Set(),
    medallions: new Set(),
    stones: new Set(),
};

item_table.map((item_name) => {
    ItemInfo.items[item_name] = _ItemInfo(name);
    if (ItemInfo.items[item_name].bottle) {
        ItemInfo.bottles.push(item_name);
    }
    if (ItemInfo.items[item_name].medallion) {
        ItemInfo.medallions.push(item_name);
    }
    if (ItemInfo.items[item_name].stone) {
        ItemInfo.stones.push(item_name);
    }
});

export class Item {
    constructor(name='', world=null, event=false) {
        this.name = name;
        this.location = null;
        this.event = event;
        if (event) {
            if (!(name in ItemInfo.events)) {
                ItemInfo.events[name] = _ItemInfo(name,true);
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
    }
}

function ItemFactory(items, world=null, event=false) {
    if (typeof(items) === 'string') {
        if (!(event) && !(items in ItemInfo.items)) {
            //Unknown item
        } else {
            return Item(items, world, event);
        }
    }
    var ret = [];
    items.map((item) => {
        if (!(event) && !(item in ItemInfo.items)) {
            //Unknown item
        } else {
            ret.push(Item(item, world, event));
        }
    });
    return ret;
}

export function MakeEventItem(name, location, item=null) {
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
    Item,
    MakeEventItem
};