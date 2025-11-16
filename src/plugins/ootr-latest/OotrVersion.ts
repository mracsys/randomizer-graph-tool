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

    static main_version_commit_ids: VersionCommitMap = {
        '8.1.0':  'd53f30f9a3b7f02cdad78f861843f2e0045656de',
        '8.1.51': '295db7e069b99db87ecbf8f20171ab34937e90b5',
        '8.2.0':  '56d08e8934d1617d3ecbd36891023bd160c2f015',
        '8.2.50': 'd28dd1bf6d6c4608ff7ed5304bc8a84472a8ea91',
        '8.3.0':  'fbd0ed2b882fcbd5bd5e26f9d905daa8234f7f93',
        '8.3.33': 'e2482abab8f9de3b32ab9723a7289aafe60b073c',
        '8.3.41': '0cf89d3a5b25c4d534b007ead176c8176c798258',
        '8.3.56': 'e2482abab8f9de3b32ab9723a7289aafe60b073c',
    }

    static devr_version_commit_ids: VersionCommitMap = {
        '7.1.143 R-1': '06390ece7e38fce1dd02ca60a28a7b1ff9fceb10',
        '7.1.154 R-1': 'c5af1e9df2dd280b70b25f02d80d13dce9680d58',
        '7.1.195 R-1': '9cb2614c2dc880e163c684c9f2f06695bafed647',
        '8.1.47 R-1':  '35b93e4c65757a62aeb4bb6151fb87d4324e896c',
    }
    static devrob_version_commit_ids: VersionCommitMap = {
        '7.1.198 Rob-49': 'd3fcfa72c833a2e6fb2dffcab3461394aa6765c8',
        '8.1.29 Rob-101': 'c342eb28bceb1bc4609a955b090a48e6c8632647',
        '8.1.29 Rob-104': '2f40c346f4053b5d66732b0f2e407e4b8dc33f6e',
        '8.1.81 Rob-117': '10c20567d10cf1a1f477f1c5752e170ec518338d',
        '8.2.46 Rob-124': '2530734b9102e5193d5cf2e40230b5043e15968c',
        '8.2.46 Rob-125': '09f17cc61ca3e267bc6777df2f46ce5bbd6715ea',
        '8.2.50 Rob-128': '2030053144ce99f3364244117db64ba9585a1513',
        '8.2.52 Rob-132': '464b5184646694ec422a7dfe2a757725d73a7e1b',
        '8.3.56 Rob-3':   'b95a13428661cae571bb228f264b93730d59faeb',
    }
    static devfenhl_version_commit_ids: VersionCommitMap = {
        '8.1.45 Fenhl-3': '1f36c6b7f37951e515b94e65cbddc8cd45c3ab13',
        '8.1.49 Fenhl-2': '0c181c423ed88d071b3e21798a229ecc403c8076',
        '8.1.51 Fenhl-1': '032f3a95acfed7f431fe6c5125aa44438ca6d6d0',
        '8.2.50 Fenhl-1': '9bb3f11bb4ae7f07b96f60c86243bbb1545b8995',
        '8.2.69 Fenhl-7': '6ea07c8b61e8ddb716faabc78822671dd1757e7f',
        '8.3.41 Fenhl-2': '7c6baf0f1afc1c7a4a272a40b4b7d1ee663cff92',
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

    static get_supported_versions(): string[] {
        let versions: string[] = [];
        for (let version of Object.keys(OotrVersion.main_version_commit_ids)) {
            if (version.endsWith('.0')) {
                versions.push(`${version} Release`);
            } else {
                versions.push(`${version} Dev`);
                versions.push(`${version} f.LUM`);
            }
        }
        versions.push(...Object.keys(this.devr_version_commit_ids));
        versions.push(...Object.keys(this.devrob_version_commit_ids));
        versions.push(...Object.keys(this.devfenhl_version_commit_ids));
        return versions;
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
                return `ootr-local-${this.major}-${this.minor}-${this.patch}-${this.supp}`;
            case 'Dev':
            case 'f.LUM':
                return `ootr-local-Dev-${this.major}-${this.minor}-${this.patch}-${this.supp}`;
            case 'Stable':
            case 'Release':
                return `ootr-local-Release-${this.major}-${this.minor}-${this.patch}-${this.supp}`;
            case 'R':
            case 'Rob':
            case 'Fenhl':
            default:
                return `ootr-local-${this.branch}-${this.major}-${this.minor}-${this.patch}-${this.supp}`;
        }
    }

    github_repo(): string {
        switch(this.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
                return `https://github.com/OoTRandomizer/OoT-Randomizer.git`;
            case 'R':
                return `https://github.com/Roman971/OoT-Randomizer.git`;
            case 'Rob':
                return `https://github.com/rrealmuto/OoT-Randomizer.git`;
            case 'Fenhl':
                return `https://github.com/fenhl/OoT-Randomizer.git`;
            default:
                throw(`Unsupported branch for remote file retrieval: ${this.to_url_string()}`);
        }
    }

    commit_hash(): string {
        switch(this.branch) {
            case '':
            case 'Dev':
            case 'f.LUM':
            case 'Stable':
            case 'Release':
                return `${OotrVersion.main_version_commit_ids[this.to_url_string()]}`;
            case 'R':
                return `${OotrVersion.devr_version_commit_ids[this.to_url_string()]}`;
            case 'Rob':
                return `${OotrVersion.devrob_version_commit_ids[this.to_url_string()]}`;
            case 'Fenhl':
                return `${OotrVersion.devfenhl_version_commit_ids[this.to_url_string()]}`;
            default:
                throw(`Unsupported branch for remote file retrieval: ${this.to_url_string()}`);
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