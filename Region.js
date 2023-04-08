class TimeOfDay {
    constructor() {}

    NONE() { return 0; }
    DAY() { return 1; }
    DAMPE() { return 2; }
    ALL() { return this.DAY | this. DAMPE }
}

module.exports = TimeOfDay;