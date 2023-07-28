import OotrVersion from "./OotrVersion.js";
import ExternalFileCache from "../ExternalFileCache.js";
import { replace_python_tuples } from "./Utils.js";

type LocationTableEntry = [
    type: string,
    vanilla_item: string | null,
];
type LocationTable = {
    [name: string]: LocationTableEntry,
};
type PythonLocationTableEntry = [
    name: string,
    data: [
        type: string,
        scene: any,
        _def: any,
        addr: any,
        vanilla_item: string | null,
        filter_tags: any,
    ]
];

export default class LocationList {
    public locations: LocationTable;
    public business_scrub_prices: { [item_name: string]: number };

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.locations = {};
        // Hard coding scrub prices so we don't have to look up scrub items by rom item ID.
        // Surely no one will ever touch this...
        this.business_scrub_prices = {
            'Deku Nuts': 20,
            'Deku Sticks': 15,
            'Piece of Heart': 10,
            'Deku Seeds': 40,
            'Deku Shield': 50,
            'Bombs': 40,
            'Arrows': 0,
            'Red Potion': 40,
            'Green Potion': 40,
            'Deku Stick Capacity': 40,
            'Deku Nut Capacity': 40,
        };
        switch(ootr_version.branch) {
            case '':
            case 'R':
                if (ootr_version.gte('7.1.117')) {
                    this.readLocationList_7_1_117(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }
    }

    readLocationList_7_1_117(file_cache: ExternalFileCache): void {
        const locationlist: string[] = file_cache.files['LocationList.py'].split('\n').filter(Boolean);
        
        let parsing_locations = false;
        let parsed_lines: string = '[';
        for (let line of locationlist) {
            if (line.trim().startsWith('#')) {
                continue;
            } else if (parsing_locations && line === '])') {
                // end of location_table array, no need to parse rest of file
                break;
            }
            if (parsing_locations) {
                // I wish these tables would be static json files...
                parsed_lines += replace_python_tuples(line).split('#')[0]
                    .replaceAll('shop_address', '')     // Completely unnecessary compared to the amount of magic numbers for other locations
                    .replaceAll("Thieves'", 'Thieves')  // Don't ruin the filter tag strings with the next replacements...
                    .replaceAll("Zora's", 'Zoras')
                    .replaceAll("Gerudo's", 'Gerudos')
                    .replaceAll("Ganon's", 'Ganons')
                    .replaceAll("Dodongo's", 'Dodongos')
                    .replaceAll("Jabu's", 'Jabus')
                    .replaceAll("'", '"')               // Vanilla items are the only fields to use single quotes, because why not
                    .replaceAll('\\"', "'")             // I thought there was a change a while back to get rid of apostrophes in internal names...
                    .replaceAll(/0x[\da-fA-F]+/g, '0')  // JSON doesn't support hex
                    .replaceAll('+', ',')               // JSON doesn't support math, thankfully all math is inside nested tuples we don't care about
                    .replaceAll('*', ',')               // more math
                    .replaceAll(',]', ']')              // JSON doesn't support trailing commas
                    .replaceAll(/\bNone\b/g, 'null');   // convert from python None to null
            }
            // post python type hints file has a ':' for the type before the '=',
            // otherwise the parts we want to parse are identical
            if (line.split(':')[0].trim() === 'location_table' || line.split('=')[0].trim() === 'location_table') {
                parsing_locations = true;
            }
        }
        if (parsed_lines.endsWith(',')) {
            parsed_lines = parsed_lines.slice(0, -1);
        }
        parsed_lines += ']';
        let python_entries: PythonLocationTableEntry[] = JSON.parse(parsed_lines);
        for (let python_entry of python_entries) {
            this.locations[python_entry[0]] = [
                python_entry[1][0], // location type
                python_entry[1][4], // vanilla item
            ];
        }
    }
}