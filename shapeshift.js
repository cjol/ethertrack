const axios = require("axios");
const _     = require("lodash");

const EthAccount = require("./ethereum");
const NullAccount = require("./nullaccount");

// TODO: refactor this into a separate shareable filte
const units = {
    "ETH": 1000000000000000000,
    "BTC": 100000000
};

// https://shapeshift.io/txStat/0x5ddd770954e06bcab4afdaa64567e29842900dd4

const baseURL = "https://shapeshift.io/txStat/";


module.exports = class ShapeshiftAccount {

    constructor(address, time) {
        this.address = address;
        this.time = time;
    }

    matches(otherAddress) {
        return this.address.toLowerCase() === otherAddress.toLowerCase()
    }

    async getTxns(depth = 1, dontExpand = []) {

        if (dontExpand.indexOf(this.address.toLowerCase()) >= 0 || depth < 0) {
            return [];
        }

        const {data, status, error} =
                  await axios(baseURL + this.address);

        if (status === "error" || error !== undefined) {
            throw new Error(error)
        }

        const {incomingType, address, incomingCoin, transaction, outgoingType, outgoingCoin} = data;
        // TODO: txn.(from|to)Value doesn't seem to line up with shapeShiftresult.incomingCoin

        const mine = [{
            time     : this.time,
            from     : address,
            fromType : incomingType,
            fromValue: parseFloat(incomingCoin) * units[incomingType],
            to       : transaction,
            toType   : outgoingType,
            toValue  : parseFloat(outgoingCoin) * units[outgoingType],
        }];

        let recs = [];
        for (let {to, toType} of mine) {
            let a;
            switch (toType) {
                case "ETH":
                    a = new EthAccount(to);
                    break;
                case "BTC":
                    a = new NullAccount(to);
                    break;
                case "SSD":
                    a = new ShapeshiftAccount(to, this.time);
                    break;
                default:
                    throw new Error("Couldn't handle ", toType);
            }

            recs = recs.concat(await a.getTxns(depth - 1, dontExpand));
        }

        return mine.concat(recs);
    }
}
