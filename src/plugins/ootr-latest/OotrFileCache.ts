import OotrVersion from './OotrVersion.js';
import ExternalFileCache from '../ExternalFileCache.js';

class OotrFileCache extends ExternalFileCache {
    static async load_ootr_files(version: string, { local_files = null, local_url = null }: { local_files?: string | null, local_url?: string | null } = {} ) {
        let ootr_version = new OotrVersion(version);

        let file_list = ootr_version.get_file_list();
        let _cache;
        if (!!local_files) {
            _cache = await ExternalFileCache.load_files(file_list, ootr_version.local_folder(), {local_folder: local_files});
        } else {
            if (!!local_url) {
                _cache = await ExternalFileCache.load_files(file_list, ootr_version.local_folder(), {remote_url: local_url});
            } else {
                _cache = await ExternalFileCache.load_files(file_list, '', {remote_url: ootr_version.github_url()});
            }
        }
        return new OotrFileCache(_cache.files);
    }
}

export default OotrFileCache;