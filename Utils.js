const { readFileSync } = require('fs');
const { resolve } = require('path');

// https://raw.githubusercontent.com/OoTRandomizer/OoT-Randomizer/7.1.118/SettingsList.py

function read_json(file_path) {
    let json_string = readFileSync(resolve(__dirname, 'ootr-logic', file_path), 'utf-8');
    let lines = json_string.split('\n');
    json_string = '';
    for (let line of lines) {
        json_string += line.split('#')[0].replace('\n', ' ');
    }
    json_string = json_string.replaceAll(/\s+/ig, ' ');
    return JSON.parse(json_string);
}

function replace_python_booleans(rule) {
    let s = rule.replaceAll(/\bor\b/ig, '||');
    s = s.replaceAll(/\band\b/ig, '&&');
    s = s.replaceAll(/\bnot\b/ig, '!');
    s = s.replaceAll('==', '===');
    s = s.replaceAll('!=', '!==');
    s = s.replaceAll(/\bTrue\b/g, 'true');
    s = s.replaceAll(/\bFalse\b/g, 'false');
    return s.trim();
}

module.exports = {
    read_json,
    replace_python_booleans,
};