import OotrVersion from "./OotrVersion.js";
import ExternalFileCache from "../ExternalFileCache.js";
import { replace_python_tuples } from "./Utils.js";

type EntranceConnectionData = [entrance_name: string, entrance_data: any];
type EntranceTableEntry = [entrance_type: string, forward_entry: EntranceConnectionData, reverse_entry?: EntranceConnectionData];

export default class EntranceList {
    public entrances: EntranceTableEntry[];

    constructor(ootr_version: OotrVersion, file_cache: ExternalFileCache) {
        this.entrances = [];
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
                    this.readEntranceList_7_1_117(file_cache);
                } else {
                    throw('OOTR version prior to 7.1.117 not implemented');
                }
                break;
            default:
                throw(`Unknown branch for version ${ootr_version.to_string()}`);
        }
        if (ootr_version.branch !== 'Fenhl' && ootr_version.lt('8.2.37')) {
            // Since we have to add the reverse entrance ourselves, always name it after the MQ
            // scheme since it makes the most sense in an upstream rando change.
            let forward_ganons_tower: EntranceConnectionData = ['Ganons Castle Lobby -> Ganons Castle Tower', {}];
            //let reverse_ganons_tower: EntranceConnectionData = ['Ganons Castle Tower -> Ganons Castle Lobby', {}];
            let forward_ganons_tower_mq: EntranceConnectionData = ['Ganons Castle Main -> Ganons Castle Tower', {}];
            let reverse_ganons_tower_mq: EntranceConnectionData = ['Ganons Castle Tower -> Ganons Castle Main', {}];
            this.entrances.push(['GraphGanonsTower', forward_ganons_tower, reverse_ganons_tower_mq]);
            this.entrances.push(['GraphGanonsTower', forward_ganons_tower_mq, reverse_ganons_tower_mq]);
        }
    }

    readEntranceList_7_1_117(file_cache: ExternalFileCache): void {
        if (file_cache.files['EntranceShuffle.py'] === undefined) return;
        const entrancelist: string[] = file_cache.files['EntranceShuffle.py'].replaceAll('\r', '').split('\n').filter(Boolean);
        
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
                const hex_replacer = (match: string) => {return parseInt(match).toString()};
                parsed_lines += replace_python_tuples(line).split('#')[0]
                    .replaceAll("'", '"')
                    .replaceAll(/0x[\da-fA-F]+/g, hex_replacer)  // JSON doesn't support hex
                    .replaceAll(',]', ']')                       // JSON doesn't support trailing commas
                    .replaceAll(/\bNone\b/g, 'null')             // convert from python None to null
                    .replaceAll(/\bTrue\b/g, 'true');            // convert from python True to true
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