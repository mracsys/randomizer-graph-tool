import { GraphItem } from "../GraphPlugin.js";

import { item_table } from "./ItemList.js";
import World from "./World.js";
import { Location } from "./Location.js";

type ItemSpecial = {
    alias?: [a: string, n: number],
    trade?: boolean,
    bottle?: number | boolean,
    progressive?: number,
    object?: number,
    price?: number,
    medallion?: boolean,
    stone?: boolean,
    ocarina_button?: boolean,
    junk?: number,
    shop_object?: number,
    text_id?: number,
    song_id?: number,
    item_id?: number,
    addr2_data?: number,
    bit_mask?: number,
    actor_type?: number,
    object_id?: number,
};

export class _ItemInfo {
    constructor(
        public name: string = '',
        private event: boolean = false,
        public advancement: boolean = false,
        public priority: boolean = false,
        public type: string = '',
        public special: ItemSpecial = {},
        public index: number | null = null,
        public price: number | null = null,
        public bottle: number | boolean = false,
        public medallion: boolean = false,
        public stone: boolean = false,
        public ocarina_button: boolean = false,
        public alias: [a: string, n: number] | null = null,
        public junk: number | null = null,
        public trade: boolean = false,
    ) {
        let _type: string, _progressive: boolean | null, _itemID: number | null, _special: ItemSpecial | null;
        if (this.event) {
            _type = 'Event';
            _progressive = true;
            _itemID = null;
            _special = null;
        } else {
            [_type, _progressive, _itemID, _special] = item_table[name];
        }
        this.advancement = (_progressive === true);
        this.priority = (_progressive === false);
        this.type = _type;
        this.special = _special === null ? {} : _special;
        this.index = _itemID;

        if (this.special.price !== undefined) this.price = this.special.price;
        if (this.special.bottle !== undefined) this.bottle = this.special.bottle;
        if (this.special.medallion !== undefined) this.medallion = this.special.medallion;
        if (this.special.stone !== undefined) this.stone = this.special.stone;
        if (this.special.ocarina_button !== undefined) this.ocarina_button = this.special.ocarina_button;
        if (this.special.alias !== undefined) this.alias = this.special.alias;
        if (this.special.junk !== undefined) this.junk = this.special.junk;
        if (this.special.trade !== undefined) this.trade = this.special.trade;
    }
}

type ItemInfo = {
    items: {[name: string]: _ItemInfo},
    events: {[name: string]: _ItemInfo},
    bottles: Set<string>,
    medallions: Set<string>,
    stones: Set<string>,
    ocarina_buttons: Set<string>,
    junk: {[name: string]: number | null},
};

export var ItemInfo: ItemInfo = {
    items: {},
    events: {},
    bottles: new Set(),
    medallions: new Set(),
    stones: new Set(),
    ocarina_buttons: new Set(),
    junk: {},
};

Object.keys(item_table).map((item_name) => {
    ItemInfo.items[item_name] = new _ItemInfo(item_name);
    if (ItemInfo.items[item_name].bottle) {
        ItemInfo.bottles.add(item_name);
    }
    if (ItemInfo.items[item_name].medallion) {
        ItemInfo.medallions.add(item_name);
    }
    if (ItemInfo.items[item_name].stone) {
        ItemInfo.stones.add(item_name);
    }
    if (ItemInfo.items[item_name].ocarina_button) {
        ItemInfo.ocarina_buttons.add(item_name);
    }
    if (ItemInfo.items[item_name].junk !== null) {
        ItemInfo.junk[item_name] = ItemInfo.items[item_name].junk;
    }
});

export class Item implements GraphItem {
    public info: _ItemInfo;

    constructor(
        public name: string = '',
        public world: World,
        public event: boolean = false,
        public player: number = -1,
        public location: Location | null = null,
        public price: number | null = null,
        public looks_like_item: Item | null = null,
        public advancement: boolean = false,
        public priority: boolean = false,
        public type: string = '',
        public special: ItemSpecial = {},
        public index: number | null = null,
        public alias: [a: string, n: number] | null = null,
    ) {
        this.player = this.world.id + 1;
        if (this.event) {
            if (!(this.name in ItemInfo.events)) {
                ItemInfo.events[this.name] = new _ItemInfo(this.name, true);
            }
            this.info = ItemInfo.events[this.name];
        } else {
            this.info = ItemInfo.items[this.name];
        }
        if (this.info.special.price !== undefined) this.price = this.info.special.price;
        this.advancement = this.info.advancement;
        this.priority = this.info.priority;
        this.type = this.info.type;
        this.special = this.info.special;
        this.index = this.info.index;
        this.alias = this.info.alias;
    }
}

export function ItemFactory(items: string | string[], world: World, event: boolean = false): Item[] {
    if (typeof(items) === 'string') {
        if (!(event) && !(items in ItemInfo.items)) {
            throw('Unknown item: ' + items);
        } else {
            return [new Item(items, world, event)];
        }
    }
    var ret: Item[] = [];
    items.map((item) => {
        if (!(event) && !(item in ItemInfo.items)) {
            throw('Unknown item: ' + item);
        } else {
            ret.push(new Item(item, world, event));
        }
    });
    return ret;
}

export function MakeEventItem(name: string, location: Location, item: Item | null = null) {
    if (item === null) {
        item = ItemFactory(name, location.world, true)[0];
    }
    if (!!(location.world)) {
        location.world.push_item(location, item);
        location.world.event_items.add(name);
    } else {
        throw(`Attempted to create an event item for a location not in a world: ${location.name}`);
    }
    location.locked = true;
    if (!(name in item_table)) {
        location.internal = true;
    }
    return item;
}