/**
 * Created by cjol on 03/07/17.
 */

function BaseAccount(address, time) {
    this.address = address;
    this.time    = time;
}

// TODO: maybe a problem with circular dependencies?
const EthAccount        = require("./ethereum")(BaseAccount);
const BitcoinAccount    = require("./nullaccount")(BaseAccount);
const ShapeshiftAccount = require("./shapeshift")(BaseAccount);

module.exports = BaseAccount;

BaseAccount.make = function (type, ...params) {
    switch (type) {
        case "ETH":
            return new EthAccount(...params);
        case "SSD":
            return new ShapeshiftAccount(...params);
        case "BTC":
            return new BitcoinAccount(...params);
    }
};

BaseAccount.prototype.matches = function (otherAddress) {
    return this.address.toLowerCase() === otherAddress.toLowerCase()
};

BaseAccount.prototype.getOwn = async function () {
    return Promise.resolve({
        own: [], toExpand: []
    });
};

BaseAccount.prototype.getTxns = async function (depth = 2, dontExpand = []) {

    if (dontExpand.indexOf(this.address.toLowerCase()) >= 0 || depth < 0) {
        return [];
    }

    const {toExpand, own} = await this.getOwn();

    let recs = [];
    for (let {from, to, toType} of toExpand) {
        let a;
        switch (toType) {
            case "ETH":
                a = new EthAccount(to);
                break;
            case "BTC":
                a = new BitcoinAccount(to);
                break;
            case "SSD":
                // TODO: not conivinced using from as the address will *always* work
                a = new ShapeshiftAccount(from, this.time);
                break;
            default:
                throw new Error("Couldn't handle ", toType);
        }

        // TODO: this await  is  blocking the other  loop iterations
        recs = recs.concat(await a.getTxns(depth - 1, dontExpand));
    }

    return own.concat(recs);
};
