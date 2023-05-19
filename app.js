const WorldState = require("./WorldState.js");
const World = require("./World.js");
const { Region } = require("./Region.js");
const RuleParser = require("./RuleParser.js");
const Location = require("./Location.js");
const { ItemInfo } = require("./Item.js");

var world = new World();
var deku_tree = new Region('Deku Tree');
deku_tree.world = world;
var skull = new Location({ name: 'Deku Tree GS Basement Back Room', parent: deku_tree });
skull.world = world;
deku_tree.locations.push(skull);
world.regions.push(deku_tree);
var state = new WorldState(world);
var parser = new RuleParser(world);
var logic;

const rule = "here(has_fire_source_with_torch || can_use(Bow)) && here(can_blast_or_smash) && (can_use(Boomerang) || can_use(Hookshot))";
//const rule = "bridge === 'vanilla'";

//console.log('transforming rule');
//const output = parser.parse_rule(rule, skull);
//console.log('done transforming rule\n');
//logic = eval(output);
logic = parser.parse_rule(rule, skull);
console.log('transforming delayed rules');
parser.create_delayed_rules();
console.log('done transforming delayed rules\n');

console.log('here testing');
//console.log(output);
console.log('reachable: ' + logic(state, {}));
console.log('events list:');
world.regions.forEach((r) => r.locations.forEach((l) => {
    console.log(`${l.name}, reachable: ${l.access_rule(state, { age: 'adult' })}`);
}));
state.collect(ItemInfo.items['Bow']);
state.collect(ItemInfo.items['Bomb Bag']);
state.collect(ItemInfo.items['Progressive Hookshot']);
console.log('events list:');
world.regions.forEach((r) => r.locations.forEach((l) => {
    console.log(`${l.name}, reachable: ${l.access_rule(state, { age: 'adult' })}`);
    if (l.access_rule(state, { age: 'adult' }) && l.name in ItemInfo.events) {
        state.collect(ItemInfo.events[l.name]);
    }
}));
console.log('reachable: ' + logic(state, { age: 'adult' }));
console.log(state.has_any_of(['Bomb Bag']));