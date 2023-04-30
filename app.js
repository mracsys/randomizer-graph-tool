const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic_forest;
var logic_water;

const trials = "skipped_trials[Forest]";
const trials2 = "skipped_trials[Water]";

const output = parser.parse_rule(trials);
const output2 = parser.parse_rule(trials2);
logic_forest = eval(output);
logic_water = eval(output2);

console.log('Skipped trials testing');
console.log(output);
console.log(logic_forest(state, {}));
console.log('Enabled trials testing');
console.log(output2);
console.log(logic_water(state, {}));
