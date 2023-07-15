const SettingsList = require('./SettingsList.js');
const World = require("./World");
const entrance_shuffle_table = require('./EntranceList.js');
const { business_scrub_prices } = require('./LocationList.js');
const Search = require("./Search");
const { ItemFactory } = require("./Item");
const OotrVersion = require('./OotrVersion.js');

class WorldGraph {
    constructor(user_overrides=null, ootr_version=new OotrVersion('7.1.143'), debug=false) {
        let settings_list = new SettingsList(ootr_version);
        let settings = {settings: settings_list.settings};
        settings.settings.debug_parser = debug;
        this.worlds = [];
        if (!!user_overrides) {
            var merged_settings = this.merge_settings(settings, user_overrides);
            if (Object.keys(user_overrides.settings).includes('allowed_tricks')) {
                for (let trick of user_overrides.settings.allowed_tricks) {
                    merged_settings.settings[trick] = true;
                }
            }
        }
        this.build_world_graphs(merged_settings, ootr_version);
        if (Object.keys(merged_settings).includes('locations')) {
            this.fill_items(merged_settings.locations);
        }
        if (Object.keys(merged_settings).includes('entrances')) {
            this.set_entrances(merged_settings.entrances);
        }
        // must run after item fill to allow location table names
        // to line up during fill and prices to get set
        for (let world of this.worlds) {
            this.set_shop_rules(world);
            this.set_drop_location_names(world);
            world.state.collect_starting_items();
            this.collect_skipped_locations(world);
        }
        this.search = new Search(this.worlds.map((world) => world.state));
    }

    // for some reason, _.merge was mixing starting_items and hint_dist_user,
    // so instead of that, use a custom merge function for base settings and
    // the plando file
    merge_settings(original, override) {
        let merged_settings = {};
        let merged_object;
        for (let [k, v] of Object.entries(original)) {
            if (Object.keys(override).includes(k)) {
                if (typeof(v) === 'object') {
                    if (Array.isArray(v)) {
                        merged_settings[k] = override[k];
                    } else {
                        merged_object = this.merge_settings(v, override[k]);
                        merged_settings[k] = merged_object;
                    }
                } else {
                    merged_settings[k] = override[k];
                }
            } else {
                merged_settings[k] = v;
            }
        }
        for (let [k, v] of Object.entries(override)) {
            if (!(Object.keys(original).includes(k))) {
                merged_settings[k] = v;
            }
        }
        return merged_settings;
    }

    build_world_graphs(settings, ootr_version) {
        this.worlds = [];
        for (let i = 0; i < settings.settings.world_count; i++) {
            this.worlds.push(new World(i, settings, ootr_version));
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
            savewarp.replaces = savewarp.world.get_entrance(replaces);
            savewarp.connect(savewarp.replaces.connected_region);
        }

        for (let world of this.worlds) {
            for (let [type, forward_entry, return_entry] of entrance_shuffle_table) {
                let forward_entrance = world.get_entrance(forward_entry[0]);
                forward_entrance.data = forward_entry[1];
                forward_entrance.type = type;
                forward_entrance.primary = true;
                if (type === 'Grotto') {
                    forward_entrance.data.index = 0x1000 + forward_entrance.data.grotto_id;
                }
                if (!!return_entry) {
                    let return_entrance = world.get_entrance(return_entry[0]);
                    return_entrance.data = return_entry[1];
                    return_entrance.type = type;
                    return_entrance.primary = true;
                    forward_entrance.bind_two_way(return_entrance);
                    if (type === 'Grotto') {
                        return_entrance.data.index = 0x7FFF;
                    }
                }
            }
        }
    }

