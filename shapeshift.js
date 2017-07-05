const axios = require("axios");
const _     = require("lodash");

const units = require("./units.json");

const baseURL = "https://shapeshift.io/txStat/";

module.exports = BaseAccount =>
    class ShapeshiftAccount extends BaseAccount {

        async getOwn() {
            const {data, status, error} =
                      await axios(baseURL + this.address);

            if (status === "error" || error !== undefined) {
                throw new Error(error)
            }

            const {incomingType, address, incomingCoin, withdraw, outgoingType, outgoingCoin} = data;
            // TODO: txn.(from|to)Value doesn't seem to line up with shapeShiftresult.incomingCoin

            const mine = [{
                time     : this.time,
                from     : address,
                fromType : incomingType,
                fromValue: parseFloat(incomingCoin) * units[incomingType],
                to       : withdraw,
                toType   : outgoingType,
                toValue  : parseFloat(outgoingCoin) * units[outgoingType],
            }];

            return {
                own     : mine,
                toExpand: mine
            }
        }
    }
