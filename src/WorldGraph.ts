import ExternalFileCache from "./plugins/ExternalFileCache.js";
import OotrFileCache from "./plugins/ootr-latest/OotrFileCache.js";
import OotrVersion from "./plugins/ootr-latest/OotrVersion.js";
import {
    GraphPlugin,
    GameVersion,
    GraphGameVersions,
    GraphSetting,
    GraphSettingType,
    GraphSettingsConfiguration,
    GraphSettingsOptions,
    GraphSettingsLayout,
    GraphWorld,
    GraphRegion,
    GraphEntrance,
    GraphEntrancePool,
    GraphLocation,
    GraphItem,
    GraphItemDictionary,
    GraphHint,
    GraphHintGoal,
    GraphBoulder,
} from "./plugins/GraphPlugin.js";
import EmptyGraphPlugin from "./plugins/EmptyGraphPlugin.js";
import OotrGraphPlugin from './plugins/ootr-latest/OotrGraphPlugin.js';

// Creates a new world graph.
// If a file cache is not provided, files are automatically
// fetched from remote URLs as needed.
async function WorldGraphRemoteFactory(
        game: string = 'ootr',
        user_overrides: any = null,
        version: string = '7.1.143',
        global_cache: ExternalFileCache | null = null,
        debug: boolean = false
    ): Promise<GraphPlugin> {
        switch(game) {
            case 'empty':
                return new EmptyGraphPlugin();
            case 'ootr':
                return await OotrGraphPlugin.create_remote_graph(user_overrides, version, global_cache, debug);
            default:
                throw `Unimplemented game ${game}`;
        }
}

async function ExternalFileCacheFactory(
    game: string = 'ootr',
    version: string = '7.1.143',
    {
        local_files = null,
        local_url = null,
    }: {
        local_files?: string | null,
        local_url?: string | null,
    } = {}
): Promise<ExternalFileCache> {
    switch(game) {
        case 'ootr':
            return await OotrFileCache.load_ootr_files(version, { local_files: local_files, local_url: local_url });
        default:
            throw `Unimplemented game ${game}`;
    }
}

function ExternalFileCacheList(
    game: string = 'ootr',
    version: string = '7.1.143',
): string[] {
    switch(game) {
        case 'ootr':
            let ootr_version = new OotrVersion(version);
            let file_list = ootr_version.get_file_list();
            return file_list;
        default:
            throw `Unimplemented game ${game}`;
    }
}

// Creates a new world graph.
// If a file cache is not provided, a stub graph object
// is created. This is to work around React's inability
// to memoize async calls. Use in combination with the
// ExternalFileCacheFactory, which returns a serializable
// object for storage in React state, to update the stub
// to a full graph via useMemo.
function WorldGraphFactory(
        game: string = 'ootr',
        user_overrides: any = null,
        version: string = '7.1.143',
        global_cache: ExternalFileCache = { files: {}, subfolder: '' },
        debug: boolean = false
    ): GraphPlugin {
        switch(game) {
            case 'empty':
                return new EmptyGraphPlugin();
            case 'ootr':
                return OotrGraphPlugin.create_graph(user_overrides, version, global_cache, debug);
            default:
                throw `Unimplemented game ${game}`;
        }
}

export default WorldGraphRemoteFactory;
export {
    WorldGraphRemoteFactory,
    WorldGraphFactory,
    ExternalFileCacheFactory,
    ExternalFileCacheList,
    GraphPlugin,
    ExternalFileCache,
    GameVersion,
    GraphGameVersions,
    GraphSetting,
    GraphSettingType,
    GraphSettingsConfiguration,
    GraphSettingsOptions,
    GraphSettingsLayout,
    GraphWorld,
    GraphRegion,
    GraphEntrance,
    GraphEntrancePool,
    GraphLocation,
    GraphItem,
    GraphItemDictionary,
    GraphHint,
    GraphHintGoal,
    GraphBoulder,
};