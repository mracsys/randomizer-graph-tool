const babel = require("@babel/core");
const generate = require('@babel/generator').default;
const WorldState = require("./WorldState.js");
const { Location } = require("./Location.js");
var { ItemInfo, MakeEventItem } = require("./Item.js");
const { TimeOfDay } = require("./Region.js");
const { read_json, replace_python_booleans } = require("./Utils.js");
var { escape_name } = require("./RulesCommon.js");


const access_proto = "(worldState, { age = null, spot = null, tod = null } = {}) => true";
const kwarg_defaults = {
    'age': null,
    'spot': null,
    'tod': TimeOfDay.NONE
};

allowed_globals = { 'TimeOfDay': TimeOfDay };

var escaped_items = {};
Object.keys(ItemInfo.items).map((item) => {
    var esc = escape_name(item);
    escaped_items[esc] = item;
});

var event_name = new RegExp(/\w+/g);

var rule_aliases = {};
var nonaliases = new Set();

function load_aliases(ootr_version) {
    j = read_json('LogicHelpers.json', ootr_version);
    Object.keys(j).map((s) => {
        if (s.includes('(')) {
            var [rule, temp_args] = s.substring(0,s.length-1).split('(')
            var args = [];
            temp_args.split(',').map((arg) => {
                args.push(new RegExp('\\b' + arg.trim() + '\\b', 'g'));
            });
        } else {
            var [rule, args] = [s, []];
        }
        rule_aliases[rule] = { 'args': args, 'repl': replace_python_booleans(j[s]) };
    });
    nonaliases = Object.keys(escaped_items).filter(x => !(Object.keys(rule_aliases).includes(x)));
}

