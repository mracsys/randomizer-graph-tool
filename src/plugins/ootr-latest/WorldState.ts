import { ItemInfo, ItemFactory, Item } from "./Item.js";
import World from './World.js';
import Search from './Search.js';
import { BOULDER_TYPE } from "./Boulders.js";
import type { kwargs } from "./RuleParser.js";
import { Location } from "./Location.js";
import { get_scene_group, scene_list } from "./Scene.js";

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
        return this.has('Triforce Piece', this.world.triforce_goal_per_world);
    }

    won_normal(): boolean {
        return this.has('Triforce');
    }

    has(item: string, count=1, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return !!this.prog_items[item] && this.prog_items[item] >= count;
    }

    has_any_of(items: string[] | IterableIterator<string>, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        for (const item of items) {
            if (!!this.prog_items[item] && this.prog_items[item]) return true;
        }
        return false;
    }

    has_all_of(items: string[] | IterableIterator<string>, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        for (const item of items) {
            if (!(!!this.prog_items[item] && this.prog_items[item])) return false;
        }
        return true;
    }

    count_of(items: string[] | IterableIterator<string>, { age = null, spot = null, tod = null }: kwargs = {}): number {
        let s = 0;
        for (const i of items) {
            s += !!this.prog_items[i] ? this.prog_items[i] : 0;
        };
        return s;
    }

    count_distinct(items: string[] | IterableIterator<string>, { age = null, spot = null, tod = null }: kwargs = {}): number {
        if (this.world.version.lte('8.2.0')) return this.count_of(items);
        let s = 0;
        for (const i of items) {
            s += !!this.prog_items[i] ? 1 : 0;
        }
        return s;
    }

    item_count(item: string, { age = null, spot = null, tod = null }: kwargs = {}): number {
        return this.prog_items[item];
    }

    has_bottle({ age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.has_any_of(this.ItemInfo.bottles.values()) || this.has('Rutos Letter', 2);
    }

    has_hearts(count: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.heart_count() >= count;
    }

    heart_count({ age = null, spot = null, tod = null }: kwargs = {}): number {
        return (~~(this.item_count('Piece of Heart') / 4) + 3);
    }

    has_medallions(count: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.count_distinct(this.ItemInfo.medallions.values()) >= count;
    }

    has_stones(count: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.count_distinct(this.ItemInfo.stones.values()) >= count;
    }

    has_dungeon_rewards(count: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return (this.count_distinct(this.ItemInfo.medallions.values()) + this.count_distinct(this.ItemInfo.stones.values())) >= count;
    }

    had_night_start({ age = null, spot = null, tod = null }: kwargs = {}): boolean {
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

    can_live_dmg(hearts: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        let mult = this.world.settings.damage_multiplier;
        if (hearts*4 >= 3) {
            return mult != 'ohko' && mult != 'quadruple';
        } else if (hearts*4 < 3) {
            return mult != 'ohko';
        } else {
            return true;
        }
    }

    guarantee_hint({ age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.world.parser.guarantee_hint(this, {});
    }

    has_ocarina_buttons(count: number, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.count_distinct(this.ItemInfo.ocarina_buttons.values()) >= count;
    }

    has_all_notes_for_song(song: string, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        if (song === 'Scarecrow Song') {
            return this.has_ocarina_buttons(2) || (this.world.version.gt('8.2.0') && !!this.world.settings.free_scarecrow)
                || (this.world.version.gt('8.3.0') && !!this.world.settings.scarecrow_behavior && this.world.settings.scarecrow_behavior == 'free');
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
        if (add_to_inventory) this.collect_in_cache(item, this.player_inventory, false);
    }

    collect_in_cache(item: Item, cache: Dictionary<number>, is_prog: boolean = true): void {
        if (item.name.includes('Small Key Ring') && this.world.settings.keyring_give_bk) {
            let dungeon_name = item.name.substring(0, item.name.length-1).split('(')[1];
            if (['Forest Temple', 'Fire Temple', 'Water Temple', 'Shadow Temple', 'Spirit Temple'].includes(dungeon_name)) {
                cache[`Boss Key (${dungeon_name})`] = 1;
            }
        }
        // Don't collect 10 magic bean alias for the player inventory so that item trackers
        // can reflect the player actually buying them. 
        if (!!item.alias && (is_prog || item.name !== 'Buy Magic Bean')) {
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
        // Collect compasses and maps for sim hinting purposes
        if (item.name.includes('Compass') || item.name.includes('Map')) {
            if (!!cache[item.name]) {
                cache[item.name] += 1;
            } else {
                cache[item.name] = 1;
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

    region_has_shortcuts(region_name: string, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        return this.world.region_has_shortcuts(region_name);
    }

    has_soul(enemy: string, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        if (this.world.settings.shuffle_enemy_spawns === 'regional') {
            let scene: string | null = null;
            let group: string = 'Unknown Group';
            if (this.world.version.lt('8.1.30')) {
                if (!!spot && spot instanceof Location && spot.scene !== 0xFF && spot.scene !== 62 && spot.scene !== null) {
                    scene = scene_list[spot.scene];
                } else if (!!spot && spot instanceof Location && spot.scene === 62) {
                    scene = 'Grottos';
                } else if (spot?.parent_region?.scene) {
                    scene = spot.parent_region.scene;
                } else if (spot?.parent_region?.dungeon) {
                    scene = spot.parent_region.dungeon;
                }
            } else {
                // bugfix after 8.1.29 affects Spirit Temple Hands regional souls (dungeon vs scene)
                if (!!spot && spot instanceof Location && spot.scene === 62) {
                    scene = 'Grottos';
                } else if (spot?.parent_region?.dungeon) {
                    scene = spot.parent_region.dungeon;
                } else if (!!spot && spot instanceof Location && spot.scene !== 0xFF && spot.scene !== 62 && spot.scene !== null) {
                    scene = scene_list[spot.scene];
                } else if (spot?.parent_region?.scene) {
                    scene = spot.parent_region.scene;
                }
            }
            if (!!scene) {
                let scene_group = get_scene_group(scene);
                if (!!scene_group) group = scene_group;
            }
            return this.has(`${group} Souls`)
        } else {
            return (!(this.world.shuffle_enemy_spawns) || this.has(`${enemy} Soul`));
        }
    }

    boulder_type(boulder: string, { age = null, spot = null, tod = null }: kwargs = {}): BOULDER_TYPE {
        return this.world.boulder_cache[boulder].type;
    }

    can_pass_boulder(boulder: string, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        let type: BOULDER_TYPE = this.world.boulder_cache[boulder].type;
        return this.can_pass_boulder_type(type, { age: age });
    }

    can_pass_boulder_type(boulder_type: BOULDER_TYPE, { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        if (boulder_type == BOULDER_TYPE.BRONZE) {
            // Check for hammer and adult
            return age === 'adult' && this.has('Megaton Hammer');
        } else if (boulder_type === BOULDER_TYPE.SILVER) {
            // Check for adult+str2
            return age === 'adult' && this.has('Progressive Strength Upgrade', 2);
        } else if (boulder_type === BOULDER_TYPE.GOLD) {
            // Check for adult+str3
            return age === 'adult' && this.has('Progressive Strength Upgrade', 3);
        } else if (boulder_type === BOULDER_TYPE.BROWN) {
            // Check for adult+hammer or explosives
            return this.world.parser.can_blast_or_smash(this, { age: age });
        } else if (boulder_type === BOULDER_TYPE.RED_ICE) {
            // Check for blue fire
            return this.world.parser.Blue_Fire(this, { age: age });
        }
        // Should never get here
        return false;
    }

    // Check if the current state can pass a particular boulder, restricted to a list of types
    can_pass_boulder_types(boulder: string, types: BOULDER_TYPE[], { age = null, spot = null, tod = null }: kwargs = {}): boolean {
        let this_boulder_type: BOULDER_TYPE = this.world.boulder_cache[boulder].type; // Get the boulder's type
        if (types.includes(this_boulder_type)) { // Check if that type is in the list of allowed types
            return this.can_pass_boulder_type(this_boulder_type, { age: age }); // Check ability to pass that type
        }
        return false;
    }
}

export default WorldState;