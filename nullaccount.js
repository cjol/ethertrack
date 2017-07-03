module.exports = class Account {
    constructor(address) {
        this.address = address;
    }

    matches(otherAddress) {
        return this.address.toLowerCase() === otherAddress.toLowerCase()
    }

    async getTxns() {
        return Promise.resolve([]);
    }
};
