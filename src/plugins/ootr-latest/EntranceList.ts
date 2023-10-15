import OotrVersion from "./OotrVersion.js";
import ExternalFileCache from "../ExternalFileCache.js";
import { replace_python_tuples } from "./Utils.js";

type EntranceConnectionData = [entrance_name: string, entrance_data: object];
type EntranceTableEntry = [entrance_type: string, forward_entry: EntranceConnectionData, reverse_entry?: EntranceConnectionData];

export default class EntranceList {
    public entrances: EntranceTableEntry[];

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.entrances = [];
        switch(ootr_version.branch) {
            case '':
            case 'R':
            case 'Rob':
            case 'fenhl':
                if (ootr_version.gte('7.1.117')) {
                    this.readEntranceList_7_1_117(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }
    }

    readEntranceList_7_1_117(file_cache: ExternalFileCache): void {
        if (file_cache.files['EntranceShuffle.py'] === undefined) return;
        const entrancelist: string[] = file_cache.files['EntranceShuffle.py'].split('\n').filter(Boolean);
        
        let parsing_entrances = false;
        let parsed_lines: string = '[';
        for (let line of entrancelist) {
            if (line.trim().startsWith('#')) {
                continue;
            } else if (parsing_entrances && line === ']') {
                // end of entrance_shuffle_table array, no need to parse rest of file
                break;
            }
            if (parsing_entrances) {
                parsed_lines += replace_python_tuples(line).split('#')[0]
                    .replaceAll("'", '"')
                    .replaceAll(/0x[\da-fA-F]+/g, '0')  // JSON doesn't support hex
                    .replaceAll(',]', ']')              // JSON doesn't support trailing commas
                    .replaceAll(/\bNone\b/g, 'null');   // convert from python None to null
            }
            if (line.split('=')[0].trim() === 'entrance_shuffle_table') {
                parsing_entrances = true;
            }
        }
        if (parsed_lines.endsWith(',')) {
            parsed_lines = parsed_lines.slice(0, -1);
        }
        parsed_lines += ']';
        let python_entries: EntranceTableEntry[] = JSON.parse(parsed_lines);
        this.entrances = python_entries;
    }
}