    fill_items(locations) {
        let filled_locations;
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
            let replacement_vanilla_item;
            for (let loc of world.get_locations()) {
                if (!!(loc.vanilla_item)) {
                    loc.vanilla_item.world = loc.parent_region.world;
                } else if (loc.name === 'Gift from Sages' && ['stones', 'medallions', 'dungeons', 'tokens', 'hearts', 'triforce'].includes(world.settings.shuffle_ganon_bosskey)) {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world));
                    continue;
                } else {
                    continue;
                }
                if (loc.name === 'ToT Light Arrows Cutscene' && world.settings.shuffle_ganon_bosskey === 'on_lacs') {
                    world.push_item(loc, ItemFactory('Boss Key (Ganons Castle)', world));
                } else if (world.settings.shopsanity === 'off' && loc.type === 'Shop') {
                    world.push_vanilla_item(loc);
                } else if ((world.settings.shuffle_scrubs === 'off' || world.settings.shuffle_scrubs === 'regular') && ['Scrub', 'GrottoScrub'].includes(loc.type)) {
                    if (world.settings.shuffle_scrubs === 'off' || !(['Piece of Heart', 'Deku Stick Capacity', 'Deku Nut Capacity'].includes(loc.vanilla_item.name))) {
                        world.push_vanilla_item(loc);
                        loc.item.price = business_scrub_prices[loc.vanilla_item.name];
                    }
                    loc.price = business_scrub_prices[loc.vanilla_item.name];
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
                        if (loc.vanilla_item.name !== 'Pocket Egg' || world.settings.adult_trade_start.length === 0) {
                            world.push_vanilla_item(loc);
                        }
                    } else {
                        if (!(world.settings.adult_trade_start.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Pocket Egg') {
                            world.push_vanilla_item(loc);
                        }
                        if (loc.vanilla_item.name === 'Pocket Egg' && !(world.settings.adult_trade_start.includes('Pocket Egg')) && !(world.settings.adult_trade_start.includes('Pocket Cucco'))) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (child_trade_items.includes(loc.vanilla_item.name)) {
                    if (!(world.settings.shuffle_child_trade.includes(loc.vanilla_item.name)) && loc.vanilla_item.name !== 'Weird Egg') {
                        world.push_vanilla_item(loc);
                    } else if (loc.vanilla_item.name === 'Weird Egg' && !(world.settings.shuffle_child_trade.includes('Weird Egg')) && !(world.settings.shuffle_child_trade.includes('Chicken'))) {
                        if (!(world.skip_child_zelda)) {
                            world.push_vanilla_item(loc);
                        }
                    }
                } else if (loc.vanilla_item.name === 'Small Key (Thieves Hideout)' && world.settings.shuffle_hideoutkeys === 'vanilla') {
                    if (world.settings.gerudo_fortress !== 'open' && 
                        (loc.name === 'Hideout 1 Torch Jail Gerudo Key' ||
                        (world.settings.gerudo_fortress !== 'fast' && !(world.settings.key_rings.includes('Thieves Hideout'))))) {
                            world.push_vanilla_item(loc);
                    }
                    if (loc.name === 'Hideout 1 Torch Jail Gerudo Key' && world.settings.key_rings.includes('Thieves Hideout') && world.settings.gerudo_fortress !== 'open') {
                        world.push_item(loc, ItemFactory('Small Key Ring (Thieves Hideout)', world));
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
                    let dungeon_text = (text, dungeon) => `${text} (${dungeon})`;
                    let shuffle_setting = '';

                    if (loc.vanilla_item.name === dungeon_text('Boss Key', dungeon)) {
                        shuffle_setting = dungeon !== 'Ganons Castle' ? world.settings.shuffle_bosskeys : world.settings.shuffle_ganon_bosskey;
                    } else if (loc.vanilla_item.name === dungeon_text('Small Key', dungeon)) {
                        shuffle_setting = world.settings.shuffle_smallkeys;
                    } else if (loc.type === 'SilverRupee') {
                        shuffle_setting = world.settings.shuffle_silver_rupees;
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
                filled_locations = locations[`World ${world.id + 1}`];
            } else {
                filled_locations = locations;
            }
            for (let [location, item] of Object.entries(filled_locations)) {
                if (typeof(item) === 'string') {
                    let world_item = ItemFactory(item, world);
                    world.get_location(location).item = world_item;
                } else {
                    // dict-style for ice traps and shop items
                    let world_item
                    if (Object.keys(item).includes('player')) {
                        world_item = ItemFactory(item.item, this.worlds[item.player-1]);
                    } else {
                        world_item = ItemFactory(item.item, world);
                    }
                    if (Object.keys(item).includes('price')) {
                        world_item.price = item.price;
                    }
                    let world_location = world.get_location(location);
                    world_location.item = world_item;
                    world_location.price = world_item.price;
                }
            }
        }
    }

    set_entrances(entrances) {
        let connected_entrances;
        for (let world of this.worlds) {
            // disconnect all shuffled entrances
            for (let entrance of world.get_entrances()) {
                if (world.shuffled_entrance_types.includes(entrance.type)) {
                    entrance.disconnect();
                }
            }
            // Special handling for spawns since they have the same type but
            // can be individually shuffled (why...)
            if (world.settings.spawn_positions.includes('child')) {
                let entrance = world.get_entrance('Child Spawn -> KF Links House');
                entrance.disconnect();
            }
            if (world.settings.spawn_positions.includes('adult')) {
                let entrance = world.get_entrance('Adult Spawn -> Temple of Time');
                entrance.disconnect();
            }

            // reconnect only shuffled entrances with user targets
            if (world.settings.world_count > 1) {
                connected_entrances = entrances[`World ${world.id + 1}`];
            } else {
                connected_entrances = entrances;
            }
            for (let [entrance, target] of Object.entries(connected_entrances)) {
                let dest = world.get_entrance_from_target(target);
                let src = world.get_entrance(entrance);
                src.connect(dest.original_connection);
                src.replaces = dest;
                if (!!(src.reverse)) {
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

    set_blue_warps(world) {
        // Determine blue warp targets
        // if a boss room is inside a boss door, make the blue warp go outside the dungeon's entrance
        let boss_exits = {
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
        let dungeon_exits = {
            'Deku Tree Lobby -> KF Outside Deku Tree': world.get_entrance('Queen Gohma Boss Room -> KF Outside Deku Tree'),
            'Dodongos Cavern Beginning -> Death Mountain': world.get_entrance('King Dodongo Boss Room -> Death Mountain'),
            'Jabu Jabus Belly Beginning -> Zoras Fountain': world.get_entrance('Barinade Boss Room -> Zoras Fountain'),
            'Forest Temple Lobby -> SFM Forest Temple Entrance Ledge': world.get_entrance('Phantom Ganon Boss Room -> Sacred Forest Meadow'),
            'Fire Temple Lower -> DMC Fire Temple Entrance': world.get_entrance('Volvagia Boss Room -> DMC Central Local'),
            'Water Temple Lobby -> Lake Hylia': world.get_entrance('Morpha Boss Room -> Lake Hylia'),
            'Shadow Temple Entryway -> Graveyard Warp Pad Region': world.get_entrance('Bongo Bongo Boss Room -> Graveyard Warp Pad Region'),
            'Spirit Temple Lobby -> Desert Colossus From Spirit Lobby': world.get_entrance('Twinrova Boss Room -> Desert Colossus'),
        };
        let blue_warps = [
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

    get_original_or_replaced_entrance(entrance) {
        let ret;
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

    set_drop_location_names(world) {
        for (let loc of world.get_locations()) {
            if (loc.type === 'Drop') {
                loc.name = `${loc.parent_region.name} ${loc.name}`;
            }
        }
    }

    set_shop_rules(world) {
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

    collect_skipped_locations(world) {
        if (!(world.settings.shuffle_gerudo_card) && world.settings.gerudo_fortress === 'open') {
            world.state.collect(ItemFactory('Gerudo Membership Card', world));
        }
        if (world.skip_child_zelda) {
            world.state.collect(ItemFactory('Weird Egg', world));
            for (let loc_name of ['HC Zeldas Letter', 'Song from Impa']) {
                let loc = world.get_location(loc_name);
                if (!!(loc.item)) {
                    world.state.collect(loc.item);
                }
            }
        }
        if (world.settings.free_scarecrow) {
            world.state.collect(ItemFactory('Scarecrow Song', world));
        }
        if (world.settings.no_epona_race) {
            world.state.collect(ItemFactory('Epona', world, true));
        }
        if (world.settings.shuffle_smallkeys === 'vanilla') {
            if (world.dungeon_mq['Spirit Temple']) {
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world));
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world));
                world.state.collect(ItemFactory('Small Key (Spirit Temple)', world));
            }
            if (world.settings.dungeon_shortcuts.includes('Shadow Temple')) {
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world));
                world.state.collect(ItemFactory('Small Key (Shadow Temple)', world));
            }
        }
        if (!(world.keysanity) && !(world.dungeon_mq['Fire Temple'])) {
            world.state.collect(ItemFactory('Small Key (Fire Temple)', world));
        }
        if (world.settings.shuffle_tcgkeys === 'remove') {
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
            world.state.collect(ItemFactory('Small Key (Treasure Chest Game)', world));
        }
        if (!(world.settings.shuffle_individual_ocarina_notes)) {
            world.state.collect(ItemFactory('Ocarina A Button', world));
            world.state.collect(ItemFactory('Ocarina C up Button', world));
            world.state.collect(ItemFactory('Ocarina C down Button', world));
            world.state.collect(ItemFactory('Ocarina C left Button', world));
            world.state.collect(ItemFactory('Ocarina C right Button', world));
        }
        // TODO: empty dungeons
    }
}

module.exports = WorldGraph;