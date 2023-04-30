const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
state.collect('Piece of Heart');
state.collect('Piece of Heart');
state.collect('Piece of Heart');
state.collect('Piece of Heart');
var logic;

const statecall = "can_reach('Kakariko Village', age=age)";
const statehearts = "has_hearts(4)";

const output = parser.parse_rule(statecall);
const output2 = parser.parse_rule(statehearts);
logic_call = eval(output);
logic_hearts = eval(output2);

console.log('Call testing');
console.log(output);
console.log(logic_call(state, {}));
console.log(logic_call(state, { spot: 'Kakariko', age: 'child' }));
console.log('Call hearts testing');
console.log(output2);
console.log(logic_hearts(state, {}));
console.log(logic_hearts(state, { age: 'child' }));
state.remove('Piece of Heart');
console.log(logic_hearts(state, { age: 'child' }));