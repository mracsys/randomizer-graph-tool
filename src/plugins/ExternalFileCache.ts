//import { readFile } from 'node:fs/promises';
//import { resolve } from 'path';

class ExternalFileCache {
    constructor(public files: {[filename: string]: string} = {}) {}

    static async load_files(file_list: string[], { remote_url = '', local_folder = '' }: {remote_url?: string, local_folder?: string} = {}) {
        let files: {[filename: string]: string} = {};
        for (let f of file_list) {
            try {
                if (local_folder !== '') {
                    // assumes cwd is root of project!!
                    //files[f] = await readFile(resolve(local_folder, f), { encoding: 'utf8'});
                } else {
                    //console.log(`downloading ${f}`);
                    let response = await fetch(`${remote_url}/${f}`);
                    files[f] = await response.text();
                    //console.log(`finished downloading ${f}`);
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

        return new ExternalFileCache(files);
    }
}

export default ExternalFileCache;