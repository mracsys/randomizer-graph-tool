import { ExternalFileCacheFactory, ExternalFileCacheList, WorldGraphFactory } from "../WorldGraph.js";
import { writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname } from 'path';


const downloadFiles = async () => {
    const serverRoot = process.env.GITONLY !== undefined ? '../tootr/public/' : '/srv/www/tootr/';
    console.log(`Using server root ${serverRoot}`);
    let currentFolders = readdirSync(serverRoot, {withFileTypes: true}).filter(d => d.isDirectory() && d.name.includes('ootr-local-')).map(d => d.name);
    console.log(`Versions already cached: ${currentFolders}`);
    let ootr = WorldGraphFactory('ootr');
    let ootrSupportedVersions = ootr.get_game_versions();
    for (let ootrVersion of ootrSupportedVersions.versions) {
        let gameVersion = ootrVersion.version;
        let folderName = ootrVersion.local_folder();
        // skip branches that were already downloaded
        if (currentFolders.includes(folderName)) {
            console.log(`Skipping already downloaded branch ${folderName}`);
            continue;
        }
        console.log(`Saving files for ${gameVersion} to ${folderName}`);
        // attempt to download new files
        let graphFiles = ExternalFileCacheList('ootr', gameVersion);
        let graphFileCache = await ExternalFileCacheFactory('ootr', gameVersion, {});
        // validate before writing to disk
        for (let f of graphFiles) {
            if (graphFileCache.files[f] === undefined) {
                throw `Could not download file ${f} for branch ${gameVersion}`;
            }
        }
        // save branch
        for (let [fileName, fileContent] of Object.entries(graphFileCache.files)) {
            if (fileName.split('/').length > 1) {
                mkdirSync(resolve(`${serverRoot}${folderName}`, dirname(fileName)), { recursive: true });
            } else {
                mkdirSync(resolve(`${serverRoot}${folderName}`), { recursive: true });
            }
            writeFileSync(resolve(`${serverRoot}${folderName}`, fileName), fileContent);
        }
    }
}

await downloadFiles();
