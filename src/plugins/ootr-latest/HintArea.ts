import { Region } from "./Region.js";
import Entrance from './Entrance.js';
import { Location } from "./Location.js";

type Spot = Entrance | Location | Region;

class HintArea {
    static at(spot: Spot, use_alt_hint: boolean = false) {
        let original_parent: Region;
        if (spot instanceof Region) {
            original_parent = spot;
        } else {
            if (!!(spot.parent_region)) {
                original_parent = spot.parent_region;
            } else {
                throw(`Null parent region found when searching hint region for spot ${spot.name}`);
            }
        }
        let already_checked: Array<Spot> = [];
        let spot_queue: Array<Spot> = [spot];
        let fallback_spot_queue: Array<Spot> = [];
        let current_spot: Spot | undefined, parent_region: Region;

        while(spot_queue.length > 0 || fallback_spot_queue.length > 0) {
            if (spot_queue.length <= 0) {
                spot_queue = fallback_spot_queue;
                fallback_spot_queue = [];
            }
            current_spot = spot_queue.pop();
            if (!!current_spot) {
                already_checked.push(current_spot);

                if (current_spot instanceof Region) {
                    parent_region = current_spot;
                } else {
                    if (!!(current_spot.parent_region)) {
                        parent_region = current_spot.parent_region;
                    } else {
                        throw(`Null parent region found when searching hint region for spot ${spot.name}`);
                    }
                }

                if (parent_region.hint() && (original_parent.name === 'Root' || parent_region.name !== 'Root')) {
                    if (use_alt_hint && parent_region.alt_hint()) {
                        return parent_region.alt_hint();
                    }
                    return parent_region.hint();
                }

                for (const entrance of parent_region.entrances) {
                    if (!(already_checked.includes(entrance))) {
                        if (!!(entrance.type) && ['OverworldOneWay', 'OwlDrop', 'Spawn', 'WarpSong'].includes(entrance.type)) {
                            fallback_spot_queue.push(entrance);
                        } else {
                            spot_queue.push(entrance);
                        }
                    }
                }
            }
        }
        if (!!(spot.world)) {
            throw(`No hint area found for ${spot.name} [World ${spot.world.id}]`);
        } else {
            throw(`No hint area found for ${spot.name}`);
        }
    }
}

export default HintArea;