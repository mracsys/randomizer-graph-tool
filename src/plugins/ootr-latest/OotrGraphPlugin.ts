import { GraphEntrance, GraphGameVersions, GraphItem, GraphLocation, GraphPlugin, GraphSetting, GraphWorld } from '../GraphPlugin.js';

import SettingsList from './SettingsList.js';
import World, { PlandoLocationList, PlandoMWLocationList, PlandoEntranceList, PlandoMWEntranceList } from "./World.js";
import EntranceList from './EntranceList.js';
import { Item, ItemFactory, ItemInfo, _ItemInfo } from "./Item.js";
import OotrVersion from './OotrVersion.js';
import OotrFileCache from './OotrFileCache.js';
import Entrance from './Entrance.js';
import { Location } from './Location.js';
import Search from './Search.js';
import LocationList from './LocationList.js';
import ItemList from './ItemList.js';

class OotrGraphPlugin extends GraphPlugin {
    private version_list = [
        '7.1.117',
        '7.1.143',
        '7.1.154',
        '7.1.143 R-1',
        '7.1.154 R-1',
    ];

    public worlds: World[];
    public search: Search;
    public settings_list: SettingsList;
    public location_list: LocationList;
    public entrance_list: EntranceList;
    public item_list: ItemList;
    public ItemInfo: ItemInfo;

    constructor(
        public user_overrides: any,
        public ootr_version: OotrVersion,
        public file_cache: OotrFileCache,
        public debug: boolean = false,
        public test_only: boolean = false,
    ) {
        super();
        this.worlds = [];
        this.settings_list = new SettingsList(ootr_version, file_cache);
        this.location_list = new LocationList(ootr_version, file_cache);
        this.entrance_list = new EntranceList(ootr_version, file_cache);
        this.item_list = new ItemList(ootr_version, file_cache);

        let valid_cache = Object.keys(this.file_cache.files).length > 0;

        // In python OOTR this is a global variable, but we don't have
        // a static item list file to reference, so initialize as a
        // plugin property instead.
        this.ItemInfo = {
            items: {},
            events: {},
            bottles: new Set(),
            medallions: new Set(),
            stones: new Set(),
            ocarina_buttons: new Set(),
            junk: {},
        };

        if (valid_cache) {
            Object.keys(this.item_list.item_table).map((item_name) => {
                this.ItemInfo.items[item_name] = new _ItemInfo(item_name, this.item_list.item_table);
                if (this.ItemInfo.items[item_name].bottle) {
                    this.ItemInfo.bottles.add(item_name);
                }
                if (this.ItemInfo.items[item_name].medallion) {
                    this.ItemInfo.medallions.add(item_name);
                }
                if (this.ItemInfo.items[item_name].stone) {
                    this.ItemInfo.stones.add(item_name);
                }
                if (this.ItemInfo.items[item_name].ocarina_button) {
                    this.ItemInfo.ocarina_buttons.add(item_name);
                }
                if (this.ItemInfo.items[item_name].junk !== null) {
                    this.ItemInfo.junk[item_name] = this.ItemInfo.items[item_name].junk;
                }
            });
        }

        if (!!user_overrides && valid_cache) {
            this.settings_list.override_settings(user_overrides);
        }

        // If this is a running in a test environment, skip parsing logic
        // as this takes more than a few ms.
        if (test_only || !valid_cache) {
            // won't function correctly as the world logic isn't loaded
            this.search = new Search(this.worlds.map((world) => world.state));
            return;
        }
        this.build_world_graphs(this.settings_list, ootr_version);
        if (Object.keys(this.settings_list).includes('locations')) {
            this.set_items(this.settings_list.locations);
        }
        if (Object.keys(this.settings_list).includes('entrances')) {
            this.set_entrances(this.settings_list.entrances);
        }
        this.finalize_world();
        this.search = new Search(this.worlds.map((world) => world.state));
        this.initialized = true;
    }

    static async create_remote_graph(user_overrides: any = null, version: string = '7.1.143', global_cache: OotrFileCache | null = null, debug: boolean = false, test_only: boolean = false) {
        let ootr_version = new OotrVersion(version);
        let file_cache;
        if (!!global_cache) {
            file_cache = global_cache;
        } else {
            file_cache = await OotrFileCache.load_ootr_files(version);
        }
        return new OotrGraphPlugin(user_overrides, ootr_version, file_cache, debug, test_only);
    }

