module.exports = class Debug {
    init = (options) => {
        this.debug = options.debug;
    }
    console = (message) => {
        if (this.debug) {
            console.log(message);
        }
    }
};