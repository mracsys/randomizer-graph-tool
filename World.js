const Location = require("./Location.js");

class World {
    constructor() {
        this.settings = {};
        this.event_items = new Set();
        this.triforce_hunt = false;
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

    push_item(location, item, manual=false) {
        if (!(location instanceof Location)) {
            // get_location
        }

        location.item = item;
        item.location = location;
        item.price = location.price !== null ? location.price : item.price;
        location.price = item.price;
    }
}

module.exports = World;