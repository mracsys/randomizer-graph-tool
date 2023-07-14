class OotrVersion {
    constructor(ootr_version) {
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
    }

    greaterThanOrEqual(version) {
        if (this.branch !== version.branch) {
            throw(`Invalid branch comparison: ${this.toString()} to ${version.toString()}`)
        }

        return (this.major >= version.major && this.minor >= version.minor && this.patch >= version.patch);
    }

    greaterThanOrEqualBranch(version) {
        if (this.branch !== version.branch) {
            throw(`Invalid branch comparison: ${this.toString()} to ${version.toString()}`)
        }

        return (this.major >= version.major && this.minor >= version.minor && this.patch >= version.patch && this.supp >= version.supp);
    }

    toString() {
        return `${this.major}.${this.minor}.${this.patch} ${this.branch}-${this.supp}`;
    }
}

module.exports = OotrVersion;