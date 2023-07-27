import ExternalFileCache from "./plugins/ExternalFileCache.js";
import { GraphPlugin } from "./plugins/GraphPlugin.js";
import OotrGraphPlugin from './plugins/ootr-latest/OotrGraphPlugin.js';

async function WorldGraphFactory(
        game: string = 'ootr',
        user_overrides: any = null,
        version: string = '7.1.143',
        global_cache: ExternalFileCache | null = null,
        debug: boolean = false
    ): Promise<GraphPlugin> {
        switch(game) {
            case 'ootr':
                return await OotrGraphPlugin.create_graph(user_overrides, version, global_cache, debug);
            default:
                throw `Unimplemented game ${game}`;
        }
}

export default WorldGraphFactory;