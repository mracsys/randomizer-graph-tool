import ExternalFileCache from './OotrFileCache.js';

type Dictionary<T> = {
    [key: string]: T,
};

type JsonLogicRegion = {
    region_name: string,
    dungeon?: string,
    scene?: string,
    is_boss_room?: string,
    hint?: string,
    alt_hint?: string,
    savewarp: string,
    time_passes?: boolean,
    events?: Dictionary<string>,
    locations?: Dictionary<string>,
    exits?: Dictionary<string>,
};

type JsonLogicMacroFile = {
    [alias: string]: string,
};

// file path not safe for local filesystems!
export function read_json(file_path: string, file_cache: ExternalFileCache): JsonLogicRegion[] {
    const file_string = file_cache.files['data/' + file_path];
    let lines = file_string.split('\n');
    let json_string = '';
    for (let line of lines) {
        json_string += line.split('#')[0].replace('\n', ' ');
    }
    json_string = json_string.replaceAll(/\s+/ig, ' ');
    return JSON.parse(json_string);
}

// duplicate function to maintain type safety for non-macro files
export function read_macro_json(file_path: string, file_cache: ExternalFileCache): JsonLogicMacroFile {
    const file_string = file_cache.files['data/' + file_path];
    let lines = file_string.split('\n');
    let json_string = '';
    for (let line of lines) {
        json_string += line.split('#')[0].replace('\n', ' ');
    }
    json_string = json_string.replaceAll(/\s+/ig, ' ');
    return JSON.parse(json_string);
}

export function replace_python_booleans(rule: string): string {
    let s = rule.replaceAll(/\bor\b/ig, '||');
    s = s.replaceAll(/\band\b/ig, '&&');
    s = s.replaceAll(/\bnot\b/ig, '!');
    s = s.replaceAll('==', '===');
    s = s.replaceAll('!=', '!==');
    s = s.replaceAll(/\bTrue\b/g, 'true');
    s = s.replaceAll(/\bFalse\b/g, 'false');
    return s.trim();
}