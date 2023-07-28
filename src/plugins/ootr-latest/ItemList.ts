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

export default class ItemList {
    public item_table: ItemTable;

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.item_table = {};
        switch(ootr_version.branch) {
            case '':
            case 'R':
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
        const itemlist: string[] = file_cache.files['ItemList.py'].split('\n').filter(Boolean);
        
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
                let temp_line = replace_python_tuples(line).split('#')[0].trim()
                    .replaceAll("'", '"')
                    .replaceAll('\\"', "'")             // I thought there was a change a while back to get rid of apostrophes in internal names...
                    .replaceAll(/0x[\da-fA-F]+/g, '0')  // JSON doesn't support hex
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
        this.item_table = python_entries;
    }
}