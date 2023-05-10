const WorldState = require("./WorldState.js");
const World = require("./World.js");
const RuleParser = require("./RuleParser.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic;

const unary = "!(bridge === 'stones')";

const output = parser.parse_rule(unary);
logic = eval(output);

console.log('not testing');
console.log(output);
console.log(logic(state, {}));
