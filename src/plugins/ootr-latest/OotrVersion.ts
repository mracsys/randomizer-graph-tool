import semver from 'semver';
import { GameVersion } from '../GraphPlugin.js';

type VersionCommitMap = {
    [version: string]: string;
}

class OotrVersion implements GameVersion {
    public version: string;
    public major: number;
    public minor: number;
    public patch: number;
    public branch: string;
    public supp: number;
    public is_release_tag: boolean;
    public file_list: string[];

    // Main branch uses consistent tags, no need for commit IDs
    // Note that stable builds prefix versions with a "v", such as v8.1
    // Dev builds on main branch do not have a prefix.

    static devr_version_commit_ids: VersionCommitMap = {
        '7.1.195 R-1': '9cb2614c2dc880e163c684c9f2f06695bafed647',
        '7.1.154 R-1': 'c5af1e9df2dd280b70b25f02d80d13dce9680d58',
        '7.1.143 R-1': '06390ece7e38fce1dd02ca60a28a7b1ff9fceb10',
    }
    static devrob_version_commit_ids: VersionCommitMap = {
        '7.1.198 Rob-49': 'd3fcfa72c833a2e6fb2dffcab3461394aa6765c8',
        '8.1.29 Rob-104': '2f40c346f4053b5d66732b0f2e407e4b8dc33f6e',
    }
    static devfenhl_version_commit_ids: VersionCommitMap = {
        '8.1.45 Fenhl-3': '1f36c6b7f37951e515b94e65cbddc8cd45c3ab13',
    }
    constructor(ootr_version: string, generate_files: boolean = true) {
        this.version = ootr_version;
        const versions = ootr_version.split(' ');
        this.is_release_tag = false;
        if (versions[0][0] === 'v') {
            versions[0] = versions[0].replace('v', '');
            this.is_release_tag = true;
        }
        const main_versions = versions[0].split('.');
        this.major = parseInt(main_versions[0]);
        this.minor = parseInt(main_versions[1]);
        this.patch = !!parseInt(main_versions[2]) ? parseInt(main_versions[2]) : 0;
        if (versions.length > 1) {
            if (!(['f.LUM', 'Stable', 'Dev', 'Release'].includes(versions[1]))) {
                const branch_versions = versions[1].split('-');
                this.branch = branch_versions[0];
                this.supp = parseInt(branch_versions[1]);
            } else if (versions[1] === 'Stable' || versions[1] === 'Release') {
                this.branch = versions[1];
                this.supp = 0;
                this.is_release_tag = true;
            } else {
                this.branch = versions[1];
                this.supp = 0;
                this.is_release_tag = true;
            }
        } else {
            this.branch = '';
            this.supp = 0;
        }
        if (generate_files) {
            this.file_list = this.get_file_list();
        } else {
            this.file_list = [];
        }
    }

