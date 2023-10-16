import { WorldGraphFactory, ExternalFileCacheFactory, WorldGraphRemoteFactory, GraphEntrance, GraphLocation, GraphPlugin } from "../src/WorldGraph";
import { describe, expect, test, beforeAll } from "@jest/globals";
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'path';

describe('OOTR 7.1.143 graph initialization', () => {
    test('empty graph creation', async () => {
        expect(() => WorldGraphFactory('ootr', {}, '7.1.143', {files: {}})).not.toThrow();
    });
});