class RuleParser {
    constructor(world, ootr_version, debug=true) {
        this.world = world;
        this.version = ootr_version;
        this.events = new Set();
        this.replaced_rules = {};
        this.delayed_rules = [];
        if (Object.keys(rule_aliases).length === 0) {
            load_aliases(this.version);
        }
        this.rule_cache = {};
        this.subrule_cache = {};
        this.subrule_ast_cache = {};
        this.current_spot = null;
        this.original_rule = '';
        this.debug = debug;
        let self = this;
        this.logicVisitor = [function ootrLogicPlugin({ types: t }) {
            return {
                visitor: {
                    Identifier(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Name(self, t, path);
                    },
                    StringLiteral(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Str(self, t, path);
                    },
                    Program(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Program(self, t, path);
                    },
                    SequenceExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Tuple(self, t, path);
                    },
                    CallExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Call(self, t, path);
                    },
                    MemberExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Subscript(self, t, path);
                    },
                    BinaryExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_Compare(self, t, path);
                    },
                    UnaryExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_UnaryOp(self, t, path);
                    },
                    LogicalExpression(path) {
                        if (self.debug) console.log('transforming '+ path);
                        self.visit_BoolOp(self, t, path);
                    }
                }
            };
        }]
    }

    visit(self, rule_string) {
        if (self.debug) console.log(`start transforming rule ${rule_string}`);
        if (!(rule_string in self.subrule_cache) || rule_string.includes('here(') || rule_string.includes('at(')) {
            self.subrule_cache[rule_string] = babel.transformSync(rule_string, {
                    sourceType: 'script',
                    plugins: self.logicVisitor
                }).code;
        } else {
            if (self.debug) console.log('using cached rule\n');
        }
        return self.subrule_cache[rule_string];
    }

    // Babel will not visit AST subtrees. This method works
    // around the issue by creating a dummy program with the
    // subtree as the only expression, transforming, re-parsing
    // back to AST, then extracting the changed expression.
    visit_AST(self, ast) {
        let ast_code = generate(ast, {}, '').code;
        if (!(ast_code in self.subrule_ast_cache) || ast_code.includes('here(') || ast_code.includes('at(')) {
            let file = self.make_file(babel.types, ast);
            let new_code = babel.transformFromAstSync(file, undefined, {
                sourceType: 'script',
                plugins: self.logicVisitor
            }).code;
            let visited_ast = babel.parse(new_code);
            self.subrule_ast_cache[ast_code] = self.get_visited_node(babel.types, visited_ast);
        } else {
            if (self.debug) console.log('using cached rule\n');
        }
        return self.subrule_ast_cache[ast_code];
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
            path.replaceWith(repl_parsed.program.body[0].expression);
            path.skip();
        } else if (path.node.name in escaped_items) {
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(escaped_items[path.node.name])]
                )
            );
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world).includes(path.node.name)) {
            let world_parsed = self.world[path.node.name]
            let new_node;
            switch(typeof(world_parsed)) {
                case 'string':
                    new_node = t.stringLiteral(world_parsed);
                    break;
                case 'boolean':
                    new_node = t.booleanLiteral(world_parsed);
                    break;
                case 'number':
                    new_node = t.NumericLiteral(world_parsed);
                    break;
                case 'object':
                    if (Array.isArray(world_parsed)) {
                        new_node = t.ArrayExpression(Array.from(world_parsed).map((i) => { return t.stringLiteral(i); }));
                    } else {
                        throw 'Unhandled world property type: ' + typeof(world_parsed);
                    }
                    break;
                default:
                    throw 'Unhandled world property type: ' + typeof(world_parsed);
            }
            path.replaceWith(new_node);
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world.settings).includes(path.node.name)) {
            var worldsettings_parsed = self.world.settings[path.node.name];
            let new_node;
            switch(typeof(worldsettings_parsed)) {
                case 'string':
                    new_node = t.stringLiteral(worldsettings_parsed);
                    break;
                case 'boolean':
                    new_node = t.booleanLiteral(worldsettings_parsed);
                    break;
                case 'number':
                    new_node = t.NumericLiteral(worldsettings_parsed);
                    break;
                case 'object':
                    if (Array.isArray(worldsettings_parsed)) {
                        new_node = t.ArrayExpression(Array.from(worldsettings_parsed).map((i) => { return t.stringLiteral(i); }));
                    } else {
                        throw 'Unhandled world property type: ' + typeof(worldsettings_parsed);
                    }
                    break;
                default:
                    throw 'Unhandled world property type: ' + typeof(worldsettings_parsed);
            }
            path.replaceWith(new_node);
            path.skip();
        } else if (Object.getOwnPropertyNames(WorldState.prototype).includes(path.node.name)) {
            var worldstate_prop = self.make_call(self, t, path, path.node.name, [], []);
            path.replaceWith(worldstate_prop);
            path.skip();
        } else if (path.node.name in kwarg_defaults || path.node.name in allowed_globals) {
            // do nothing
            return;
        } else if (event_name[Symbol.match](path.node.name)) {
            self.events.add(path.node.name.replaceAll('_', ' '));
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(path.node.name.replaceAll('_', ' '))]
                )
            );
            path.skip();
        } else {
            throw 'Parse error: invalid node name: ' + path.node.name;
        }
    }

    // Rules that are just a string get processed as a directive
    // instead of an expression, which prevents transformation
    // through visit_Str to state.has(literal). This function
    // converts the directives back to expressions for further
    // transformation.
    visit_Program(self, t, path) {
        if (path.node.directives.length > 0) {
            if (path.node.body.length > 0) {
                throw('Found directives in program with non-null expression');
            }
            path.replaceWith(t.program(
                [t.expressionStatement(t.stringLiteral(path.node.directives[0].value.value))]
            ));
        }
    }

    visit_Str(self, t, path) {
        path.replaceWith(
            t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier('has')),
                [t.stringLiteral(path.node.value)]
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

        if (item.value in escaped_items) {
            item = t.StringLiteral(escaped_items[item.value]);
        }

        if (!(Object.keys(ItemInfo.items).includes(item.value))) {
            self.events.add(item.value);
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
                throw `Parse error: expected ${args.length} args for ${path}, not ${path.node.arguments.length}`;
            }
            args.forEach((arg_re, idx) => {
                var val;
                var arg_val = path.node.arguments[idx];
                if (t.isIdentifier(arg_val)) {
                    val = arg_val.name;
                } else if (t.isStringLiteral(arg_val)) {
                    val = arg_val.value;
                } else {
                    throw `Parse error: invalid argument ${arg_val}`;
                }
                repl = arg_re[Symbol.replace](repl, val);
            });
            var repl_parsed = babel.parse(self.visit(self, repl));
            path.replaceWith(repl_parsed.program.body[0].expression);
            path.skip();
        } else {
            let new_args = [];
            let kwargs = [];
            path.node.arguments.forEach((child) => {
                if (t.isIdentifier(child)) {
                    if (Object.getOwnPropertyNames(self.world).includes(child.name)) {
                        child = babel.parse(self.world[child.name].toString()).program.body[0].expression;
                    } else if (Object.getOwnPropertyNames(self.world.settings).includes(child.name)) {
                        child = babel.parse(self.world.settings[child.name].toString()).program.body[0].expression;
                    } else if (child.name in rule_aliases) {
                        child = self.visit_AST(self, child);
                    } else if (child.name in escaped_items) {
                        child = t.stringLiteral(escaped_items[child.name]);
                    } else {
                        child = t.stringLiteral(child.name.replaceAll('_', ' '));
                    }
                // JS-exclusive condition to filter out keyword arguments.
                // Python automatically separates these to node.keywords from node.args.
                } else if (t.isAssignmentExpression(child)) {
                    kwargs.push(child);
                } else if (!(t.isStringLiteral(child)) && !(t.isNumericLiteral(child))) {
                    child = self.visit_AST(self, child);
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
                    t.StringLiteral(s.replaceAll('_', ' ')),
                    true // preserve computed property
                )
            );
            path.skip();
        }
    }

    visit_Compare(self, t, path) {
        function escape_or_string(n, t) {
            if (t.isIdentifier(n) && n.name in escaped_items) {
                return t.StringLiteral(escaped_items[n.name]);
            } else if (!t.isStringLiteral(n)) {
                return self.visit_AST(self, n);
            }
            return n;
        }

        // Python BinOp nodes (e.g. "+", "-") are also BinaryExpressions in JS,
        // so need to filter them out to route to the correct transformer
        if (!(['===', '!==', '>=', '<=', '>', '<', 'in'].includes(path.node.operator))) {
            // Python visit_BinOp exists, but does not appear to be used
            return;
        }

        // Python splits multiple comparisons from one expression
        // into multiple node.ops and node.comparators properties.
        // JS nests BinaryExpressions from left to right.
        if (t.isIdentifier(path.node.left) && path.node.operator === '===' && t.isIdentifier(path.node.right)) {
            if (!Object.getOwnPropertyNames(self.world).includes(path.node.left.name) &&
                !Object.getOwnPropertyNames(self.world).includes(path.node.right.name) &&
                !Object.getOwnPropertyNames(self.world.settings).includes(path.node.left.name) &&
                !Object.getOwnPropertyNames(self.world.settings).includes(path.node.right.name)) {
                    path.replaceWith(t.booleanLiteral(path.node.left.name === path.node.right.name))
                    path.skip();
                    return;
            }
        }

        if (t.isBinaryExpression(path.node.left)) {
            path.node.left = self.visit_AST(self, path.node.left);
        } else {
            path.node.left = escape_or_string(path.node.left, t);
        }
        path.node.right = escape_or_string(path.node.right, t);

        if (self.isLiteral(self, t, path.node.right) && self.isLiteral(self, t, path.node.left)) {
            let res = eval(generate(path.node, {}, '').code);
            path.replaceWith(t.booleanLiteral(res));
            path.skip();
        }
        path.skip();
    }

    visit_UnaryOp(self, t, path) {
        path.node.argument = self.visit_AST(self, path.node.argument);
        if (self.isLiteral(self, t, path.node.argument)) {
            let res = eval(generate(path.node, {}, '').code);
            path.replaceWith(t.booleanLiteral(res));
        }
        path.skip();
    }

    visit_BoolOp(self, t, path) {
        function traverse_logic(n, t, op) {
            // Python groups all elements with common operators
            // outside of parentheses. JS nests LogicalExpressions
            // such that there is always one left and one right.
            // The first condition here unwraps the nested logic
            // for the has_any_of and has_all_of arguments to be
            // roughly equivalent to the Python transform.
            if (t.isLogicalExpression(n) && n.operator === op) {
                traverse_logic(n.left, t, op);
                // test if the early return was hit before parsing the next comparator in the chain
                if (t.isBooleanLiteral(path.node)) {
                    return;
                }
                traverse_logic(n.right, t, op);
            } else if (t.isStringLiteral(n)) {
                item_set.add(n.value);
            } else if (t.isIdentifier(n) && !!n.id && nonaliases.includes(n.id)) {
                item_set.add(escaped_items[n.id]);
            } else {
                let elt = self.visit_AST(self, n);
                if (t.isBooleanLiteral(elt)) {
                    if (elt.value === early_return) {
                        path.replaceWith(elt);
                        path.skip();
                        return;
                    }
                } else if (t.isCallExpression(elt) && t.isMemberExpression(elt.callee)
                            && ['has', groupable].includes(elt.callee.property.name) && elt.arguments.length === 1) {
                    let args = elt.arguments[0];
                    if (t.isStringLiteral(args)) {
                        item_set.add(args.value);
                    } else if (t.isIdentifier(args)) {
                        item_set.add(args.name);
                    } else {
                        // assumed to be an array of identifiers
                        args.elements.forEach((i) => {
                            item_set.add(i.value);
                        });
                    }
                } else if (t.isLogicalExpression(elt) && elt.operator !== op) {
                    if (n.extra) {
                        elt.extra = n.extra;
                    }
                    new_values.push(elt);
                } else {
                    new_values.push(elt);
                }
            }
        }

        // repack logic back into nested logical expressions
        function rebuild_logic(t, e, op) {
            let right = e.pop();
            let left;
            if (e.length > 1) {
                left = rebuild_logic(t, e, op);
            } else {
                left = e.pop();
            }
            return t.logicalExpression(op, left, right);
        }

        let early_return = path.node.operator === '||';
        let groupable = early_return ? 'has_any_of' : 'has_all_of';
        let item_set = new Set();
        let new_values = [];
        traverse_logic(path.node.left, t, path.node.operator);
        // test if the early return was hit before parsing the last comparator in the chain
        if (t.isBooleanLiteral(path.node)) {
            return;
        }
        traverse_logic(path.node.right, t, path.node.operator);
        // test if the early return was hit before parsing the last comparator in the chain
        if (t.isBooleanLiteral(path.node)) {
            return;
        }

        if (item_set.size === 0 && new_values.length === 0) {
            path.replaceWith(t.booleanLiteral(!early_return));
            path.skip();
            return;
        }

        let expressions = [];
        if (item_set.size > 0) {
            let call = t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier(groupable)
                ),
                [t.ArrayExpression(Array.from(item_set).map((i) => { return t.stringLiteral(i); }))]
            );
            expressions = [call].concat(new_values);
        } else {
            expressions = new_values;
        }
        if (expressions.length === 1) {
            path.replaceWith(expressions[0]);
            path.skip();
            return;
        }
        path.replaceWith(rebuild_logic(t, expressions, path.node.operator));
        path.skip();
    }

    make_call(self, t, node, name, args, kwargs) {
        if (!Object.getOwnPropertyNames(WorldState.prototype).includes(name)) {
            throw `Parse error: No such function State.${name}`;
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

    replace_subrule(self, path, target, node) {
        const rule = generate(node, {}, '').code;
        const t = babel.types;
        if (target in self.replaced_rules && rule in self.replaced_rules[target]) {
            path.replaceWith(self.replaced_rules[target][rule]);
        } else {
            if (!(target in self.replaced_rules)) {
                self.replaced_rules[target] = {};
            }
            var subrule_name = `${target} Subrule ${1 + Object.keys(self.replaced_rules[target]).length}`;
            self.delayed_rules.push({"target": target, "node": node, "subrule": rule, "subrule_name": subrule_name});
            var item_rule = t.callExpression(
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
        let self = this;
        console.log('parsing delayed rules');
        self.delayed_rules.map((rule) => {
            var region_name = rule['target'];
            var node = rule['node'];
            var subrule_name = rule['subrule_name'];
            //console.log(`parsing event ${subrule_name} in ${region_name}`);
            var region = self.world.get_region(region_name);
            var event = new Location({name: subrule_name, type: 'Event', parent: region, internal: true});
            event.rule_string = rule['subrule'].trim();
            event.world = self.world;
            self.current_spot = event;
            var access_rule_str = generate(self.visit_AST(self, node), {}, '').code;
            var access_rule = self.make_access_rule(access_rule_str);
            if (access_rule_str === 'false') {
                event.access_rule = null;
                event.never = true;
            } else {
                if (access_rule_str === 'true') {
                    event.always = true;
                }
                event.set_rule(access_rule);
                region.locations.push(event);
                MakeEventItem(subrule_name, event);
            }
        });
        self.delayed_rules = [];
    }

    make_access_rule(rule_str) {
        let self = this;
        if (!!(this.current_spot)) this.current_spot.transformed_rule = rule_str;
        if (this.debug) console.log(`done transforming rule`);
        if (!(rule_str in self.rule_cache)) {
            var t = babel.types;
            var proto = babel.parse(access_proto);
            var params = proto.program.body[0].expression.params;
            var rule_ast = babel.parse(rule_str);
            var body = rule_ast.program.body[0].expression;
            var exp = t.arrowFunctionExpression(params,body,false);
            var stmt = t.expressionStatement(exp);
            var p = t.program([stmt]);
            var code = generate(p, {}, rule_str).code;
            self.rule_cache[rule_str] = eval(code);
            if (this.debug) console.log(`final logic function:\n ${code}\n`);
        } else {
            if (this.debug) console.log('using cached rule\n');
        }
        return self.rule_cache[rule_str];
    }

    make_file(t, ast) {
        let p = ast;
        if (!t.isFile(ast)) {
            if (!t.isProgram(ast)) {
                if (!t.isExpressionStatement(ast)) {
                    p = t.expressionStatement(p);
                }
                p = t.program([p]);
            }
            p = t.file(p);
        }
        return p;
    }

    get_visited_node(t, ast) {
        if (ast.program.body.length > 0) {
            // non-literals
            return ast.program.body[0].expression;
        } else {
            // literals
            if (t.isDirectiveLiteral(ast.program.directives[0].value)) {
                // string literal gets converted to a directive literal for whatever reason
                return t.stringLiteral(ast.program.directives[0].value.value);
            } else {
                return ast.program.directives[0].value;
            }
        }
    }

    isLiteral(self, t, n) {
        if (t.isBinaryExpression(n)) {
            return self.isLiteral(self, t, n.left) && self.isLiteral(self, t, n.right);
        } else {
            return t.isNumericLiteral(n) || t.isStringLiteral(n) || t.isBooleanLiteral(n);
        }
    }

    at(self, path) {
        if (path.node.arguments.length !== 2) {
            throw(`Parse error: invalid at() arguments (${path.node.arguments}) for spot ${self.current_spot.name}`);
        }
        self.replace_subrule(self, path, path.node.arguments[0].value, path.node.arguments[1]);
    }

    here(self, path) {
        if (path.node.arguments.length !== 1) {
            throw(`Parse error: invalid here() arguments (${path.node.arguments}) for spot ${self.current_spot.name}`);
        }
        self.replace_subrule(self, path, self.current_spot.parent_region.name, path.node.arguments[0]);
    }

    at_day(self, path) {
        if (self.world.ensure_tod_access) {
            path.replaceWith(self.get_visited_node(babel.types, babel.parse("!!tod ? (tod & TimeOfDay.DAY) : (worldState.has_all_of(['Ocarina', 'Suns Song']) || worldState.search.can_reach(spot.parent_region, age, TimeOfDay.DAY))")));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_dampe_time(self, path) {
        if (self.world.ensure_tod_access) {
            path.replaceWith(self.get_visited_node(babel.types, babel.parse("!!tod ? (tod & TimeOfDay.DAMPE) : worldState.search.can_reach(spot.parent_region, age, TimeOfDay.DAMPE)")));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_night(self, path) {
        if (self.current_spot.type === 'GS Token' && self.world.logic_no_night_tokens_without_suns_song) {
            path.replaceWith(self.get_visited_node(babel.types, babel.parse(self.visit(self, 'can_play(Suns_Song)'))));
        } else if (self.world.ensure_tod_access) {
            path.replaceWith(self.get_visited_node(babel.types, babel.parse("!!tod ? (tod & TimeOfDay.DAMPE) : (worldState.has_all_of(['Ocarina', 'Suns Song']) || worldState.search.can_reach(spot.parent_region, age, TimeOfDay.DAMPE))")));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    parse_rule(rule_string, spot=null) {
        this.current_spot = spot;
        this.original_rule = rule_string;
        return this.make_access_rule(this.visit(this, rule_string))
    }

    parse_spot_rule(spot) {
        let rule = spot.rule_string.split('#', 1)[0].trim();

        let access_rule = this.parse_rule(rule, spot);
        spot.set_rule(access_rule);
        if (access_rule === this.rule_cache['false;']) {
            spot.never = true;
        }
        if (access_rule === this.rule_cache['true;']) {
            spot.always = true;
        }
    }
}

module.exports = RuleParser;