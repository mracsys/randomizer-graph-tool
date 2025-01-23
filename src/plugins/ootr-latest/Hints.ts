import { GraphHint, GraphRegion, GraphLocation, GraphEntrance, GraphItem, GraphHintGoal } from "../GraphPlugin.js";

type _HintArea = {
    vague_preposition: string | null,
    clear_preposition: string | null,
    str: string,
    short_name: string | null,
    color: string,
    dungeon_name: string | null,
    abbreviation: string,
}

type HintAreaDict = {
    [area: string]: _HintArea
}

export const HintAreas: HintAreaDict = {
    ROOT                   : {vague_preposition: 'in',     clear_preposition: 'in',     str: "Link's pocket",              short_name: 'Free',                   color: 'White',      dungeon_name: null,                     abbreviation: 'FREE'},
    DEKU_TREE              : {vague_preposition: 'inside', clear_preposition: 'inside', str: 'the Deku Tree',              short_name: "Deku Tree",              color: 'Green',      dungeon_name: 'Deku Tree',              abbreviation: 'DEKU'},
    DODONGOS_CAVERN        : {vague_preposition: 'within', clear_preposition: 'in',     str: "Dodongo's Cavern",           short_name: "Dodongo's Cavern",       color: 'Red',        dungeon_name: 'Dodongos Cavern',        abbreviation: 'DCVN'},
    JABU_JABUS_BELLY       : {vague_preposition: 'in',     clear_preposition: 'inside', str: "Jabu Jabu's Belly",          short_name: "Jabu Jabu's Belly",      color: 'Blue',       dungeon_name: 'Jabu Jabus Belly',       abbreviation: 'JABU'},
    FOREST_TEMPLE          : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Forest Temple',          short_name: "Forest Temple",          color: 'Green',      dungeon_name: 'Forest Temple',          abbreviation: 'FRST'},
    FIRE_TEMPLE            : {vague_preposition: 'on',     clear_preposition: 'in',     str: 'the Fire Temple',            short_name: "Fire Temple",            color: 'Red',        dungeon_name: 'Fire Temple',            abbreviation: 'FIRE'},
    WATER_TEMPLE           : {vague_preposition: 'under',  clear_preposition: 'in',     str: 'the Water Temple',           short_name: "Water Temple",           color: 'Blue',       dungeon_name: 'Water Temple',           abbreviation: 'WATR'},
    SPIRIT_TEMPLE          : {vague_preposition: 'inside', clear_preposition: 'in',     str: 'the Spirit Temple',          short_name: "Spirit Temple",          color: 'Yellow',     dungeon_name: 'Spirit Temple',          abbreviation: 'SPRT'},
    SHADOW_TEMPLE          : {vague_preposition: 'within', clear_preposition: 'in',     str: 'the Shadow Temple',          short_name: "Shadow Temple",          color: 'Pink',       dungeon_name: 'Shadow Temple',          abbreviation: 'SHDW'},
    INSIDE_GANONS_CASTLE   : {vague_preposition: 'inside', clear_preposition: null,     str: "inside Ganon's Castle",      short_name: "Ganon's Castle",         color: 'Light Blue', dungeon_name: 'Ganons Castle',          abbreviation: 'IGC'},
    BOTTOM_OF_THE_WELL     : {vague_preposition: 'within', clear_preposition: 'at',     str: 'the Bottom of the Well',     short_name: "Bottom of the Well",     color: 'Pink',       dungeon_name: 'Bottom of the Well',     abbreviation: 'WELL'},
    GERUDO_TRAINING_GROUND : {vague_preposition: 'within', clear_preposition: 'on',     str: 'the Gerudo Training Ground', short_name: "Gerudo Training Ground", color: 'Yellow',     dungeon_name: 'Gerudo Training Ground', abbreviation: 'GTG'},
    ICE_CAVERN             : {vague_preposition: 'inside', clear_preposition: 'in'    , str: 'the Ice Cavern',             short_name: "Ice Cavern",             color: 'Blue',       dungeon_name: 'Ice Cavern',             abbreviation: 'ICE'},
    DESERT_COLOSSUS        : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'the Desert Colossus',        short_name: "Desert Colossus",        color: 'Yellow',     dungeon_name: null,                     abbreviation: 'COLO'},
    ZORAS_DOMAIN           : {vague_preposition: 'at',     clear_preposition: 'at',     str: "Zora's Domain",              short_name: "Zora's Domain",          color: 'Blue',       dungeon_name: null,                     abbreviation: 'DMAN'},
    DEATH_MOUNTAIN_CRATER  : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Death Mountain Crater',  short_name: "Death Mountain Crater",  color: 'Red',        dungeon_name: null,                     abbreviation: 'DMC'},
    DEATH_MOUNTAIN_TRAIL   : {vague_preposition: 'on',     clear_preposition: 'on',     str: 'the Death Mountain Trail',   short_name: "Death Mountain Trail",   color: 'Red',        dungeon_name: null,                     abbreviation: 'DMT'},
    HYRULE_FIELD           : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'Hyrule Field',               short_name: 'Hyrule Field',           color: 'Light Blue', dungeon_name: null,                     abbreviation: 'FLD'},
    ZORAS_FOUNTAIN         : {vague_preposition: 'at',     clear_preposition: 'at',     str: "Zora's Fountain",            short_name: "Zora's Fountain",        color: 'Blue',       dungeon_name: null,                     abbreviation: 'FNTN'},
    GERUDO_FORTRESS        : {vague_preposition: 'at',     clear_preposition: 'at',     str: "Gerudo's Fortress",          short_name: "Gerudo Fortress",        color: 'Yellow',     dungeon_name: null,                     abbreviation: 'FORT'},
    GANONDORFS_CHAMBER     : {vague_preposition: 'in',     clear_preposition: 'in',     str: "Ganondorf's Chamber",        short_name: "Ganon's Tower",          color: 'Light Blue', dungeon_name: null,                     abbreviation: 'GAN'}, // Need to update this if the chamber is ever shuffled from the tower (please no)
    GORON_CITY             : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'Goron City',                 short_name: "Goron City",             color: 'Red',        dungeon_name: null,                     abbreviation: 'GORO'},
    GRAVEYARD              : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Graveyard',              short_name: "Graveyard",              color: 'Pink',       dungeon_name: null,                     abbreviation: 'GRAV'},
    CASTLE_GROUNDS         : {vague_preposition: 'on',     clear_preposition: 'on',     str: 'the Castle Grounds',         short_name: null,                     color: 'Light Blue', dungeon_name: null,                     abbreviation: 'GRND'},
    THIEVES_HIDEOUT        : {vague_preposition: 'in',     clear_preposition: 'in',     str: "the Thieves' Hideout",       short_name: "Thieves' Hideout",       color: 'Yellow',     dungeon_name: null,                     abbreviation: 'HIDE'},
    HYRULE_CASTLE          : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'Hyrule Castle',              short_name: 'Hyrule Castle',          color: 'Light Blue', dungeon_name: null,                     abbreviation: 'HYCA'},
    KAKARIKO_VILLAGE       : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'Kakariko Village',           short_name: "Kakariko Village",       color: 'Pink',       dungeon_name: null,                     abbreviation: 'KAK'},
    KOKIRI_FOREST          : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'Kokiri Forest',              short_name: "Kokiri Forest",          color: 'Green',      dungeon_name: null,                     abbreviation: 'KOK'},
    LAKE_HYLIA             : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'Lake Hylia',                 short_name: "Lake Hylia",             color: 'Blue',       dungeon_name: null,                     abbreviation: 'LAKE'},
    LON_LON_RANCH          : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'Lon Lon Ranch',              short_name: 'Lon Lon Ranch',          color: 'Light Blue', dungeon_name: null,                     abbreviation: 'LLR'},
    LOST_WOODS             : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Lost Woods',             short_name: "Lost Woods",             color: 'Green',      dungeon_name: null,                     abbreviation: 'LOST'},
    SACRED_FOREST_MEADOW   : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'the Sacred Forest Meadow',   short_name: "Sacred Forest Meadow",   color: 'Green',      dungeon_name: null,                     abbreviation: 'MEAD'},
    MARKET                 : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Market',                 short_name: 'Market',                 color: 'Light Blue', dungeon_name: null,                     abbreviation: 'MRKT'},
    OUTSIDE_GANONS_CASTLE  : {vague_preposition: null,     clear_preposition: null,     str: "outside Ganon's Castle",     short_name: "Outside Ganon's Castle", color: 'Light Blue', dungeon_name: null,                     abbreviation: 'OGC'},
    ZORA_RIVER             : {vague_preposition: 'at',     clear_preposition: 'at',     str: "Zora's River",               short_name: "Zora River",             color: 'Blue',       dungeon_name: null,                     abbreviation: 'RIVR'},
    TEMPLE_OF_TIME         : {vague_preposition: 'inside', clear_preposition: 'inside', str: 'the Temple of Time',         short_name: 'Temple of Time',         color: 'Light Blue', dungeon_name: null,                     abbreviation: 'TOT'},
    GERUDO_VALLEY          : {vague_preposition: 'at',     clear_preposition: 'at',     str: 'Gerudo Valley',              short_name: "Gerudo Valley",          color: 'Yellow',     dungeon_name: null,                     abbreviation: 'VALL'},
    HAUNTED_WASTELAND      : {vague_preposition: 'in',     clear_preposition: 'in',     str: 'the Haunted Wasteland',      short_name: "Haunted Wasteland",      color: 'Yellow',     dungeon_name: null,                     abbreviation: 'WAST'},
};

