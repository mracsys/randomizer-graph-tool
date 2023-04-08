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

    collect(item) {
        (item in this.prog_items) ? this.prog_items[item] += 1 : this.prog_items[item] = 1;
    }

    remove(item) {
        (this.prog_items[item] > 1) ? this.prog_items[item] -= 1 : delete this.prog_items[item];
    }
}

module.exports = WorldState;