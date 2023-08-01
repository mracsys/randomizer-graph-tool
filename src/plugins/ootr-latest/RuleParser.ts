import * as babel from "@babel/core";
import { NodePath } from "@babel/core";
//import { PluginObj, transformSync, transformFromAstSync, NodePath, Node } from "@babel/core";
import { parse } from "@babel/parser";
import { transform, transformFromAst } from "@babel/standalone";
import { CodeGenerator } from '@babel/generator';

import WorldState from "./WorldState.js";
import { Location } from "./Location.js";
import Entrance from "./Entrance.js";
import { MakeEventItem } from "./Item.js";
import { TimeOfDay } from "./Region.js";
import { read_macro_json, replace_python_booleans } from "./Utils.js";
import escape_name from "./RulesCommon.js";
import ExternalFileCache from "./OotrFileCache.js";
import World from "./World.js";
import OotrVersion from "./OotrVersion.js";

export type Spot = Entrance | Location;
export type kwargs = { age?: string | null, spot?: Spot | null, tod?: number | null };
export type AccessRule = (worldState: WorldState, { age, spot, tod }: kwargs) => boolean;
type DelayedRule = {
    target: string,
    node: babel.types.Node,
    subrule: string,
    subrule_name: string,
};
type RuleCache = {
    [rule_str: string]: AccessRule,
};
type SubruleCache = {
    [rule_str: string]: string,
};
type SubruleAstCache = {
    [rule_str: string]: babel.types.Expression,
};
type DynamicProps<T> = {
    [key: string]: T,
};
type LogicOperator = "||" | "&&" | "??";

const access_proto: string = "(worldState, { age = null, spot = null, tod = null } = {}) => true";
const kwarg_defaults: kwargs = {
    'age': null,
    'spot': null,
    'tod': TimeOfDay.NONE
};

const allowed_globals = { 'TimeOfDay': TimeOfDay };

function getProperty<T>(obj: DynamicProps<T>, key: string): T {
    return obj[key];
}

export default class RuleParser {
    public world: World;
    public version: OotrVersion;
    public events: Set<string>;
    public replaced_rules: {
        [target_region: string]: {
            [rule_str: string]: babel.types.CallExpression,
        },
    };
    public delayed_rules: DelayedRule[];
    public rule_cache: RuleCache;
    public subrule_cache: SubruleCache;
    public subrule_ast_cache: SubruleAstCache;
    public current_spot: Spot | null;
    public original_rule: string;
    public debug: boolean;
    public logicVisitor: babel.PluginItem[];
    private escaped_items: {[escaped_name: string]: string};
    private event_name: RegExp;
    private rule_aliases: {
        [rule: string]: {
            args: RegExp[],
            repl: string,
        }
    };
    private nonaliases: string[];

    constructor(world: World, ootr_version: OotrVersion, debug: boolean = false) {
        this.world = world;
        this.version = ootr_version;
        this.events = new Set();
        this.replaced_rules = {};
        this.delayed_rules = [];
        this.rule_cache = {};
        this.subrule_cache = {};
        this.subrule_ast_cache = {};
        this.current_spot = null;
        this.original_rule = '';
        this.debug = debug;

        // global variables in python OOTR, no need here,
        // and we need to refactor ItemInfo to reference
        // the parent plugin anyway
        this.escaped_items = {};
        Object.keys(world.parent_graph.ItemInfo.items).map((item) => {
            let esc = escape_name(item);
            this.escaped_items[esc] = item;
        });
        this.event_name = new RegExp(/\w+/g);
        this.rule_aliases = {};
        this.nonaliases = [];
        this.load_aliases(this.world.parent_graph.file_cache);

        let self = this;
        this.logicVisitor = [function ootrLogicPlugin({ types: t }): babel.PluginObj {
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
        }];
    }

    load_aliases(file_cache: ExternalFileCache) {
        let j = read_macro_json('LogicHelpers.json', file_cache);
        Object.keys(j).map((s) => {
            let rule: string = s;
            let args: RegExp[] = [];
            let temp_args: string;
            if (s.includes('(')) {
                [rule, temp_args] = s.substring(0,s.length-1).split('(')
                temp_args.split(',').map((arg) => {
                    args.push(new RegExp('\\b' + arg.trim() + '\\b', 'g'));
                });
            }
            this.rule_aliases[rule] = { args: args, repl: replace_python_booleans(j[s]) };
        });
        this.nonaliases = Object.keys(this.escaped_items).filter(x => !(Object.keys(this.rule_aliases).includes(x)));
    }

