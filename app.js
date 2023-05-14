const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic;

const rule = "Boomerang || Slingshot || (is_adult && (Bow || Hookshot))";

const output = parser.parse_rule(rule);
console.log('done transforming\n')
logic = eval(output);

console.log('BoolOp testing');
console.log(output);
console.log('reachable: ' + logic(state, {}));
console.log('as adult?')
console.log('reachable: ' + logic(state, { age: 'adult' }));
state.collect('Bow');
console.log('reachable: ' + logic(state, {}));
console.log('as adult?')
console.log('reachable: ' + logic(state, { age: 'adult' }));