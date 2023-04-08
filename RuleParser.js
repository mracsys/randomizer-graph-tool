const babel = require("@babel/core");
const generate = require('@babel/generator').default;
const WorldState = require("./WorldState.js");
const World = require("./World.js");
const Location = require("./Location.js");
const item_table = require("./ItemList.js");
const TimeOfDay = require("./Region.js");
const read_json = require("./Utils.js");

const access_proto = "(worldState, { age = null, spot = null, tod = null } = {}) => true";
const kwarg_defaults = {
    'age': null,
    'spot': null,
    'tod': TimeOfDay.NONE
};

const allowed_globals = { 'TimeOfDay': TimeOfDay };

const escaped_items = {};
Object.keys(item_table).map((item) => {
    escaped_items[item.replace(/\s/g, '_').replace(/[\'()[\]-]/g, '')] = item
});

var event_name = new RegExp(/\w+/);

var rule_aliases = {};
var nonaliases = {};

function load_aliases() {
    j = read_json('LogicHelpers.json');
    Object.keys(j).map((s) => {
        if (s.includes('(')) {
            var [rule, temp_args] = s.substring(0,s.length-1).split('(')
            var args = [];
            temp_args.split(',').map((arg) => {
                args.push(new RegExp('\\b' + arg + '\\b'));
            });
        } else {
            var [rule, args] = [s, []];
        }
        rule_aliases[rule] = { 'args': args, 'repl': j[s] };
    });
    nonaliases = Object.keys(escaped_items).filter(x => !(Object.keys(rule_aliases).includes(x)));
}

class RuleParser {
    constructor(world) {
        this.world = world;
        this.events = [];
        this.replaced_rules = {};
        this.delayed_rules = [];
        if (Object.keys(rule_aliases).length === 0) {
            load_aliases();
        }
        this.rule_cache = new Set();
        this.current_spot = null;
    }

    visit(self, rule_string) {
        var output = babel.transformSync(rule_string, {
            sourceType: 'script',
            plugins: [function ootrLogicPlugin({ types: t }) {
                return {
                    visitor: {
                        Identifier(path) {
                            console.log('transforming '+ path);
                            self.visit_Name(self, t, path);
                        }
                    }
                };
            }]
        });
        return output.code;
    }

    visit_Name(self, t, path) {
        if (Object.getOwnPropertyNames(RuleParser.prototype).includes(path.node.name)) {
            //here, at, tod tests
            self[path.node.name](self, path)
        } else if (path.node.name in rule_aliases) {
            var args = rule_aliases[path.node.name]['args'];
            var repl = rule_aliases[path.node.name]['repl'];
            if (args.length > 0) {
                throw "non-zero args required, but none supplied"
            }
            // traverse repl and return
            var repl_parsed = babel.parse(self.visit(self, repl));
            path.replaceWith(repl_parsed.program.body[0]);
            path.skip()
        } else if (path.node.name in escaped_items) {
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(path.node.name)]
                )
            );
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world).includes(path.node.name)) {
            var world_parsed = babel.parse(self.world[path.node.name].toString());
            path.replaceWith(world_parsed.program.body[0]);
            path.skip()
        } else if (Object.getOwnPropertyNames(self.world.settings).includes(path.node.name)) {
            var worldsettings_parsed = babel.parse(self.world.settings[path.node.name].toString());
            path.replaceWith(worldsettings_parsed.program.body[0]);
            path.skip()
        } else if (Object.getOwnPropertyNames(WorldState.prototype).includes(path.node.name)) {
            var worldstate_prop = self.make_call(self, path, path.node.name, [], []);
            path.replaceWith(worldstate_prop.program.body[0]);
            path.skip();
        } else if (path.node.name in kwarg_defaults || path.node.name in allowed_globals) {
            // do nothing
        } else if (event_name[Symbol.match](path.node.name)) {
            self.events.push(path.node.name.replace('_',' '));
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(path.node.name.replace('_', ' '))]
                )
            );
            path.skip();
        }
    }

    make_call(self, node, name, args, keywords) {
        return t.callExpression(
            t.memberExpression(
                t.identifier('worldState'),
                t.identifier(name)),
            args
        );
    }

    replace_subrule(self, target, path) {
        const rule = babel.generate(node).code;
        const t = babel.types;
        if (rule in self.replaced_rules[target]) {
            path.replaceWith(self.replaced_rules[target][rule]);
        } else {
            var subrule_name = target + 'Subrule ' + String(1 + length(self.replaced_rules[target]));
            self.delayed_rules.push({"target": target, "path": path, "subrule_name": subrule_name});
            item_rule = t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier('has')),
                [t.stringLiteral(subrule_name)]
            );
            self.replaced_rules[target][rule] = item_rule;
            path.replaceWith(item_rule);
        }
        path.skip();
    }

    create_delayed_rules() {
        self = this;
        this.delayed_rules.map((rule) => {
            var region_name = rule['target'];
            var path = rule['path'];
            var subrule_name = rule['subrule_name'];
            var region = this.world.get_region(region_name);
            var event = Location({name: subrule_name, type: 'Event', parent: region, internal: true});
            event.world = self.world;
            self.current_spot = event;
            var access_rule = self.make_access_rule(self.visit(self, path));
            if (access_rule === self.rule_cache) {
                // add test for constant false
                event.access_rule = null;
                event.never = true;
            } else {
                if (access_rule === self.rule_cache) {
                    event.always = true;
                }
                event.set_rule(access_rule);
                region.locations.push(event);
                MakeEventItem(subrule_name, event);
            }
        });
        this.delayed_rules = [];
    }

    make_access_rule(rule_str) {
        var t = babel.types;
        var proto = babel.parse(access_proto);
        var params = proto.program.body[0].expression.params;
        var rule_ast = babel.parse(rule_str);
        var body = rule_ast.program.body[0].expression;
        var exp = t.arrowFunctionExpression(params,body,false);
        var stmt = t.expressionStatement(exp);
        var p = t.program([stmt]);
        return generate(p, {}, rule_str).code;
    }

    at(self, path) {
        if (!(path.node.hasOwnProperty('arguments'))) {
            // no argument supplied
        }
        this.replace_subrule(self, path.node.arguments[1].value, path.node.arguments[1]);
    }

    here(self, path) {
        if (!(path.node.hasOwnProperty('arguments'))) {
            // no argument supplied
        }
        this.replace_subrule(self, self.current_spot.parent_region.name, path.node.arguments[0]);
    }

    at_day(self, path) {
        if (self.world.ensure_tod_access) {
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAY) : (state.has_all_of(['Ocarina', 'Suns Song']) || state.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAY))"));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_dampe_time(self, path) {
        if (self.world.ensure_tod_access) {
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAMPE) : state.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAMPE)"));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_night(self, path) {
        if (self.current_spot.type === 'GS Toekn' && self.world.logic_no_night_tokens_without_suns_song) {
            path.replaceWith(self.visit(self, 'can_play(Suns_Song)'));
        } else if (self.world.ensure_tod_access) {
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAMPE) : state.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAMPE)"));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    parse_rule(rule_string, spot=null) {
        this.current_spot = spot;
        return this.make_access_rule(this.visit(this, rule_string))
    }
}

module.exports = RuleParser;