import OotrVersion from "./OotrVersion.js";
import ExternalFileCache from "../ExternalFileCache.js";
import { replace_python_tuples } from "./Utils.js";

export type ItemSpecial = {
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

export type ItemTable = {
    [item_name: string]: [
        item_type: string,
        progressive: boolean | null,
        itemID: number | null,
        special: ItemSpecial | null,
    ]
};

// List of items to force world state to collect instead of ignore
// so that the player inventory shows useful but not required items,
// such as the Biggoron Sword.
export const non_required_items = [
    'Biggoron Sword',
    'Giants Knife',
    'Deku Shield',
    'Hylian Shield',
    'Goron Mask',
    'Zora Mask',
    'Gerudo Mask',
];

// Additional items to include in item table for peeking identical-looking
// item models
const peekable_items: ItemTable = {
    'Small Key (???)': ['Peekable', false, null, null],
    'Small Key Ring (???)': ['Peekable', false, null, null],
    'Boss Key (???)': ['Peekable', false, null, null],
    'Map (???)': ['Peekable', false, null, null],
    'Compass (???)': ['Peekable', false, null, null],
    'Silver Rupee (???)': ['Peekable', false, null, null],
    'Silver Rupee Pouch (???)': ['Peekable', false, null, null],
    'Soul (???)': ['Peekable', false, null, null],
};

export default class ItemList {
    public item_table: ItemTable;

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.item_table = {};
        switch(ootr_version.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
            case 'R':
            case 'Rob':
            case 'Fenhl':
                if (ootr_version.gte('7.1.117')) {
                    this.readItemList_7_1_117(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }
    }

    readItemList_7_1_117(file_cache: ExternalFileCache): void {
        if (file_cache.files['ItemList.py'] === undefined) return;
        const itemlist: string[] = file_cache.files['ItemList.py'].replaceAll('\r', '').split('\n').filter(Boolean);
        
        let parsing_items = false;
        let parsed_lines: string = '{';
        for (let line of itemlist) {
            if (line.trim().startsWith('#')) {
                continue;
            } else if (parsing_items && line === '}') {
                // end of item_table array, no need to parse rest of file
                // as of 7.1.143 this is also the end of the file, but break just in case more is appended later
                break;
            }
            if (parsing_items) {
                // I wish these tables would be static json files...
                const hex_replacer = (match: string) => {return parseInt(match).toString()};
                let temp_line = replace_python_tuples(line).split('#')[0].trim()
                    .replaceAll("'", '"')
                    .replaceAll('\\"', "'")             // I thought there was a change a while back to get rid of apostrophes in internal names...
                    .replaceAll(/0x[\da-fA-F]+/g, hex_replacer)  // JSON doesn't support hex
                    .replaceAll(/GetItemId\.[A-Z_0-9]*/g, '"GetItemId.ITEM_ID"')    // convert python GetItemId enum to string (unused in this library)
                    .replaceAll(',]', ']')              // JSON doesn't support trailing commas
                    .replaceAll('float["Inf"]', '65535')// convert from python infinity to a large number, infinity doesn't matter for search
                    .replaceAll(/\bNone\b/g, 'null')    // convert from python None to null
                    .replaceAll(/\bTrue\b/g, 'true')
                    .replaceAll(/\bFalse\b/g, 'false');
                if (temp_line.startsWith('}') && parsed_lines.slice(-1) === ',') {
                    parsed_lines = parsed_lines.slice(0, -1); // songs and dungeon rewards have trailing commas on the last line of the special object
                }
                parsed_lines += temp_line;
            }
            // post python type hints file has a ':' for the type before the '=',
            // otherwise the parts we want to parse are identical
            if (line.split(':')[0].trim() === 'item_table' || line.split('=')[0].trim() === 'item_table') {
                parsing_items = true;
            }
        }
        if (parsed_lines.endsWith(',')) {
            parsed_lines = parsed_lines.slice(0, -1);
        }
        parsed_lines += '}';
        let python_entries: ItemTable = JSON.parse(parsed_lines);
        for (let item of non_required_items) {
            python_entries[item][1] = true;
        }
        this.item_table = Object.assign(python_entries, peekable_items);
    }
}