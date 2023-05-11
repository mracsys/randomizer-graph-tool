const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic;

const rule = "Boomerang || Slingshot || (is_adult && Bow)";

const output = parser.parse_rule(rule);
console.log('done transforming\n')
logic = eval(output);

console.log('BoolOp testing');
console.log(output);
console.log(logic(state, {}));
