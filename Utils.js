const { readFileSync } = require('fs');
const { resolve } = require('path');

function read_json(file_path) {
    return JSON.parse(readFileSync(resolve(__dirname, 'ootr-logic', file_path), 'utf-8'));
}

module.exports = read_json;