    gte(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp >= branchVersion.supp;
        } else {
            return semver.gt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    gt(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp > branchVersion.supp;
        } else {
            return semver.gt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    lte(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp <= branchVersion.supp;
        } else {
            return semver.lt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    lt(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp < branchVersion.supp;
        } else {
            return semver.lt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    eq(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        return (semver.eq(this.to_string(true), branchVersion.to_string(true)) && this.supp === branchVersion.supp);
    }

    to_string(semverStr: boolean = false): string {
        if (this.branch !== '' && !semverStr && !this.is_release_tag) {
            return `${this.major}.${this.minor}.${this.patch} ${this.branch}-${this.supp}`;
        } else if (this.is_release_tag && !semverStr) {
            return `${this.major}.${this.minor}.${this.patch} ${this.branch}`;
        } else {
            return `${this.major}.${this.minor}.${this.patch}`;
        }
    }

    to_url_string(): string {
        if (this.branch !== '' && !this.is_release_tag) {
            return `${this.major}.${this.minor}.${this.patch} ${this.branch}-${this.supp}`;
        } else {
            return `${this.major}.${this.minor}.${this.patch}`;
        }
    }

    github_url(): string {
        switch(this.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
                return `https://raw.githubusercontent.com/OoTRandomizer/OoT-Randomizer/${this.to_url_string()}`;
            case 'R':
                return `https://raw.githubusercontent.com/Roman971/OoT-Randomizer/${OotrVersion.devr_version_commit_ids[this.to_url_string()]}`;
            case 'Rob':
                return `https://raw.githubusercontent.com/rrealmuto/OoT-Randomizer/${OotrVersion.devrob_version_commit_ids[this.to_url_string()]}`;
            case 'Fenhl':
                return `https://raw.githubusercontent.com/fenhl/OoT-Randomizer/${OotrVersion.devfenhl_version_commit_ids[this.to_url_string()]}`;
            default:
                throw(`Unsupported branch for remote file retrieval: ${this.to_url_string()}`);
        }
    }

    local_folder(): string {
        switch(this.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
                if (this.gte('7.1.143')) {
                    return './ootr-local-143';
                } else {
                    throw(`Unsupported version for local file retrieval (minimum 7.1.143 f.LUM): ${this.to_string()}`);
                }
                break;
            case 'R':
                if (this.gte('7.1.143 R-1')) {
                    return './ootr-local-roman-143';
                } else {
                    throw(`Unsupported version for local file retrieval (minimum 7.1.143 R-1): ${this.to_string()}`);
                }
                break;
            case 'Rob':
                if (this.gte('7.1.198 Rob-49')) {
                    return './ootr-local-realrob-198';
                } else {
                    throw(`Unsupported version for local file retrieval (minimum 7.1.198 Rob-49): ${this.to_string()}`);
                }
                break;
            case 'Fenhl':
                if (this.gte('8.1.45 Fenhl-3')) {
                    return './ootr-local-fenhl-8-1-45-3';
                } else {
                    throw(`Unsupported version for local file retrieval (minimum 8.1.45 Fenhl-3): ${this.to_string()}`);
                }
                break;
            default:
                throw(`Unsupported branch for local file retrieval (supported: f.LUM, Rob, R, Fenhl): ${this.to_string()}`);
                break;
        }
    }

    get_file_list(): string[] {
        let file_list = [
            'LocationList.py',
            'EntranceShuffle.py',
            'ItemList.py',
            'data/settings_mapping.json',
            'data/presets_default.json',
            'data/LogicHelpers.json',
            'data/World/Bosses.json',
            'data/World/Overworld.json',
            'data/World/Bottom of the Well.json',
            'data/World/Deku Tree.json',
            'data/World/Dodongos Cavern.json',
            'data/World/Fire Temple.json',
            'data/World/Forest Temple.json',
            'data/World/Ganons Castle.json',
            'data/World/Gerudo Training Ground.json',
            'data/World/Ice Cavern.json',
            'data/World/Jabu Jabus Belly.json',
            'data/World/Shadow Temple.json',
            'data/World/Spirit Temple.json',
            'data/World/Water Temple.json',
            'data/World/Bottom of the Well MQ.json',
            'data/World/Deku Tree MQ.json',
            'data/World/Dodongos Cavern MQ.json',
            'data/World/Fire Temple MQ.json',
            'data/World/Forest Temple MQ.json',
            'data/World/Ganons Castle MQ.json',
            'data/World/Gerudo Training Ground MQ.json',
            'data/World/Ice Cavern MQ.json',
            'data/World/Jabu Jabus Belly MQ.json',
            'data/World/Shadow Temple MQ.json',
            'data/World/Spirit Temple MQ.json',
            'data/World/Water Temple MQ.json',
            'data/Glitched World/Bosses.json',
            'data/Glitched World/Overworld.json',
            'data/Glitched World/Bottom of the Well.json',
            'data/Glitched World/Deku Tree.json',
            'data/Glitched World/Dodongos Cavern.json',
            'data/Glitched World/Fire Temple.json',
            'data/Glitched World/Forest Temple.json',
            'data/Glitched World/Ganons Castle.json',
            'data/Glitched World/Gerudo Training Ground.json',
            'data/Glitched World/Ice Cavern.json',
            'data/Glitched World/Jabu Jabus Belly.json',
            'data/Glitched World/Shadow Temple.json',
            'data/Glitched World/Spirit Temple.json',
            'data/Glitched World/Water Temple.json',
            'data/Glitched World/Bottom of the Well MQ.json',
            'data/Glitched World/Deku Tree MQ.json',
            'data/Glitched World/Dodongos Cavern MQ.json',
            'data/Glitched World/Fire Temple MQ.json',
            'data/Glitched World/Forest Temple MQ.json',
            'data/Glitched World/Ganons Castle MQ.json',
            'data/Glitched World/Gerudo Training Ground MQ.json',
            'data/Glitched World/Ice Cavern MQ.json',
            'data/Glitched World/Jabu Jabus Belly MQ.json',
            'data/Glitched World/Shadow Temple MQ.json',
            'data/Glitched World/Spirit Temple MQ.json',
            'data/Glitched World/Water Temple MQ.json',
        ];
        switch(this.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
                if (this.gte('7.1.143')) {
                    file_list.push('SettingsListTricks.py');
                } else {
                    throw('OOTR versions prior to 7.1.143 not implemented');
                }
                file_list.push('SettingsList.py');
                break;
            case 'R':
                if (this.gte('7.1.143 R-1')) {
                    file_list.push('SettingsListTricks.py');
                } else {
                    throw('OOTR versions prior to 7.1.143 R-1 not implemented');
                }
                file_list.push('SettingsList.py');
                break;
            case 'Rob':
                if (this.gte('7.1.198 Rob-49')) {
                    file_list.push('SettingsListTricks.py');
                } else {
                    throw('OOTR versions prior to 7.1.198 Rob-49 not implemented');
                }
                file_list.push('SettingsList.py');
                break;
            case 'Fenhl':
                if (this.gte('8.1.45 Fenhl-3')) {
                    file_list.push('SettingsListTricks.py');
                } else {
                    throw('OOTR versions prior to 8.1.45 Fenhl-3 not implemented');
                }
                file_list.push('SettingsList.py');
                break;
            default:
                throw(`Unknown branch for version ${this.to_string()}`);
        }
        
        return file_list;
    }
}

export default OotrVersion;