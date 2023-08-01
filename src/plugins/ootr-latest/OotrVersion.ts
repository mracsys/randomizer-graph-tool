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
    public file_list: string[];

    static devr_version_commit_ids: VersionCommitMap = {
        '7.1.154 R-1': 'c5af1e9df2dd280b70b25f02d80d13dce9680d58',
        '7.1.143 R-1': '06390ece7e38fce1dd02ca60a28a7b1ff9fceb10',
    }
    constructor(ootr_version: string, generate_files: boolean = true) {
        this.version = ootr_version;
        const versions = ootr_version.split(' ');
        const main_versions = versions[0].split('.');
        this.major = parseInt(main_versions[0]);
        this.minor = parseInt(main_versions[1]);
        this.patch = parseInt(main_versions[2]);
        if (versions.length > 1) {
            const branch_versions = versions[1].split('-');
            this.branch = branch_versions[0];
            this.supp = parseInt(branch_versions[1]);
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
        if (this.branch !== branchVersion.branch) {
            throw(`Invalid branch comparison: ${this.to_string()} to ${branchVersion.to_string()}`)
        }
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp >= branchVersion.supp;
        } else {
            return semver.gt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    gt(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (this.branch !== branchVersion.branch) {
            throw(`Invalid branch comparison: ${this.to_string()} to ${branchVersion.to_string()}`)
        }
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp > branchVersion.supp;
        } else {
            return semver.gt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    lte(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (this.branch !== branchVersion.branch) {
            throw(`Invalid branch comparison: ${this.to_string()} to ${branchVersion.to_string()}`)
        }
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp <= branchVersion.supp;
        } else {
            return semver.lt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    lt(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (this.branch !== branchVersion.branch) {
            throw(`Invalid branch comparison: ${this.to_string()} to ${branchVersion.to_string()}`)
        }
        if (semver.eq(this.to_string(true), branchVersion.to_string(true))) {
            return this.supp < branchVersion.supp;
        } else {
            return semver.lt(this.to_string(true), branchVersion.to_string(true));
        }
    }

    eq(version: string): boolean {
        let branchVersion = new OotrVersion(version, false);
        if (this.branch !== branchVersion.branch) {
            throw(`Invalid branch comparison: ${this.to_string()} to ${branchVersion.to_string()}`)
        }
        return (semver.eq(this.to_string(true), branchVersion.to_string(true)) && this.supp === branchVersion.supp);
    }

    to_string(semverStr: boolean = false): string {
        if (this.branch !== '' && !semverStr) {
            return `${this.major}.${this.minor}.${this.patch} ${this.branch}-${this.supp}`;
        } else {
            return `${this.major}.${this.minor}.${this.patch}`;
        }
    }

    github_url(): string {
        switch(this.branch) {
            case '':
                return `https://raw.githubusercontent.com/OoTRandomizer/OoT-Randomizer/${this.to_string()}`;
            case 'R':
                return `https://raw.githubusercontent.com/Roman971/OoT-Randomizer/${OotrVersion.devr_version_commit_ids[this.to_string()]}`;
            default:
                throw(`Unsupported branch for remote file retrieval: ${this.to_string()}`);
        }
    }

    local_folder(): string {
        if (this.gte('7.1.143')) {
            return './ootr-local-143';
        } else if (this.gt('7.1.117')) {
            return './ootr-local-117';
        } else {
            throw(`Unsupported branch for remote file retrieval: ${this.to_string()}`);
        }
    }

    get_file_list(): string[] {
        let file_list = [
            'LocationList.py',
            'EntranceShuffle.py',
            'ItemList.py',
            'data/settings_mapping.json',
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
                if (this.gte('7.1.143')) {
                    file_list.push('SettingsListTricks.py');
                } else if (this.lt('7.1.117')) {
                    throw('OOTR versions prior to 7.1.117 not implemented');
                }
                file_list.push('SettingsList.py');
                break;
            case 'R':
                if (this.gte('7.1.143 R-1')) {
                    file_list.push('SettingsListTricks.py');
                } else if (this.lt('7.1.117 R-1')) {
                    throw('OOTR versions prior to 7.1.117 R-1 not implemented');
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