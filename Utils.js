const { readFileSync } = require('fs');
const { resolve } = require('path');
const OotrVersion = require('./OotrVersion.js');

// https://raw.githubusercontent.com/OoTRandomizer/OoT-Randomizer/7.1.118/SettingsList.py

function read_json(file_path, ootr_version) {
    let logic_folder;
    switch(ootr_version.branch) {
        case '':
        case 'R':
            if (ootr_version.greaterThanOrEqual(new OotrVersion('7.1.143'))) {
                logic_folder = 'ootr-logic-143';
            } else if (ootr_version.greaterThanOrEqual(new OotrVersion('7.1.117'))) {
                logic_folder = 'ootr-logic';
            } else {
                throw('OOTR version prior to 7.1.117 not implemented');
            }
            break;
        default:
            throw(`Unknown branch for version ${ootr_version.toString()}`);
    }
    let json_string = readFileSync(resolve(__dirname, logic_folder, file_path), 'utf-8');
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