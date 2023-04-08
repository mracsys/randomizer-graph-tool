//import WorldState from "./WorldState.mjs";
//import World from "./World.mjs";
//import RuleParser from "./RuleParser.mjs";
const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
state.collect('Boomerang')
var logic;

//const jabu = "Boomerang && age == 'child'";
//
//const output = parser.parse_rule(jabu);
//logic = eval(output);
//
//console.log('Jabu testing');
//console.log(output);
//console.log(logic(state, {}));
//console.log(logic(state, { age: 'child' }));
//state.remove('Boomerang');
//console.log(logic(state, { age: 'child' }));

//const hook = "Hookshot";
//const hook_output = parser.parse_rule(hook);
//logic = eval(hook_output);
//
//console.log('Hookshot testing');
//console.log(hook_output);
//console.log(logic(state, { age: 'adult' }));
//state.collect('Progressive_Hookshot');
//console.log(logic(state, { age: 'adult' }));

const th_hook = "Hookshot && triforce_hunt";
const th_hook_output = parser.parse_rule(th_hook);
logic = eval(th_hook_output);

console.log('Hookshot testing');
console.log(th_hook_output);
console.log(logic(state, { age: 'adult' }));
state.collect('Progressive_Hookshot');
console.log(logic(state, { age: 'adult' }));