    static create_graph(user_overrides: any = null, version: string = '7.1.143', global_cache: OotrFileCache, debug: boolean = false, test_only: boolean = false) {
        let ootr_version = new OotrVersion(version);
        return new OotrGraphPlugin(user_overrides, ootr_version, global_cache, debug, test_only);
    }

    get_game_versions(): GraphGameVersions {
        let ootr: GraphGameVersions = {
            game: 'ootr',
            versions: [],
        };

        for (let v of this.version_list) {
            ootr.versions.push(new OotrVersion(v));
        }

        return ootr;
    }

    get_settings_options(): { [setting_name: string]: GraphSetting; } {
        return this.settings_list.setting_definitions;
    }

    collect_locations(): void {
        this.search.collect_locations();
    }

    collect_spheres(): void {
        this.search.collect_spheres();
    }

    get_accessible_entrances(): Entrance[] {
        return Array.from(this.search._cache.visited_entrances);
    }

    get_visited_locations(): Location[] {
        return Array.from(this.search._cache.visited_locations);
    }

    // TODO: implement woth filter
    get_required_locations(): Location[] {
        return Array.from(this.search._cache.visited_locations);
    }

    get_accessible_entrances_for_world(world: GraphWorld): Entrance[] {
        return Array.from(this.search._cache.visited_entrances).filter((e: Entrance): boolean => e.world.id === world.id);
    }

