const axios = require("axios");
const _     = require("lodash");

const {etherAPIKey}     = require("./config.json");
const baseURL           = "https://api.etherscan.io/api";
const shapeshiftAddress = "0x70faa28a6b8d6829a4b1e649d26ec9a2a39ba413";

module.exports = BaseAccount =>
    class EthAccount extends BaseAccount {

        getBalance() {
            return makeAPICall({
                module : "account",
                action : "balance",
                address: this.address
            });
        }

        async getOwn() {
            const rawTxns = await makeAPICall({
                module    : "account",
                action    : "txlist",
                startBlock: 0,
                endBlock  : 99999999,
                address   : this.address
            });

            const outgoing = rawTxns.filter(t => this.matches(t.from));
            const toExpand = [];

            const own = _.flatMap(outgoing, txn => {
                const d = new Date();
                d.setTime(parseInt(txn.timeStamp) * 1000);

                const gasCost = parseInt(txn.gas) * parseInt(txn.gasPrice);

                const base  = {
                          time    : d,
                          from    : this.address,
                          fromType: "ETH",
                          toType  : "ETH",
                      },
                      gas   = Object.assign({}, base, {
                          fromValue: gasCost,
                          to       : "0x0000000000000000000000000000000000000000",
                          toValue  : gasCost,
                      }),
                      newTx = Object.assign({}, base, {
                          fromValue: parseInt(txn.value), // - gasCost,
                          to       : txn.to,
                          toValue  : parseInt(txn.value) - gasCost,
                      });

                if (txn.to === shapeshiftAddress) {
                    // we should expand shapeshift multiple times
                    toExpand.push({to: txn.to, toType: "SSD", from: this.address});
                } else {
                    // but only expand an ETH address once
                    if (!toExpand.some(e => e.address === txn.to)) {
                        toExpand.push({to: txn.to, toType: "ETH", from: this.address});
                    }
                }

                return [newTx, gas]
            });

            return {own, toExpand};
        }
    };

async function makeAPICall(params) {
    const {data} = await axios.get(baseURL, {
        params: Object.assign({}, params, {etherAPIKey})
    });

    if (data.status === "1" && data.message === 'OK')
        return data.result;

    throw Error("API Error: " + data.message)
}
