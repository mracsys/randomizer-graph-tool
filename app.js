const WorldState = require("./WorldState.js");
const World = require("./World.js");
const { Region } = require("./Region.js");
const RuleParser = require("./RuleParser.js");
const Location = require("./Location.js");

var world = new World();
var state = new WorldState(world);
var parser = new RuleParser(world);
var deku_tree = new Region({ name: 'Deku Tree' });
var skull = new Location({ name: 'Deku Tree GS Basement Back Room', parent: deku_tree });
var logic;

const rule = "here(has_fire_source_with_torch || can_use(Bow)) && here(can_blast_or_smash) && (can_use(Boomerang) || can_use(Hookshot))";

console.log('transforming rule');
const output = parser.parse_rule(rule, skull);
console.log('done transforming rule\n');
console.log('transforming delayed rules');
parser.create_delayed_rules();
console.log('done transforming delayed rules\n');
logic = eval(output);

console.log('here testing');
console.log(output);
console.log('reachable: ' + logic(state, {}));
state.collect('Bow');
state.collect('Bomb_Bag');
state.collect('Hookshot');
console.log('reachable: ' + logic(state, { age: 'adult' }));