    get_visited_locations_for_world(world: GraphWorld): Location[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    // TODO: implement woth filter
    get_required_locations_for_world(world: GraphWorld): Location[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    // TODO: implement goal filter
    get_required_locations_for_items(world: GraphWorld, goal_items: GraphItem[]): GraphLocation[] {
        return Array.from(this.search._cache.visited_locations).filter((l: Location): boolean => !!l.world && l.world.id === world.id);
    }

    get_collected_items_for_world(world: GraphWorld): {[item_name: string]: number} {
        return this.search.state_list[world.id].prog_items;
    }

    set_location_item(location: GraphLocation, item: GraphItem): void {
        if (location.world !== null) {
            let l: Location = this.worlds[location.world.id].get_location(location.name);
            let i: Item = ItemFactory(item.name, l.world)[0];
            l.item = i;
            i.location = l;
            if (!!location.price) {
                l.price = location.price;
                i.price = location.price;
            }
        } else {
            throw `Attempted to set item for location in non-existent world: ${location.name}`;
        }
    }

    set_entrance(entrance: GraphEntrance, replaced_entrance: GraphEntrance): void {
        let e = this.worlds[entrance.world.id].get_entrance(entrance.name);
        let t = this.worlds[entrance.world.id].get_entrance(replaced_entrance.name);
        if (e.original_connection === null || t.original_connection === null) {
            throw `Attempted to connect entrances with undefined original connections: ${e.name} to ${t.name}`;
        }
        e.connect(t.original_connection);
        e.replaces = t;
        if (!!(e.reverse) && !!(t.reverse) && !!(e.reverse.original_connection)) {
            t.reverse.connect(e.reverse.original_connection);
            t.reverse.replaces = e.reverse;
        }
    }

    build_world_graphs(settings: SettingsList, ootr_version: OotrVersion): void {
        this.worlds = [];
        for (let i = 0; i < settings.settings.world_count; i++) {
            this.worlds.push(new World(i, settings, ootr_version, this));
        }

        let savewarps_to_connect = [];
        for (let world of this.worlds) {
            savewarps_to_connect.push(...(world.load_regions_from_json('Overworld.json')));
            savewarps_to_connect.push(...(world.load_regions_from_json('Bosses.json')));
            savewarps_to_connect.push(...(world.create_dungeons()));
            world.create_internal_locations();

            // add hint rules
        }

        for (let world of this.worlds) {
            world.initialize_entrances();
        }

        for (let [savewarp, replaces] of savewarps_to_connect) {
            if (savewarp.world === null) throw `Attempted to connect savewarp without parent world`;
            savewarp.replaces = savewarp.world.get_entrance(replaces);
            if (savewarp.replaces === null || savewarp.replaces.connected_region === null) throw `Attempted to connect savewarp with no equivalent entrance`;
            savewarp.connect(savewarp.replaces.connected_region);
        }

        for (let world of this.worlds) {
            for (let [type, forward_entry, return_entry] of this.entrance_list.entrances) {
                let forward_entrance = world.get_entrance(forward_entry[0]);
                forward_entrance.type = type;
                forward_entrance.primary = true;
                if (!!return_entry) {
                    let return_entrance = world.get_entrance(return_entry[0]);
                    return_entrance.type = type;
                    forward_entrance.bind_two_way(return_entrance);
                }
            }
        }
    }

    set_items(locations: PlandoLocationList | PlandoMWLocationList): void {
        let filled_locations: PlandoLocationList;
        let adult_trade_items = [
            "Pocket Egg",
            "Pocket Cucco",
            "Cojiro",
            "Odd Mushroom",
            "Odd Potion",
            "Poachers Saw",
            "Broken Sword",
            "Prescription",
            "Eyeball Frog",
            "Eyedrops",
            "Claim Check",
        ];
        let child_trade_items = [
            "Weird Egg",
            "Chicken",
            "Zeldas Letter",
            "Keaton Mask",
            "Skull Mask",
            "Spooky Mask",
            "Bunny Hood",
            "Goron Mask",
            "Zora Mask",
            "Gerudo Mask",
            "Mask of Truth",
        ];
        for (let world of this.worlds) {
            // vanilla item fill based on settings
            for (let loc of world.get_locations()) {
                if (!!(loc.vanilla_item) && !!(loc.parent_region)) {
                    loc.vanilla_item.world = loc.parent_region.world;
                } else if (loc.name === 'Gift from Sages' && !!(world.settings.shuffle_ganon_bosskey)
                            && ['stones', 'medallions', 'dungeons', 'tokens', 'hearts', 'triforce'].includes(world.settings.shuffle_ganon_bosskey)) {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                    continue;
                } else {
                    continue;
                }
                if (loc.name === 'ToT Light Arrows Cutscene' && world.settings.shuffle_ganon_bosskey === 'on_lacs') {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world)[0]);
                } else if (world.settings.shopsanity === 'off' && loc.type === 'Shop') {
                    world.push_vanilla_item(loc);
                } else if ((world.settings.shuffle_scrubs === 'off' || world.settings.shuffle_scrubs === 'regular') && ['Scrub', 'GrottoScrub'].includes(loc.type)) {
                    if (world.settings.shuffle_scrubs === 'off' || !(['Piece of Heart', 'Deku Stick Capacity', 'Deku Nut Capacity'].includes(loc.vanilla_item.name))) {
                        world.push_vanilla_item(loc);
                        if (loc.item === null) throw `Error assigning vanilla scrub item`;
                        loc.item.price = this.location_list.business_scrub_prices[loc.vanilla_item.name];
                    }
                    loc.price = this.location_list.business_scrub_prices[loc.vanilla_item.name];
                } else if (loc.vanilla_item.name === 'Gold Skulltula Token') {
                    if (world.settings.tokensanity === 'off' ||
                        (world.settings.tokensanity === 'dungeons' && !(loc.dungeon())) ||
                        (world.settings.tokensanity === 'overworld' && loc.dungeon())) {
                            world.push_vanilla_item(loc);
                    }
                } else  if (loc.vanilla_item.name === 'Kokiri Sword' && !(world.settings.shuffle_kokiri_sword)) {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Ocarina' && !(world.settings.shuffle_ocarinas)) {
                    world.push_vanilla_item(loc);
                } else if (['Wasteland Bombchu Salesman', 'Kak Granny Buy Blue Potion'].includes(loc.name) && !(world.settings.shuffle_expensive_merchants)) {
                    world.push_vanilla_item(loc);
                } else if (loc.vanilla_item.name === 'Gerudo Membership Card') {
                    // OOTR still fills this location even though the card is manually collected when
                    // fortress is open.
                    if (!(world.settings.shuffle_gerudo_card)) {
                        world.push_vanilla_item(loc);
                    }
                } else if (loc.vanilla_item.name == 'Buy Magic Bean' && !(world.settings.shuffle_beans)) {
                    world.push_vanilla_item(loc);
                } else if (adult_trade_items.includes(loc.vanilla_item.name)) {
                    if (!(world.settings.adult_trade_shuffle)) {
                        if (loc.vanilla_item.name !== 'Pocket Egg' || (!!(world.settings.adult_trade_start) && world.settings.adult_trade_start.length === 0)) {
                            world.push_vanilla_item(loc);
                        }
                    } else {
                        if (!(!!(world.settings.adult_trade_start) && world.settings.adult_trade_start.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Pocket Egg') {
                            world.push_vanilla_item(loc);
                        }
                        if (loc.vanilla_item.name === 'Pocket Egg' && !!(world.settings.adult_trade_start)
                            && !(world.settings.adult_trade_start.includes('Pocket Egg')) && !(world.settings.adult_trade_start.includes('Pocket Cucco'))) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (child_trade_items.includes(loc.vanilla_item.name)) {
                    if (!(!!(world.settings.shuffle_child_trade) && world.settings.shuffle_child_trade.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Weird Egg') {
                        world.push_vanilla_item(loc);
                    } else if (loc.vanilla_item.name === 'Weird Egg' && !!(world.settings.shuffle_child_trade) && !(world.settings.shuffle_child_trade.includes('Weird Egg')) && !(world.settings.shuffle_child_trade.includes('Chicken'))) {
                        if (!(world.skip_child_zelda)) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Thieves Hideout)' && world.settings.shuffle_hideoutkeys === 'vanilla') {
                    if (world.settings.gerudo_fortress !== 'open' &&
                        (loc.name === 'Hideout 1 Torch Jail Gerudo Key' || world.settings.gerudo_fortress !== 'fast')) {
                            world.push_vanilla_item(loc);
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Treasure Chest Game)' && world.settings.shuffle_tcgkeys === 'vanilla') {
                    // small key rings not implemented for vanilla keys (would otherwise skip lens of truth requirement)
                    world.push_vanilla_item(loc);
                } else if (['Event', 'Drop'].includes(loc.type) && !!(loc.vanilla_item)) {
                    // hard-coded events from the location list that don't auto-generate items of the same name
                    world.push_vanilla_item(loc);
                } else if (['Market Bombchu Bowling Bombchus', 'Market Bombchu Bowling Bomb'].includes(loc.name)) {
                    // never shuffled locations relevant to logic
                    world.push_vanilla_item(loc);
                } else if (!!(loc.dungeon())) {
                    let dungeon = loc.dungeon();
                    let dungeon_text = (text: string, dungeon: string | null): string => `${text} (${dungeon})`;
                    let shuffle_setting = '';

                    if (loc.vanilla_item.name === dungeon_text('Boss Key', dungeon)) {
                        shuffle_setting = dungeon !== 'Ganons Castle' ? <string>world.settings.shuffle_bosskeys : <string>world.settings.shuffle_ganon_bosskey;
                        // OOTR bug, BKs are starting items if key rings are on,
                        // key rings give BKs, and small keysy is on
                        if (!!(world.settings.key_rings) && !!dungeon && world.settings.key_rings.includes(dungeon) && dungeon !== 'Ganons Castle' && world.settings.keyring_give_bk && world.settings.shuffle_smallkeys == 'remove') {
                            world.state.collect(loc.vanilla_item);
                        }
                    } else if (loc.vanilla_item.name === dungeon_text('Small Key', dungeon)) {
                        shuffle_setting = <string>world.settings.shuffle_smallkeys;
                    } else if (loc.type === 'SilverRupee') {
                        shuffle_setting = <string>world.settings.shuffle_silver_rupees;
                    }
                    if (shuffle_setting === 'vanilla') {
                        world.push_vanilla_item(loc);
                    } else if (['remove', 'startwith'].includes(shuffle_setting)) {
                        // important to do at this stage instead of with other skipped item collection
                        // so that the correct number of keys/silver rupees are in world state
                        world.state.collect(loc.vanilla_item);
                    }
                }
            }
            // user fill overrides
            if (world.settings.world_count > 1) {
                filled_locations = <PlandoLocationList>(locations[`World ${world.id + 1}`]);
            } else {
                filled_locations = <PlandoLocationList>locations;
            }
            for (let [location, item] of Object.entries(filled_locations)) {
                if (typeof(item) === 'string') {
                    let world_item = ItemFactory(item, world)[0];
                    world.get_location(location).item = world_item;
                } else {
                    // dict-style for ice traps and shop items
                    let world_item: Item;
                    if (!!item.player) {
                        world_item = ItemFactory(item.item, this.worlds[item.player-1])[0];
                    } else {
                        world_item = ItemFactory(item.item, world)[0];
                    }
                    if (!!item.price) {
                        world_item.price = item.price;
                    }
                    let world_location = world.get_location(location);
                    world_location.item = world_item;
                    world_location.price = world_item.price;
                }
            }
        }
    }

    set_entrances(entrances: PlandoEntranceList | PlandoMWEntranceList): void {
        let connected_entrances: PlandoEntranceList;
        for (let world of this.worlds) {
            // disconnect all shuffled entrances
            for (let entrance of world.get_entrances()) {
                if (!!(entrance.type) && world.shuffled_entrance_types.includes(entrance.type)) {
                    entrance.disconnect();
                }
            }
            // Special handling for spawns since they have the same type but
            // can be individually shuffled (why...)
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('child')) {
                let entrance = world.get_entrance('Child Spawn -> KF Links House');
                entrance.disconnect();
            }
            if (!!(world.settings.spawn_positions) && world.settings.spawn_positions.includes('adult')) {
                let entrance = world.get_entrance('Adult Spawn -> Temple of Time');
                entrance.disconnect();
            }

            // reconnect only shuffled entrances with user targets
            if (world.settings.world_count > 1) {
                connected_entrances = <PlandoEntranceList>entrances[`World ${world.id + 1}`];
            } else {
                connected_entrances = <PlandoEntranceList>entrances;
            }
            for (let [entrance, target] of Object.entries(connected_entrances)) {
                let dest = world.get_entrance_from_target(target);
                let src = world.get_entrance(entrance);
                if (dest.original_connection === null) throw `Plando tried to connect entrance target without original region connection`;
                src.connect(dest.original_connection);
                src.replaces = dest;
                if (!!(src.reverse) && !!(dest.reverse) && !!(src.reverse.original_connection)) {
                    dest.reverse.connect(src.reverse.original_connection);
                    dest.reverse.replaces = src.reverse;
                }
            }

            // adjust blue warp exits based on dungeon/boss shuffles, if enabled
            if (world.shuffle_dungeon_entrances || world.settings.shuffle_bosses !== 'off') {
                this.set_blue_warps(world);
            }
        }
    }

    finalize_world(): void {
        // must run after item fill to allow location table names
        // to line up during fill and prices to get set
        for (let world of this.worlds) {
            this.set_shop_rules(world);
            this.set_drop_location_names(world);
            world.state.collect_starting_items();
            this.collect_skipped_locations(world);
        }
    }

    set_blue_warps(world: World): void {
        // Determine blue warp targets
        // if a boss room is inside a boss door, make the blue warp go outside the dungeon's entrance
        let boss_exits: {[e: string]: Entrance} = {
            'Queen Gohma Boss Room -> Deku Tree Before Boss': world.get_entrance('Deku Tree Lobby -> KF Outside Deku Tree'),
            'King Dodongo Boss Room -> Dodongos Cavern Mouth': world.get_entrance('Dodongos Cavern Beginning -> Death Mountain'),
            'Barinade Boss Room -> Jabu Jabus Belly Before Boss': world.get_entrance('Jabu Jabus Belly Beginning -> Zoras Fountain'),
            'Phantom Ganon Boss Room -> Forest Temple Before Boss': world.get_entrance('Forest Temple Lobby -> SFM Forest Temple Entrance Ledge'),
            'Volvagia Boss Room -> Fire Temple Before Boss': world.get_entrance('Fire Temple Lower -> DMC Fire Temple Entrance'),
            'Morpha Boss Room -> Water Temple Before Boss': world.get_entrance('Water Temple Lobby -> Lake Hylia'),
            'Bongo Bongo Boss Room -> Shadow Temple Before Boss': world.get_entrance('Shadow Temple Entryway -> Graveyard Warp Pad Region'),
            'Twinrova Boss Room -> Spirit Temple Before Boss': world.get_entrance('Spirit Temple Lobby -> Desert Colossus From Spirit Lobby'),
        };
        // if a boss room is inside a dungeon entrance (or inside a dungeon which is inside a dungeon entrance), make the blue warp go to that dungeon's blue warp target
        let dungeon_exits: {[e: string]: Entrance} = {
            'Deku Tree Lobby -> KF Outside Deku Tree': world.get_entrance('Queen Gohma Boss Room -> KF Outside Deku Tree'),
            'Dodongos Cavern Beginning -> Death Mountain': world.get_entrance('King Dodongo Boss Room -> Death Mountain'),
            'Jabu Jabus Belly Beginning -> Zoras Fountain': world.get_entrance('Barinade Boss Room -> Zoras Fountain'),
            'Forest Temple Lobby -> SFM Forest Temple Entrance Ledge': world.get_entrance('Phantom Ganon Boss Room -> Sacred Forest Meadow'),
            'Fire Temple Lower -> DMC Fire Temple Entrance': world.get_entrance('Volvagia Boss Room -> DMC Central Local'),
            'Water Temple Lobby -> Lake Hylia': world.get_entrance('Morpha Boss Room -> Lake Hylia'),
            'Shadow Temple Entryway -> Graveyard Warp Pad Region': world.get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region'),
            'Spirit Temple Lobby -> Desert Colossus From Spirit Lobby': world.get_entrance('Twinrova Boss Room -> Desert Colossus'),
        };
        let blue_warps: [Entrance, Entrance][] = [
            [world.get_entrance('Queen Gohma Boss Room -> KF Outside Deku Tree'), world.get_entrance('Queen Gohma Boss Room -> Deku Tree Before Boss')],
            [world.get_entrance('King Dodongo Boss Room -> Death Mountain'), world.get_entrance('King Dodongo Boss Room -> Dodongos Cavern Mouth')],
            [world.get_entrance('Barinade Boss Room -> Zoras Fountain'), world.get_entrance('Barinade Boss Room -> Jabu Jabus Belly Before Boss')],
            [world.get_entrance('Phantom Ganon Boss Room -> Sacred Forest Meadow'), world.get_entrance('Phantom Ganon Boss Room -> Forest Temple Before Boss')],
            [world.get_entrance('Volvagia Boss Room -> DMC Central Local'), world.get_entrance('Volvagia Boss Room -> Fire Temple Before Boss')],
            [world.get_entrance('Morpha Boss Room -> Lake Hylia'), world.get_entrance('Morpha Boss Room -> Water Temple Before Boss')],
            [world.get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region'), world.get_entrance('Bongo Bongo Boss Room -> Shadow Temple Before Boss')],
            [world.get_entrance('Twinrova Boss Room -> Desert Colossus'), world.get_entrance('Twinrova Boss Room -> Spirit Temple Before Boss')],
        ];

        for (let [blue_warp, boss_door_exit] of blue_warps) {
            let target = this.get_original_or_replaced_entrance(boss_door_exit);
            if (true) { //TODO not world.settings.decouple_entrances
                while (true) {
                    if (target === null) {
                        break;
                    }
                    if (!(target.name in boss_exits)) {
                        break;
                    }
                    target = boss_exits[target.name].replaces || boss_exits[target.name];
                }
                if (!!target) {
                    if (target.name in dungeon_exits) {
                        target = dungeon_exits[target.name];
                    }
                }
            }
            blue_warp.disconnect();
            if (!!target) {
                blue_warp.connect(world.get_region(target.name.split(' -> ')[1]));
                blue_warp.replaces = target;
            }
        }
    }

    get_original_or_replaced_entrance(entrance: Entrance): Entrance | null {
        let ret: Entrance;
        if (!!(entrance.replaces)) {
            ret = entrance.replaces;
        } else {
            ret = entrance;
        }
        // only provide a target if the provided entrance is connected
        // in order to work with partially connected worlds
        if (!!(ret.connected_region)) {
            return ret;
        } else {
            return null;
        }
    }

    set_drop_location_names(world: World): void {
        for (let loc of world.get_locations()) {
            if (loc.type === 'Drop' && !!(loc.parent_region)) {
                loc.name = `${loc.parent_region.name} ${loc.name}`;
            }
        }
    }

    set_shop_rules(world: World): void {
        let found_bombchus = world.parser.parse_rule('found_bombchus');
        let wallet = world.parser.parse_rule('Progressive_Wallet');
        let wallet2 = world.parser.parse_rule('(Progressive_Wallet, 2)');
        let wallet3 = world.parser.parse_rule('(Progressive_Wallet, 3)');
        let is_adult = world.parser.parse_rule('is_adult');
        let has_bottle = world.parser.parse_rule('has_bottle');
        let adult_items = [
            'Buy Goron Tunic',
            'Buy Zora Tunic',
        ];
        let bottle_items = [
            'Buy Blue Fire',
            'Buy Blue Potion',
            'Buy Bottle Bug',
            'Buy Fish',
            'Buy Green Potion',
            'Buy Poe',
            'Buy Red Potion for 30 Rupees',
            'Buy Red Potion for 40 Rupees',
            'Buy Red Potion for 50 Rupees',
            'Buy Fairy\'s Spirit',
        ];
        let bombchu_items = [
            'Buy Bombchu (10)',
            'Buy Bombchu (20)',
            'Buy Bombchu (5)',
        ];
        for (let loc of world.get_locations()) {
            if (!!(loc.price)) {
                if (loc.price > 500) {
                    loc.add_rule(wallet3);
                } else if (loc.price > 200) {
                    loc.add_rule(wallet2);
                } else if (loc.price > 99) {
                    loc.add_rule(wallet);
                }
            }
            if (!!(loc.item)) {
                if (adult_items.includes(loc.item.name)) {
                    loc.add_rule(is_adult);
                }
                if (bottle_items.includes(loc.item.name)) {
                    loc.add_rule(has_bottle);
                }
                if (bombchu_items.includes(loc.item.name)) {
                    loc.add_rule(found_bombchus);
                }
            }
        }
    }

    collect_skipped_locations(world: World): void {
        world.skipped_locations.push(world.get_location('Links Pocket'));
        if (!(world.settings.shuffle_gerudo_card) && world.settings.gerudo_fortress === 'open') {
            world.state.collect(ItemFactory('Gerudo Membership Card', world)[0]);
            world.skipped_locations.push(world.get_location('Hideout Gerudo Membership Card'));
        }
        if (world.skip_child_zelda) {
            world.state.collect(ItemFactory('Weird Egg', world)[0]);
            for (let loc_name of ['HC Zeldas Letter', 'Song from Impa']) {
                world.skipped_locations.push(world.get_location(loc_name));
            }
        }
        if (world.settings.free_scarecrow) {
            world.state.collect(ItemFactory('Scarecrow Song', world)[0]);
        }
        if (world.settings.no_epona_race) {
            world.state.collect(ItemFactory('Epona', world, true)[0]);
        }
        if (world.settings.shuffle_smallkeys === 'vanilla') {
            if (world.dungeon_mq['Spirit Temple']) {
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world)[0]);
            }
            if (!!(world.settings.dungeon_shortcuts) && world.settings.dungeon_shortcuts.includes('Shadow Temple')) {
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world)[0]);
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world)[0]);
            }
        }
        if (!(world.keysanity) && !(world.dungeon_mq['Fire Temple'])) {
            world.state.collect(ItemFactory('Small Key (Fire Temple)', world)[0]);
        }
        if (world.settings.shuffle_tcgkeys === 'remove') {
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world)[0]);
        }
        if (!(world.settings.shuffle_individual_ocarina_notes) && this.ootr_version.gte('7.1.138')) {
            world.state.collect(ItemFactory('Ocarina A Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C up Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C down Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C left Button', world)[0]);
            world.state.collect(ItemFactory('Ocarina C right Button', world)[0]);
        }
        // TODO: empty dungeons
    }
}

export default OotrGraphPlugin;