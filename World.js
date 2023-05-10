class World {
    constructor() {
        this.triforce_hunt = false;
        this.settings = {};
        this.ensure_tod_access = true;
        this.logic_no_night_tokens_without_suns_song = false;
        this.skipped_trials = {
            'Forest': true,
            'Fire': false,
            'Water': false,
            'Shadow': false,
            'Spirit': false,
            'Light': false,
        }
        this.bridge = 'vanilla'
    }
}

module.exports = World;