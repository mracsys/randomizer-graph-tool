import { ItemInfo, ItemFactory, Item } from "./Item.js";
import World from './World.js';
import Search from './Search.js';

type Dictionary<T> = {
    [Key: string]: T;
}

class WorldState {
    public prog_items: Dictionary<number>;
    public player_inventory: Dictionary<number>;
    public world: World;
    public search: Search | null;
    public _won: () => boolean;
    public ItemInfo: ItemInfo;

    constructor(parent: World) {
        // Items logically collected
        this.prog_items = {};
        // Items logically collected minus specified unshuffled items (skulls, keys, etc)
        this.player_inventory = {};
        this.world = parent;
        this.ItemInfo = this.world.parent_graph.ItemInfo;
        this.search = null;
        this._won = this.world.settings.triforce_hunt ? this.won_triforce_hunt : this.won_normal;
    }

    copy(): WorldState {
        let new_state = new WorldState(this.world);
        new_state.prog_items = Object.assign({}, this.prog_items);
        new_state.player_inventory = Object.assign({}, this.prog_items);
        return new_state;
    }

    reset(): void {
        this.prog_items = {};
        this.player_inventory = {};
        this.search?.reset_cache();
    }

    won(): boolean {
        return this._won();
    }

    won_triforce_hunt(): boolean {
        return this.has('Triforce Piece', this.world.triforce_goal);
    }

    won_normal(): boolean {
        return this.has('Triforce');
    }

    has(item: string, count=1): boolean {
        return !!this.prog_items[item] && this.prog_items[item] >= count;
    }

    has_any_of(items: string[] | IterableIterator<string>): boolean {
        for (const item of items) {
            if (!!this.prog_items[item] && this.prog_items[item]) return true;
        }
        return false;
    }

    has_all_of(items: string[] | IterableIterator<string>): boolean {
        for (const item of items) {
            if (!(!!this.prog_items[item] && this.prog_items[item])) return false;
        }
        return true;
    }

    count_of(items: string[] | IterableIterator<string>): number {
        let s = 0;
        for (const i of items) {
            s += !!this.prog_items[i] ? this.prog_items[i] : 0;
        };
        return s;
    }

    item_count(item: string): number {
        return this.prog_items[item];
    }

    has_bottle(): boolean {
        return this.has_any_of(this.ItemInfo.bottles.values()) || this.has('Rutos Letter', 2);
    }

    has_hearts(count: number): boolean {
        return this.heart_count() >= count;
    }

    heart_count(): number {
        return (~~(this.item_count('Piece of Heart') / 4) + 3);
    }

    has_medallions(count: number): boolean {
        return this.count_of(this.ItemInfo.medallions.values()) >= count;
    }

    has_stones(count: number): boolean {
        return this.count_of(this.ItemInfo.stones.values()) >= count;
    }

    has_dungeon_rewards(count: number): boolean {
        return (this.count_of(this.ItemInfo.medallions.values()) + this.count_of(this.ItemInfo.stones.values())) >= count;
    }

    had_night_start(): boolean {
        let stod = this.world.settings.starting_tod;
        // These are all not between 6:30 and 18:00
        if (stod === 'sunset' ||         // 18
            stod === 'evening' ||        // 21
            stod === 'midnight' ||       // 00
            stod === 'witching-hour') {  // 03
            return true;
        } else {
            return false;
        }
    }

    can_live_dmg(hearts: number): boolean {
        let mult = this.world.settings.damage_multiplier;
        if (hearts*4 >= 3) {
            return mult != 'ohko' && mult != 'quadruple';
        } else if (hearts*4 < 3) {
            return mult != 'ohko';
        } else {
            return true;
        }
    }

    guarantee_hint(): boolean {
        return this.world.parser.parse_rule('guarantee_hint')(this, {});
    }

    has_ocarina_buttons(count: number): boolean {
        return this.count_of(this.ItemInfo.ocarina_buttons.values()) >= count;
    }

