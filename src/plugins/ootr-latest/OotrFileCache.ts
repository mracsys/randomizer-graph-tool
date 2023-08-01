import OotrVersion from './OotrVersion.js';
import ExternalFileCache from '../ExternalFileCache.js';

class OotrFileCache extends ExternalFileCache {
    static async load_ootr_files(version: string, local_files: boolean = false) {
        let ootr_version = new OotrVersion(version);

        let file_list = ootr_version.get_file_list();
        let _cache;
        if (local_files) {
            _cache = await ExternalFileCache.load_files(file_list, {local_folder: ootr_version.local_folder()});
        } else {
            _cache = await ExternalFileCache.load_files(file_list, {remote_url: ootr_version.github_url()});
        }
        return new OotrFileCache(_cache.files);
    }
}

export default OotrFileCache;