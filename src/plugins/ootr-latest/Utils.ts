import ExternalFileCache from './OotrFileCache.js';
import type { GraphLocation } from '../GraphPlugin.js';
import { non_required_items } from './ItemList.js';

type Dictionary<T> = {
    [key: string]: T,
};

type JsonLogicRegion = {
    region_name: string,
    dungeon?: string,
    scene?: string,
    is_boss_room?: string | boolean,
    hint?: string,
    alt_hint?: string,
    savewarp: string,
    time_passes?: boolean,
    events?: Dictionary<string>,
    locations?: Dictionary<string>,
    exits?: Dictionary<string>,
    provides_time?: string,
};

type JsonLogicMacroFile = {
    [alias: string]: string,
};

// file path not safe for local filesystems!
export function read_json(file_path: string, file_cache: ExternalFileCache): JsonLogicRegion[] {
    const file_string = file_cache.files['data/' + file_path];
    let lines = file_string.replaceAll('\r', '').split('\n');
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
    let lines = file_string.replaceAll('\r', '').split('\n');
    let json_string = '';
    for (let line of lines) {
        json_string += line.split('#')[0].replace('\n', ' ');
    }
    json_string = json_string.replaceAll(/\s+/ig, ' ');
    return JSON.parse(json_string);
}

export function replace_python_booleans(rule: string): string {
    let s = rule.replaceAll('==', '===');
    s = s.replaceAll('!=', '!==');
    s = s.replaceAll(/not\s([A-Za-z0-9\(\)_']+)\s===/ig, "$1 !=="); // Realrob MQ Ice Cavern boulder shuffle "not (x == y)" -> "(x !== y)"
    s = s.replaceAll(/\bor\b/ig, '||');
    s = s.replaceAll(/\band\b/ig, '&&');
    s = s.replaceAll(/\bnot\b/ig, '!');
    s = s.replaceAll(/\bTrue\b/g, 'true');
    s = s.replaceAll(/\bFalse\b/g, 'false');
    return s.trim();
}

export function replace_python_tuples(text: string): string {
    let result = '';
    let insideSingleQuotes = false;
    let insideDoubleQuotes = false;
    let prev_char = '';

    for (const char of text) {
        if (char === "'" && !insideDoubleQuotes && !(prev_char === '\\')) {
            insideSingleQuotes = !insideSingleQuotes;
            result += char;
        } else if (char === '"' && !insideSingleQuotes && !(prev_char === '\\')) {
            insideDoubleQuotes = !insideDoubleQuotes;
            result += char;
        } else if (char === '(' && !insideSingleQuotes && !insideDoubleQuotes) {
            result += '[';
        } else if (char === ')' && !insideSingleQuotes && !insideDoubleQuotes) {
            result += ']';
        } else {
            result += char;
        }
        prev_char = char;
    }

    return result;
}

export const locationFilter = (l: GraphLocation): boolean => {
    return (
        l.type !== 'Event'
        && l.type !== 'GraphEvent'
        && (l.item === null || !non_required_items.includes(l.item.name))
    );
}