    visit(self: RuleParser, rule_string: string): string {
        if (self.debug) console.log(`start transforming rule ${rule_string}`);
        if (!(rule_string in self.subrule_cache) || rule_string.includes('here(') || rule_string.includes('at(')) {
            let transformed_code = transform(rule_string, {
                sourceType: 'script',
                plugins: self.logicVisitor
            });
            if (!!transformed_code && !!transformed_code.code && transformed_code.code !== undefined) {
                self.subrule_cache[rule_string] = transformed_code.code;
            } else {
                throw(`Error transforming access rule: Transform result is null for ${rule_string}`);
            }
        } else {
            if (self.debug) console.log('using cached rule\n');
        }
        return self.subrule_cache[rule_string];
    }

    // Babel will not visit AST subtrees. This method works
    // around the issue by creating a dummy program with the
    // subtree as the only expression, transforming, re-parsing
    // back to AST, then extracting the changed expression.
    visit_AST(self: RuleParser, ast: babel.types.Node): babel.types.Expression {
        let ast_code = new CodeGenerator(ast, {}, '').generate().code;
        if (!(ast_code in self.subrule_ast_cache) || ast_code.includes('here(') || ast_code.includes('at(')) {
            let file = self.make_file(babel.types, ast);
            let transformed_code: babel.BabelFileResult = transformFromAst(file, undefined, {
                sourceType: 'script',
                plugins: self.logicVisitor
            });
            if (!!transformed_code && !!transformed_code.code && transformed_code.code !== undefined) {
                let visited_ast = parse(transformed_code.code);
                if (!!visited_ast) {
                    self.subrule_ast_cache[ast_code] = self.get_visited_node(babel.types, visited_ast);
                } else {
                    throw(`Error transforming access rule: Transform result is null for ${ast_code}`);
                }
            } else {
                throw(`Error transforming access rule: Transform result is null for ${ast_code}`);
            }
        } else {
            if (self.debug) console.log('using cached rule\n');
        }
        return self.subrule_ast_cache[ast_code];
    }

