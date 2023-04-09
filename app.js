//import WorldState from "./WorldState.mjs";
//import World from "./World.mjs";
//import RuleParser from "./RuleParser.mjs";
const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic;

const skeys = "(Small_Key_Fire_Temple, 2)";
const output = parser.parse_rule(skeys);
logic = eval(output);

console.log('Small key testing');
console.log(output);
console.log(logic(state, { age: 'adult' }));
state.collect('Small_Key_Fire_Temple');
console.log(logic(state, { age: 'adult' }));
state.collect('Small_Key_Fire_Temple');
console.log(logic(state, { age: 'adult' }));