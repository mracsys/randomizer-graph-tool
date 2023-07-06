const { Region } = require("./Region.js");

class HintArea {
    static at(spot, use_alt_hint=false) {
        let original_parent;
        if (spot instanceof Region) {
            original_parent = spot;
        } else {
            original_parent = spot.parent_region;
        }
        let already_checked = [];
        let spot_queue = [spot];
        let fallback_spot_queue = [];
        let current_spot, parent_region;

        while(spot_queue.length > 0 || fallback_spot_queue.length > 0) {
            if (spot_queue.length <= 0) {
                spot_queue = fallback_spot_queue;
                fallback_spot_queue = [];
            }
            current_spot = spot_queue.pop();
            already_checked.push(current_spot);

            if (current_spot instanceof Region) {
                parent_region = current_spot;
            } else {
                parent_region = current_spot.parent_region
            }

            if (parent_region.hint() && (original_parent.name === 'Root' || parent_region.name !== 'Root')) {
                if (use_alt_hint && parent_region.alt_hint()) {
                    return parent_region.alt_hint();
                }
                return parent_region.hint();
            }

            for (const entrance of parent_region.entrances) {
                if (!(already_checked.includes(entrance))) {
                    if (['OverworldOneWay', 'OwlDrop', 'Spawn', 'WarpSong'].includes(entrance.type)) {
                        fallback_spot_queue.push(entrance);
                    } else {
                        spot_queue.push(entrance);
                    }
                }
            }
        }

        throw(`No hint area found for ${spot.name} [World ${spot.world.id}]`);
    }
}

module.exports = {
    HintArea,
};