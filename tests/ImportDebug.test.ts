import { describe, expect, test } from "@jest/globals";

// to get dynamic imports of node internal modules to work with jest required the following:
// add this to jest.config.cjs:
// - extensionsToTreatAsEsm: ['.ts']
// run jest using the following (copy/paste into scripts/test in package.json):
// - yarn node --experimental-vm-modules $(yarn bin jest)


describe('jest debugging', () => {
    test('dynamic node imports', async () => {
        const fs = await import('fs');
        const readFileSync = fs.readFileSync;
        const path = await import('path');
        const resolve = path.resolve;
        expect(() => readFileSync(resolve('tests/ootr-local-143', 'EntranceShuffle.py'), { encoding: 'utf8'})).not.toThrowError();
        expect(() => readFileSync(resolve('tests/ootr-local-143', 'EntranceShuffle2.py'), { encoding: 'utf8'})).toThrowError();
    });
});