    visit_Name(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.Identifier>) {
        if (Object.getOwnPropertyNames(RuleParser.prototype).includes(path.node.name)) {
            //here, at, tod tests
            let dynamic_class: DynamicProps<any> = self;
            let event_func = getProperty(dynamic_class, path.node.name);
            if (typeof event_func === 'function') {
                event_func(self, path);
            } else {
                throw `Parse error: attempted to call non-callable RuleParser property: ${path.node.name}`;
            }
            //self[path.node.name](self, path)
        } else if (path.node.name in self.rule_aliases) {
            let args = self.rule_aliases[path.node.name]['args'];
            let repl = self.rule_aliases[path.node.name]['repl'];
            if (args.length > 0) {
                throw `non-zero args required for ${path.node.name}`;
            }
            // traverse repl and return
            let repl_parsed = parse(self.visit(self, repl));
            if (!!repl_parsed) {
                let b = <babel.types.ExpressionStatement>repl_parsed.program.body[0];
                path.replaceWith(b.expression);
                path.skip();
            } else {
                throw(`Error parsing rule alias: Transform result is null for ${path.node.name}`);
            }
        } else if (path.node.name in self.escaped_items) {
            path.replaceWith(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('has')),
                    [t.stringLiteral(self.escaped_items[path.node.name])]
                )
            );
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world).includes(path.node.name)) {
            let new_node = t.memberExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier('world')
                ),
                t.identifier(path.node.name)
            );
            /*
            let dynamic_class: DynamicProps<any> = self.world;
            let world_parsed = getProperty(dynamic_class, path.node.name);
            //let world_parsed = self.world[path.node.name];
            let new_node;
            switch(typeof(world_parsed)) {
                case 'string':
                    new_node = t.stringLiteral(world_parsed);
                    break;
                case 'boolean':
                    new_node = t.booleanLiteral(world_parsed);
                    break;
                case 'number':
                    new_node = t.numericLiteral(world_parsed);
                    break;
                case 'object':
                    if (Array.isArray(world_parsed)) {
                        new_node = t.arrayExpression(Array.from(world_parsed).map((i) => { return t.stringLiteral(i); }));
                    } else {
                        throw 'Unhandled world property type: ' + typeof(world_parsed);
                    }
                    break;
                default:
                    throw 'Unhandled world property type: ' + typeof(world_parsed);
            }*/
            path.replaceWith(new_node);
            path.skip();
        } else if (Object.getOwnPropertyNames(self.world.settings).includes(path.node.name)) {
            let new_node = t.memberExpression(
                t.memberExpression(
                    t.memberExpression(
                        t.identifier('worldState'),
                        t.identifier('world')
                    ),
                    t.identifier('settings')
                ),
                t.identifier(path.node.name)
            );
            /*let worldsettings_parsed = self.world.settings[path.node.name];
            let new_node;
            switch(typeof(worldsettings_parsed)) {
                case 'string':
                    new_node = t.stringLiteral(worldsettings_parsed);
                    break;
                case 'boolean':
                    new_node = t.booleanLiteral(worldsettings_parsed);
                    break;
                case 'number':
                    new_node = t.numericLiteral(worldsettings_parsed);
                    break;
                case 'object':
                    if (Array.isArray(worldsettings_parsed)) {
                        new_node = t.arrayExpression(Array.from(worldsettings_parsed).map((i) => { return t.stringLiteral(i); }));
                    } else {
                        throw 'Unhandled world property type: ' + typeof(worldsettings_parsed);
                    }
                    break;
                default:
                    throw 'Unhandled world property type: ' + typeof(worldsettings_parsed);
            }*/
            path.replaceWith(new_node);
            path.skip();
        } else if (Object.getOwnPropertyNames(WorldState.prototype).includes(path.node.name)) {
            let worldstate_prop = self.make_call(self, t, path.node, path.node.name, [], []);
            path.replaceWith(worldstate_prop);
            path.skip();
        } else if (path.node.name in kwarg_defaults || path.node.name in allowed_globals) {
            // do nothing
            return;
        } else if (self.event_name[Symbol.match](path.node.name)) {
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
    visit_Program(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.Program>) {
        if (path.node.directives.length > 0) {
            if (path.node.body.length > 0) {
                throw('Found directives in program with non-null expression');
            }
            path.replaceWith(t.program(
                [t.expressionStatement(t.stringLiteral(path.node.directives[0].value.value))]
            ));
        }
    }

    visit_Str(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.StringLiteral>) {
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

    // unused
    visit_Constant(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.StringLiteral>) {
        if (typeof(path.node.value) === 'string') {
            self.visit_Str(self, t, path);
        }
    }

    visit_Tuple(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.SequenceExpression>) {
        if (path.node.expressions.length != 2) {
            throw 'Parse error: Tuple must have 2 values: ' + path;
        }

        let [item, num] = path.node.expressions;

        if (!(t.isIdentifier(item) || t.isStringLiteral(item))) {
            throw 'Parse error: Tuple first value must be an item: ' + item;
        }
        if (t.isIdentifier(item)) {
            item = t.stringLiteral(item.name);
        }

        if (!(t.isIdentifier(num) || t.isNumericLiteral(num))) {
            throw 'Parse error: Tuple second value must be a number: ' + num;
        }
        if (t.isIdentifier(num)) {
            if (!!(self.world.settings[num.name])) {
                num = t.numericLiteral(<number>self.world.settings[num.name]);
            } else {
                throw `Parse error: Tuple second value was a world setting, and the world setting was null: ${num.name}`;
            }
        }

        if (item.value in self.escaped_items) {
            item = t.stringLiteral(self.escaped_items[item.value]);
        }

        if (!(Object.keys(self.world.parent_graph.ItemInfo.items).includes(item.value))) {
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

    visit_Call(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.CallExpression>) {
        if (!(t.isIdentifier(path.node.callee))) {
            return;
        }

        if (Object.getOwnPropertyNames(RuleParser.prototype).includes(path.node.callee.name)) {
            let dynamic_class: DynamicProps<any> = self;
            let event_func = getProperty(dynamic_class, path.node.callee.name);
            if (typeof event_func === 'function') {
                event_func(self, path);
            } else {
                throw `Parse error: attempted to call non-callable RuleParser property: ${path.node.callee.name}`;
            }
            //self[path.node.callee.name](self, path);
        } else if (path.node.callee.name in self.rule_aliases) {
            let args = self.rule_aliases[path.node.callee.name]['args'];
            let repl = self.rule_aliases[path.node.callee.name]['repl'];
            if (args.length !== path.node.arguments.length) {
                throw `Parse error: expected ${args.length} args for ${path}, not ${path.node.arguments.length}`;
            }
            args.forEach((arg_re, idx) => {
                let val;
                let arg_val = path.node.arguments[idx];
                if (t.isIdentifier(arg_val)) {
                    val = arg_val.name;
                } else if (t.isStringLiteral(arg_val)) {
                    val = arg_val.value;
                } else {
                    throw `Parse error: invalid argument ${arg_val}`;
                }
                repl = arg_re[Symbol.replace](repl, val);
            });
            let repl_parsed = parse(self.visit(self, repl));
            if (!!repl_parsed) {
                let b = <babel.types.ExpressionStatement>repl_parsed.program.body[0];
                path.replaceWith(b.expression);
                path.skip();
            } else {
                throw(`Error parsing rule alias: Transform result is null for ${path.node.callee.name}`);
            }
        } else {
            let new_args: babel.types.Expression[] = [];
            let kwargs: babel.types.AssignmentExpression[] = [];
            for (let child of path.node.arguments) {
                // JS-exclusive condition to filter out keyword arguments.
                // Python automatically separates these to node.keywords from node.args.
                if (t.isAssignmentExpression(child)) {
                    kwargs.push(child);
                } else {
                    let arg: babel.types.Expression;
                    if (t.isIdentifier(child)) {
                        if (Object.getOwnPropertyNames(self.world).includes(child.name)) {
                            arg = t.memberExpression(
                                t.memberExpression(
                                    t.identifier('worldState'),
                                    t.identifier('world')
                                ),
                                t.identifier(child.name)
                            );
                            /*let dynamic_class: DynamicProps<any> = self.world;
                            let world_parsed = getProperty(dynamic_class, child.name).toString();
                            world_parsed = babel.parse(world_parsed);
                            if (!!world_parsed) {
                                let b = <babel.types.ExpressionStatement>world_parsed.program.body[0];
                                arg = b.expression;
                            } else {
                                throw(`Unhandled world property: ${child.name}`);
                            }*/
                            //arg = babel.parse(self.world[child.name].toString()).program.body[0].expression;
                        } else if (Object.getOwnPropertyNames(self.world.settings).includes(child.name)) {
                            arg = t.memberExpression(
                                t.memberExpression(
                                    t.memberExpression(
                                        t.identifier('worldState'),
                                        t.identifier('world')
                                    ),
                                    t.identifier('settings')
                                ),
                                t.identifier(child.name)
                            );
                            /*let dynamic_class: DynamicProps<any> = self.world.settings;
                            let world_parsed = getProperty(dynamic_class, child.name).toString();
                            world_parsed = babel.parse(world_parsed);
                            if (!!world_parsed) {
                                let b = <babel.types.ExpressionStatement>world_parsed.program.body[0];
                                arg = b.expression;
                            } else {
                                throw(`Unhandled world settings property: ${child.name}`);
                            }*/
                            //arg = babel.parse(self.world.settings[child.name].toString()).program.body[0].expression;
                        } else if (child.name in self.rule_aliases) {
                            arg = self.visit_AST(self, child);
                        } else if (child.name in self.escaped_items) {
                            arg = t.stringLiteral(self.escaped_items[child.name]);
                        } else {
                            arg = t.stringLiteral(child.name.replaceAll('_', ' '));
                        }
                    } else if (!(t.isStringLiteral(child)) && !(t.isNumericLiteral(child))) {
                        arg = self.visit_AST(self, child);
                    } else {
                        arg = child;
                    }
                    new_args.push(arg);
                }
            }
            path.replaceWith(self.make_call(self, t, path.node, path.node.callee.name, new_args, kwargs));
            path.skip();
        }
    }

    visit_Subscript(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.MemberExpression>) {
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
            let s: string;
            if (t.isIdentifier(path.node.property)) {
                s = path.node.property.name;
            } else if (t.isStringLiteral(path.node.property)) {
                s = path.node.property.value;
            } else {
                throw `Parse error: unhandled subscript type ${path.node.property}`;
            }
            path.replaceWith(
                t.memberExpression(
                    t.memberExpression(
                        t.memberExpression(
                            t.identifier('worldState'),
                            t.identifier('world')
                        ),
                        path.node.object
                    ),
                    t.stringLiteral(s.replaceAll('_', ' ')),
                    true // preserve computed property
                )
            );
            path.skip();
        }
    }

    visit_Compare(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.BinaryExpression>) {
        function escape_or_string(n: babel.types.Node, t: typeof babel.types) {
            if (t.isIdentifier(n) && n.name in self.escaped_items) {
                return t.stringLiteral(self.escaped_items[n.name]);
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

        // Python splits multiple comparisons from one expression
        // into multiple node.ops and node.comparators properties.
        // JS nests BinaryExpressions from left to right.
        if (t.isBinaryExpression(path.node.left)) {
            path.node.left = self.visit_AST(self, path.node.left);
        } else {
            path.node.left = escape_or_string(path.node.left, t);
        }
        path.node.right = escape_or_string(path.node.right, t);

        // JS 'in' operator doesn't work on arrays in the same
        // way as Python. Need to replace with Array.includes(element)
        if (path.node.operator === 'in') {
            let inc = t.callExpression(
                t.memberExpression(
                    path.node.right,
                    t.identifier('includes')
                ),
                [path.node.left]
            );
            path.replaceWith(inc);
            path.skip();
            return;
        }

        /*if (self.isLiteral(self, t, path.node.right) && self.isLiteral(self, t, path.node.left)) {
            let res = eval(new CodeGenerator(path.node, {}, '').generate().code);
            path.replaceWith(t.booleanLiteral(res));
            path.skip();
        }*/
        path.skip();
    }

    visit_UnaryOp(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.UnaryExpression>) {
        path.node.argument = self.visit_AST(self, path.node.argument);
        /*if (self.isLiteral(self, t, path.node.argument)) {
            let res = eval(new CodeGenerator(path.node, {}, '').generate().code);
            path.replaceWith(t.booleanLiteral(res));
        }*/
        path.skip();
    }

    visit_BoolOp(self: RuleParser, t: typeof babel.types, path: babel.NodePath<babel.types.LogicalExpression>) {
        function traverse_logic(n: babel.types.Node, t: typeof babel.types, op: string): void {
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
            } else if (t.isIdentifier(n) && !!n.name && self.nonaliases.includes(n.name)) {
                item_set.add(self.escaped_items[n.name]);
            } else {
                let elt = self.visit_AST(self, n);
                if (t.isBooleanLiteral(elt)) {
                    if (elt.value === early_return) {
                        path.replaceWith(elt);
                        path.skip();
                        return;
                    }
                } else if (t.isCallExpression(elt) && t.isMemberExpression(elt.callee) && t.isIdentifier(elt.callee.property)
                            && ['has', groupable].includes(elt.callee.property.name) && elt.arguments.length === 1) {
                    let args = elt.arguments[0];
                    if (t.isStringLiteral(args)) {
                        item_set.add(args.value);
                    } else if (t.isIdentifier(args)) {
                        item_set.add(args.name);
                    } else if (t.isArrayExpression(args)) {
                        // assumed to be an array of identifiers
                        args.elements.forEach((i) => {
                            if (t.isStringLiteral(i)) {
                                item_set.add(i.value);
                            } else {
                                throw `Non-string argument in call expression: ${i}`;
                            }
                        });
                    } else {
                        throw `Unknown argument type for ${elt.callee.property.name}: ${elt.arguments}`;
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
        function rebuild_logic(t: typeof babel.types, e: babel.types.Expression[], op: LogicOperator): babel.types.LogicalExpression {
            let right_test = e.pop();
            let right: babel.types.Expression
            if (right_test !== undefined) {
                right = right_test;
            } else {
                throw `Right side of comparison is undefined`;
            }
            let left: babel.types.Expression;
            if (e.length > 1) {
                left = rebuild_logic(t, e, op);
            } else {
                let left_test = e.pop();
                if (left_test !== undefined) {
                    left = left_test;
                } else {
                    throw `Left side of comparison is undefined`;
                }
            }
            return t.logicalExpression(op, left, right);
        }

        let early_return = path.node.operator === '||';
        let groupable = early_return ? 'has_any_of' : 'has_all_of';
        let item_set: Set<string> = new Set();
        let new_values: babel.types.Expression[] = [];
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

        let expressions: babel.types.Expression[] = [];
        if (item_set.size > 0) {
            let call = t.callExpression(
                t.memberExpression(
                    t.identifier('worldState'),
                    t.identifier(groupable)
                ),
                [t.arrayExpression(Array.from(item_set).map((i) => { return t.stringLiteral(i); }))]
            );
            expressions = [call];
            expressions = expressions.concat(new_values); // separate line to make typescript happy...
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

    make_call(self: RuleParser, t: typeof babel.types, node: babel.types.Expression, name: string, args: babel.types.Expression[], kwargs: babel.types.AssignmentExpression[]) {
        if (!Object.getOwnPropertyNames(WorldState.prototype).includes(name)) {
            throw `Parse error: No such function State.${name}`;
        }
        // Convert separate AssignmentExpression keyword args to
        // one combined ObjectExpression for use with parameter
        // destructuring to simulate Python **kwargs.
        // Not actually used anywhere outside top level access rules,
        // but kept here because python OOTR has it.
        //
        //let objargs = [];
        //kwargs.forEach((kwarg) => {
        //    objargs.push(t.objectProperty(kwarg.left, kwarg.right));
        //});
        //if (objargs.length > 0) {
        //    args.push(t.objectExpression(objargs));
        //}
        return t.callExpression(
            t.memberExpression(
                t.identifier('worldState'),
                t.identifier(name)),
            args
        );
    }

    replace_subrule(self: RuleParser, path: NodePath, target: string, node: babel.types.Node): void {
        const rule = new CodeGenerator(node, {}, '').generate().code;
        const t = babel.types;
        if (target in self.replaced_rules && rule in self.replaced_rules[target]) {
            path.replaceWith(self.replaced_rules[target][rule]);
        } else {
            if (!(target in self.replaced_rules)) {
                self.replaced_rules[target] = {};
            }
            let subrule_name = `${target} Subrule ${1 + Object.keys(self.replaced_rules[target]).length}`;
            self.delayed_rules.push({"target": target, "node": node, "subrule": rule, "subrule_name": subrule_name});
            let item_rule = t.callExpression(
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

    create_delayed_rules(): void {
        let self = this;
        //console.log('parsing delayed rules');
        self.delayed_rules.map((rule) => {
            let region_name = rule['target'];
            let node = rule['node'];
            let subrule_name = rule['subrule_name'];
            //console.log(`parsing event ${subrule_name} in ${region_name}`);
            let region = self.world.get_region(region_name);
            let event = new Location(subrule_name, 'Event', region, true, self.world);
            event.rule_string = rule['subrule'].trim();
            event.world = self.world;
            self.current_spot = event;
            let access_rule_str = new CodeGenerator(self.visit_AST(self, node), {}, '').generate().code;
            let access_rule = self.make_access_rule(access_rule_str);
            if (access_rule_str === 'false') {
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

    make_access_rule(rule_str: string): AccessRule {
        let self = this;
        if (!!(this.current_spot)) this.current_spot.transformed_rule = rule_str;
        if (this.debug) console.log(`done transforming rule`);
        if (!(rule_str in self.rule_cache)) {
            let t = babel.types;
            let proto = parse(access_proto);
            let params;
            if (!!proto) {
                let b = <babel.types.ExpressionStatement>proto.program.body[0];
                let arrow = <babel.types.ArrowFunctionExpression>b.expression;
                params = arrow.params; // damnit typescript
            } else throw `Error parsing access rule prototype parameters`;
            let rule_ast = parse(rule_str);
            let body;
            if (!!rule_ast) {
                let b = <babel.types.ExpressionStatement>rule_ast.program.body[0];
                body = b.expression;
            } else throw `Error parsing access rule to final AST`;
            let exp: babel.types.ArrowFunctionExpression
            if (!!params && !!body) {
                exp = t.arrowFunctionExpression(params,body,false);
            } else throw `Error building access rule arrow function`;
            let stmt: babel.types.ExpressionStatement
            if (!!exp) {
                stmt = t.expressionStatement(exp);
            } else throw `Error building access rule expression`; // finally, was that so hard typescript??
            let p = t.program([stmt]);
            let code = new CodeGenerator(p, {}, rule_str).generate().code;
            self.rule_cache[rule_str] = eval(code);
            if (this.debug) console.log(`final logic function:\n ${code}\n`);
        } else {
            if (this.debug) console.log('using cached rule\n');
        }
        return self.rule_cache[rule_str];
    }

    make_file(t: typeof babel.types, ast: babel.types.Node): babel.types.File {
        let f: babel.types.File;
        if (!t.isFile(ast)) {
            let p: babel.types.Program;
            if (!t.isProgram(ast)) {
                let s: babel.types.ExpressionStatement;
                if (!t.isExpressionStatement(ast)) {
                    let e = <babel.types.Expression>ast;
                    s = t.expressionStatement(e);
                } else {
                    s = <babel.types.ExpressionStatement>ast;
                }
                p = t.program([s]);
            } else {
                p = <babel.types.Program>ast;
            }
            f = t.file(p);
        } else {
            f = <babel.types.File>ast;
        }
        return f;
    }

    get_visited_node(t: typeof babel.types, ast: babel.types.File): babel.types.Expression {
        if (ast.program.body.length > 0) {
            // non-literals
            let b = <babel.types.ExpressionStatement>ast.program.body[0];
            return b.expression;
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

    isLiteral(self: RuleParser, t: typeof babel.types, n: babel.types.Node): boolean {
        if (t.isBinaryExpression(n)) {
            return self.isLiteral(self, t, n.left) && self.isLiteral(self, t, n.right);
        } else {
            return (t.isNumericLiteral(n) || t.isStringLiteral(n) || t.isBooleanLiteral(n));
        }
    }

    at(self: RuleParser, path: NodePath<babel.types.CallExpression>) {
        if (path.node.arguments.length !== 2) {
            throw(`Parse error: invalid at() arguments (${path.node.arguments})`);
        }
        if (!(babel.types.isStringLiteral(path.node.arguments[0]))) throw `Parse error: non-string used for at() region argument`;
        self.replace_subrule(self, path, path.node.arguments[0].value, path.node.arguments[1]);
    }

    here(self: RuleParser, path: NodePath<babel.types.CallExpression>) {
        if (path.node.arguments.length !== 1) {
            throw(`Parse error: invalid here() arguments (${path.node.arguments})`);
        }
        if (self.current_spot === null) throw `Parse error: here() called on null spot`;
        if (self.current_spot.parent_region === null) throw `Parse error: here() called on spot with null parent region`;
        self.replace_subrule(self, path, self.current_spot.parent_region.name, path.node.arguments[0]);
    }

    // NOTE: Python OOTR includes direct references to TimeOfDay static methods.
    //       These work in node, but were failing when exported to a library
    //       and imported into a react project. TimeOfDay constants are replaced
    //       with numeric values in each of the at_* rule strings as a workaround.

    at_day(self: RuleParser, path: NodePath) {
        if (self.world.ensure_tod_access) {
            let day = parse("!!tod ? (tod & 1) : (worldState.has_all_of(['Ocarina', 'Suns Song']) || worldState.search.can_reach(spot.parent_region, age, 1))");
            if (day === null || day === undefined) throw `Parse error: Unable to parse static at_day logic string`;
            path.replaceWith(self.get_visited_node(babel.types, day));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_dampe_time(self: RuleParser, path: NodePath) {
        if (self.world.ensure_tod_access) {
            let dampe = parse("!!tod ? (tod & 2) : worldState.search.can_reach(spot.parent_region, age, 2)");
            if (dampe === null || dampe === undefined) throw `Parse error: Unable to parse static at_dampe_time logic string`;
            path.replaceWith(self.get_visited_node(babel.types, dampe));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    at_night(self: RuleParser, path: NodePath) {
        if (self.current_spot === null) throw `Parse error: Tried to use time of day event generation with a null spot`;
        if (self.current_spot.type === 'GS Token' && self.world.settings.logic_no_night_tokens_without_suns_song) {
            let skull = parse(self.visit(self, 'can_play(Suns_Song)'));
            if (skull === null || skull === undefined) throw `Parse error: Unable to parse static at_night logic string`;
            path.replaceWith(self.get_visited_node(babel.types, skull));
        } else if (self.world.ensure_tod_access) {
            let night = parse("!!tod ? (tod & 2) : (worldState.has_all_of(['Ocarina', 'Suns Song']) || worldState.search.can_reach(spot.parent_region, age, 2))");
            if (night === null || night === undefined) throw `Parse error: Unable to parse static at_night logic string`;
            path.replaceWith(self.get_visited_node(babel.types, night));
        } else {
            path.replaceWith(babel.types.booleanLiteral(true));
        }
        path.skip();
    }

    parse_rule(rule_string: string, spot: Spot | null = null) {
        this.current_spot = spot;
        this.original_rule = rule_string;
        return this.make_access_rule(this.visit(this, rule_string))
    }

    parse_spot_rule(spot: Spot) {
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