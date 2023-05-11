const TimeOfDay = require("./Region");

class WorldState {
    constructor(parent) {
        this.prog_items = {};
        this.world = parent;
        this.search = null;
        this._won = this.world.triforce_hunt ? this.won_triforce_hunt : this.won_normal;
    }

    won() {
        return this._won();
    }

    won_triforce_hunt() {
        return this.has('Triforce Piece', this.world.triforce_count);
    }

    won_normal() {
        return this.has('Triforce');
    }

    has(item, count=1) {
        return this.prog_items[item] >= count;
    }

    has_any_of(items) {
        items.foreach((item) => {
            if (item in this.prog_items) {
                if (this.prog_items[item] > 0) return true;
            }
        });
        return false;
    }

    has_all_of(items) {
        items.foreach((item) => {
            if (item in this.prog_items) {
                if (this.prog_items[item] <= 0) return false;
            } else {
                return false;
            }
        });
        return true;
    }

    item_count(item) {
        return this.prog_items[item];
    }

    has_hearts(count) {
        return this.heart_count() >= count;
    }

    heart_count() {
        return (~~(this.item_count('Piece of Heart') / 4) + 3);
    }

    can_reach(region, age = null, tod = TimeOfDay.NONE) {
        return age == 'child';
    }

    collect(item) {
        (item in this.prog_items) ? this.prog_items[item] += 1 : this.prog_items[item] = 1;
    }

    remove(item) {
        (this.prog_items[item] > 1) ? this.prog_items[item] -= 1 : delete this.prog_items[item];
    }
}

module.exports = WorldState;