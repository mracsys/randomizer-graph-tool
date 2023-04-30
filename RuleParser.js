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

var allowed_globals = { 'TimeOfDay': TimeOfDay };

var escaped_items = {};
var solver_ids = {};
Object.keys(item_table).map((item) => {
    var esc = escape_name(item);
    escaped_items[esc] = item;
    if (!(Object.keys(solver_ids).includes(esc))) {
        create_solver_ids(esc);
    }
});

var event_name = new RegExp(/\w+/);

var rule_aliases = {};
var nonaliases = {};

function escape_name(name) {
    return name.replace(/\s/g, '_').replace(/[\'()[\]-]/g, '');
}

function create_solver_ids(esc) {
    allowed_globals[esc] = Object.keys(solver_ids).length;
    solver_ids[esc] = Object.keys(solver_ids).length;
}

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
                        },
                        StringLiteral(path) {
                            console.log('transforming '+ path);
                            self.visit_Str(self, t, path);
                        },
                        SequenceExpression(path) {
                            console.log('transforming '+ path);
                            self.visit_Tuple(self, t, path);
                        },
                        CallExpression(path) {
                            console.log('transforming '+ path);
                            self.visit_Call(self, t, path);
                        },
                        MemberExpression(path) {
                            console.log('transforming '+ path);
                            self.visit_Subscript(self, t, path);
                        },
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
                throw "non-zero args required for " + path
            }
            // traverse repl and return
            var repl_parsed = babel.parse(self.visit(self, repl));
            path.replaceWith(repl_parsed.program.body[0]);
            path.skip();
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
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world.settings).includes(path.node.name)) {
            var worldsettings_parsed = babel.parse(self.world.settings[path.node.name].toString());
            path.replaceWith(worldsettings_parsed.program.body[0]);
            path.skip();
        } else if (Object.getOwnPropertyNames(WorldState.prototype).includes(path.node.name)) {
            var worldstate_prop = self.make_call(self, t, path, path.node.name, [], []);
            path.replaceWith(worldstate_prop.program.body[0]);
            path.skip();
        } else if (path.node.name in kwarg_defaults || path.node.name in allowed_globals) {
            // do nothing
        } else if (event_name[Symbol.match](path.node.name)) {
            self.events.push(path.node.name.replace('_', ' '));
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(path.node.name.replace('_', ' '))]
                )
            );
            path.skip();
        } else {
            throw 'Parse error: invalid node name: ' + path.node.name;
        }
    }

    visit_Str(self, t, path) {
        var esc = escape_name(path.node.value);
        if (!(Object.keys(solver_ids).includes(esc))) {
            self.events.push(esc.replace(/_/g, ' '))
            create_solver_ids(esc);
        }
        path.replaceWith(
            t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier('has')),
                [t.stringLiteral(esc)]
            )
        );
        path.skip();
    }

    visit_Constant(self, t, path) {
        if (typeof(path.node.value) === 'string') {
            self.visit_Str(self, t, path);
        }
    }

    visit_Tuple(self, t, path) {
        if (path.node.expressions.length != 2) {
            throw 'Parse error: Tuple must have 2 values: ' + path;
        }

        let [item, num] = path.node.expressions;

        if (!(t.isIdentifier(item) || t.isStringLiteral(item))) {
            throw 'Parse error: Tuple first value must be an item: ' + item;
        }
        if (t.isIdentifier(item)) {
            item = t.StringLiteral(item.name);
        }

        if (!(t.isIdentifier(num) || t.isNumericLiteral(num))) {
            throw 'Parse error: Tuple second value must be a number: ' + num;
        }
        if (t.isIdentifier(num)) {
            num = t.NumericLiteral(self.world.settings[num.name]);
        }

        if (!(Object.keys(solver_ids).includes(item.value))) {
            self.events.push(item.value.replace(/_/g, ' '));
        }

        path.replaceWith(
            t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier('has')),
                [item, num]
            )
        );
        path.skip();
    }

    visit_Call(self, t, path) {
        if (!(t.isIdentifier(path.node.callee))) {
            return;
        }

        if (Object.getOwnPropertyNames(RuleParser.prototype).includes(path.node.callee.name)) {
            self[path.node.callee.name](self, path);
        } else if (path.node.callee.name in rule_aliases) {
            var args = rule_aliases[path.node.callee.name]['args'];
            var repl = rule_aliases[path.node.callee.name]['repl'];
            if (args.length !== path.node.arguments.length) {
                throw `Parse error: expected $(args.length) args for $(path), not $(path.node.arguments.length)`;
            }
            args.forEach((arg_re, idx) => {
                var val;
                var arg_val = path.node.arguments[idx];
                if (t.isIdentifier(arg_val)) {
                    val = arg_val.name;
                } else if (t.isStringLiteral(arg_val)) {
                    val = arg_val.value;
                } else {
                    throw `Parse error: invalid argument $(arg_val)`;
                }
                repl = arg_re[Symbol.replace](repl, val);
            });
            var repl_parsed = babel.parse(self.visit(self, repl));
            path.replaceWith(repl_parsed.program.body[0]);
            path.skip();
        } else {
            let new_args = [];
            let kwargs = [];
            path.node.arguments.forEach((child) => {
                if (t.isIdentifier(child)) {
                    if (Object.getOwnPropertyNames(self.world).includes(child.name)) {
                        child = babel.parse(self.world[child.name].toString()).program.body[0];
                    } else if (Object.getOwnPropertyNames(self.world.settings).includes(child.name)) {
                        child = babel.parse(self.world.settings[child.name].toString()).program.body[0];
                    } else if (child.name in rule_aliases) {
                        child = babel.parse(self.visit(self, child.toString())).program.body[0];
                    } else if (child.name in escaped_items) {
                        child = t.stringLiteral(escaped_items[child.name]);
                    } else {
                        child = t.stringLiteral(child.name.replace('_', ' '));
                    }
                // JS-exclusive condition to filter out keyword arguments.
                // Python automatically separates these to node.keywords from node.args.
                } else if (t.isAssignmentExpression(child)) {
                    kwargs.push(child);
                } else if (!(t.isStringLiteral(child)) && !(t.isNumericLiteral(child))) {
                    child = babel.parse(self.visit(self, child.toString())).program.body[0];
                }
                new_args.push(child);
            });
            path.replaceWith(self.make_call(self, t, path.node, path.node.callee.name, new_args, kwargs));
            path.skip();
        }
    }

    visit_Subscript(self, t, path) {
        // Javascript MemberExpressions are not distinct
        // between object.property and object[property] like
        // in Python (Attribute and Subscript, respectively).
        // However, the 'computed' property of the node will
        // be true if square brackets are used, which is used
        // here to filter for the same nodes Python would transform.
        if (!path.node.computed) {
            return;
        }
        if (t.isIdentifier(path.node.object)) {
            let s = (t.isIdentifier(path.node.property)) ? path.node.property.name : path.node.property.value;
            path.replaceWith(
                t.MemberExpression(
                    t.MemberExpression(
                        t.MemberExpression(
                            t.identifier('worldState'),
                            t.identifier('world')
                        ),
                        path.node.object
                    ),
                    t.StringLiteral(s.replace('_', ' ')),
                    true // preserve computed property
                )
            );
            path.skip();
        }
    }

    make_call(self, t, node, name, args, kwargs) {
        if (!Object.getOwnPropertyNames(WorldState.prototype).includes(name)) {
            throw `Parse error: No such function State.$(name)`;
        }
        // Convert separate AssignmentExpression keyword args to
        // one combined ObjectExpression for use with parameter
        // destructuring to simulate Python **kwargs
        let objargs = [];
        kwargs.forEach((kwarg) => {
            objargs.push(t.ObjectProperty(kwarg.left, kwarg.right));
        });
        if (objargs.length > 0) {
            //args.push(t.ObjectExpression(objargs));
        }
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
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAY) : (worldState.has_all_of(['Ocarina', 'Suns Song']) || worldState.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAY))"));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_dampe_time(self, path) {
        if (self.world.ensure_tod_access) {
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAMPE) : worldState.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAMPE)"));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_night(self, path) {
        if (self.current_spot.type === 'GS Token' && self.world.logic_no_night_tokens_without_suns_song) {
            path.replaceWith(self.visit(self, 'can_play(Suns_Song)'));
        } else if (self.world.ensure_tod_access) {
            path.replaceWith(babel.parse("tod ? (tod & TimeOfDay.DAMPE) : worldState.search.can_reach(spot.parent_region, age=age, tod=TimeOfDay.DAMPE)"));
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