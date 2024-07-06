//import { readFileSync } from 'node:fs';
//import { resolve } from 'path';

class ExternalFileCache {
    constructor(
        public files: {[filename: string]: string} = {},
        public subfolder: string = '',
    ) {}

    static async load_files(file_list: string[], subfolder: string = '', { remote_url = null, local_folder = null }: {remote_url?: string | null, local_folder?: string | null} = {}) {
        let files: {[filename: string]: string} = {};
        for (let f of file_list) {
            try {
                if (local_folder !== null) {
                    // Dynamic import breaks in some environments.
                    // Delete the next two lines and uncomment the
                    // imports at the start of this file if you have
                    // issues.
                    // The dynamic imports themselves are a hack to
                    // make Next.js ignore them when compiling...
                    const readFileSync = (await import('fs')).readFileSync;
                    const resolve = (await import('path')).resolve;
                    // assumes cwd is root of project!!
                    files[f] = readFileSync(resolve(local_folder, f), { encoding: 'utf8'});
                } else if (remote_url !== null) {
                    let url_prefix = remote_url;
                    if (remote_url.endsWith('/')) {
                        url_prefix = url_prefix.slice(0, url_prefix.length - 1);
                    }
                    let response: Response;
                    let fetch_url: string;
                    if (subfolder !== '') {
                        fetch_url = `${url_prefix}/${subfolder}/${f}`;
                        console.log(`Fetching ${fetch_url}`);
                        response = await fetch(fetch_url);
                    } else {
                        fetch_url = `${url_prefix}/${f}`;
                        console.log(`Fetching ${fetch_url}`);
                        response = await fetch(fetch_url);
                    }
                    files[f] = await response.text();
                    if (files[f] === undefined) throw `Could not fetch file ${f} from ${fetch_url}`;
                } else {
                    throw `Could not load external files: no external source specified (remote_url and local_folder are both null)`;
                }
            } catch (err) {
                let message;
                if (err instanceof Error) {
                    message = err.message;
                } else {
                    message = String(err);
                }
                console.error(message);
            }
        }

        return new ExternalFileCache(files, subfolder);
    }
}

export default ExternalFileCache;