export class Hint implements GraphHint {
    public type: string;
    public area: GraphRegion | null = null;
    public location: GraphLocation | null = null;
    public location2: GraphLocation | null = null;
    public entrance: GraphEntrance | null = null;
    public target: GraphEntrance | null = null;
    public goal: GraphHintGoal | null = null;
    public item: GraphItem | null = null;
    public item2: GraphItem | null = null;
    public num_major_items: number | null = null;

    constructor(hint_type: string) {
        this.type = hint_type;
    }

    equals(other_hint: GraphHint): boolean {
        return (
            this.type === other_hint.type
            && this.area?.name === other_hint.area?.name
            && this.location?.name === other_hint.location?.name
            && this.location2?.name === other_hint.location2?.name
            && this.entrance?.name === other_hint.entrance?.name
            && this.target?.name === other_hint.target?.name
            && this.item?.name === other_hint.item?.name
            && this.item?.player === other_hint.item?.player
            && this.item?.price === other_hint.item?.price
            && this.item2?.name === other_hint.item2?.name
            && this.item2?.player === other_hint.item2?.player
            && this.item2?.price === other_hint.item2?.price
            && this.num_major_items === other_hint.num_major_items
            && this.goal?.location?.name === other_hint.goal?.location?.name
            && this.goal?.item_count === other_hint.goal?.item_count
            && this.goal?.item?.name === other_hint.goal?.item?.name
            && this.goal?.item?.player === other_hint.goal?.item?.player
            && this.goal?.item?.price === other_hint.goal?.item?.price
        );
    }
}