// Type definitions for @babel/standalone 7.1
// Project: https://github.com/babel/babel/tree/master/packages/babel-standalone
// Definitions by: DefinitelyTyped <https://github.com/DefinitelyTyped>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// Minimum TypeScript Version: 3.4

declare module '@babel/standalone' {
    import { ParseResult } from '@babel/parser';
    import { TransformOptions, types, FileResultCallback, BabelFileResult, ParserOptions } from '@babel/core';

    export function transform(code: string, options: TransformOptions): BabelFileResult;

    export function transformFromAst(ast: types.Node, code: string | undefined, opts: TransformOptions | undefined, callback?: FileResultCallback): BabelFileResult;

    export function registerPlugin(name: string, plugin: object | (() => void)): void;

    export function registerPlugins(newPlugins: {
        [key: string]: object | (() => void)
    }): void;

    export function registerPreset(name: string, preset: object | (() => void)): void;
    export function registerPresets(newPresets: {
        [key: string]: object | (() => void),
    }): void;

    export const availablePlugins: Record<string, object | (() => void)>;
    export const availablePresets: Record<string, object | (() => void)>;

    export function transformScriptTags(scriptTags?: HTMLCollection): void;

    export function disableScriptTags(): void;

    export function parse(input: string, options?: ParserOptions): ParseResult<types.File>;

    export as namespace babel;
}