    has_all_notes_for_song(song: string): boolean {
        if (song === 'Scarecrow Song') {
            return this.has_ocarina_buttons(2);
        }
        let notes = this.world.song_notes[song];
        if (notes.includes('A')) {
            if (!(this.has('Ocarina A Button'))) {
                return false;
            }
        }
        if (notes.includes('<')) {
            if (!(this.has('Ocarina C left Button'))) {
                return false;
            }
        }
        if (notes.includes('^')) {
            if (!(this.has('Ocarina C up Button'))) {
                return false;
            }
        }
        if (notes.includes('v')) {
            if (!(this.has('Ocarina C down Button'))) {
                return false;
            }
        }
        if (notes.includes('>')) {
            if (!(this.has('Ocarina C right Button'))) {
                return false;
            }
        }
        return true;
    }

    collect(item: Item, add_to_progression: boolean = true, add_to_inventory: boolean = true): void {
        if (add_to_progression) this.collect_in_cache(item, this.prog_items);
        if (add_to_inventory) this.collect_in_cache(item, this.player_inventory);
    }

    collect_in_cache(item: Item, cache: Dictionary<number>): void {
        if (item.name.includes('Small Key Ring') && this.world.settings.keyring_give_bk) {
            let dungeon_name = item.name.substring(0, item.name.length-1).split('(')[1];
            if (['Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple'].includes(dungeon_name)) {
                cache[`Boss Key (${dungeon_name})`] = 1;
            }
        }
        if (!!item.alias) {
            if (!!cache[item.alias[0]]) {
                cache[item.alias[0]] += item.alias[1];
            } else {
                cache[item.alias[0]] = item.alias[1];
            }
        }
        if (item.advancement) {
            // The randomizer uses solver IDs based on escaped item names.
            // Normally using the item name strings as-is works, but Like-like souls
            // have the hyphen removed in the upstream logic files, so skipping item name
            // escaping has no effect.
            let item_name = item.name === 'Like-like Soul' ? 'Likelike Soul' : item.name;
            if (!!cache[item_name]) {
                cache[item_name] += 1;
            } else {
                cache[item_name] = 1;
            }
        }
    }

    collect_list(items: Item[], add_to_progression: boolean = true, add_to_inventory: boolean = true) {
        items.map(i => this.collect(i, add_to_progression, add_to_inventory));
    }

    collect_starting_items(): void {
        let starting_item;
        if (!!this.world.settings.starting_items) {
            for (let item_name of Object.keys(this.world.settings.starting_items)) {
                starting_item = ItemFactory(item_name === 'Bottle with Milk (Half)' ? 'Bottle' : item_name, this.world)[0];
                // Hack to allow trackers to increment skull counts without messing with 
                // the count of logically reachable skulls if all skulls are unshuffled.
                let collect_starting_tokens = item_name !== 'Gold Skulltula Token' || this.world.settings.tokensanity !== 'off';
                for (let i = 0; i < this.world.settings.starting_items[item_name]; i++) {
                    this.collect(starting_item, collect_starting_tokens, true);
                }
            }
        }
    }

    remove(item: Item, remove_from_progression: boolean = true, remove_from_inventory: boolean = true): void {
        if (remove_from_progression) this.remove_from_cache(item, this.prog_items);
        if (remove_from_inventory) this.remove_from_cache(item, this.player_inventory);
    }

    remove_from_cache(item: Item, cache: Dictionary<number>): void {
        if (item.name.includes('Small Key Ring') && this.world.settings.keyring_give_bk) {
            let dungeon_name = item.name.substring(0, item.name.length-1).split('(')[1];
            if (['Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple'].includes(dungeon_name)) {
                cache[`Boss Key (${dungeon_name})`] = 0;
            }
        }
        if (!!item.alias && cache[item.alias[0]] > 0) {
            cache[item.alias[0]] -= item.alias[1];
            if (cache[item.alias[0]] <= 0) {
                delete cache[item.alias[0]];
            }
        }
        if (cache[item.name] > 0) {
            cache[item.name] -= 1;
            if (cache[item.name] <= 0) {
                delete cache[item.name];
            }
        }
    }

    region_has_shortcuts(region_name: string): boolean {
        return this.world.region_has_shortcuts(region_name);
    }

    has_soul(enemy: string): boolean {
        return (!(this.world.shuffle_enemy_spawns) || this.has(`${enemy} Soul`));
    }
}

export default WorldState;