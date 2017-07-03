const axios       = require("axios");
const _           = require("lodash");
const weiPerEther = 1000000000000000000;

const {etherAPIKey}     = require("./config.json");
const baseURL           = "https://api.etherscan.io/api";
const shapeshiftAddress = "0x70faa28a6b8d6829a4b1e649d26ec9a2a39ba413";

const NullAccount       = require("./nullaccount");
const ShapeshiftAccount = require("./shapeshift");

module.exports = class EthAccount {

    constructor(address) {
        this.address = address;
    }

    matches(otherAddress) {
        return this.address.toLowerCase() === otherAddress.toLowerCase()
    }

    getBalance() {
        return makeAPICall({
            module : "account",
            action : "balance",
            address: this.address
        });
    }

    async getTxns(depth = 1, dontExpand = []) {

        if (dontExpand.indexOf(this.address.toLowerCase()) >= 0 || depth < 0) {
            return [];
        }

        const rawTxns = await makeAPICall({
            module    : "account",
            action    : "txlist",
            startBlock: 0,
            endBlock  : 99999999,
            address   : this.address
        });

        const incoming = rawTxns.filter(t => this.matches(t.to));
        const outgoing = rawTxns.filter(t => this.matches(t.from));
        const toExpand = [];

        const mine = _.flatMap(outgoing, txn => {
            const d = new Date();
            d.setTime(parseInt(txn.timeStamp) * 1000);

            const gasCost = parseInt(txn.gas) * parseInt(txn.gasPrice);

            // log the gas
            const gas   = {
                time     : d,
                from     : this.address,
                fromType : "ETH",
                fromValue: gasCost,
                to       : "0x0000000000000000000000000000000000000000",
                toType   : "ETH",
                toValue  : gasCost,
            };
            const newTx = {
                time     : d,
                from     : this.address,
                fromType : "ETH",
                fromValue: parseInt(txn.value), // - gasCost,
                to       : txn.to,
                toType   : "ETH",
                toValue  : parseInt(txn.value) - gasCost,
            };

            if (txn.to === shapeshiftAddress) {
                // we should expand shapeshift multiple times
                toExpand.push({address: txn.to, type: "SSD", txn: newTx});
            } else {
                // but only expand an ETH address once
                if (!toExpand.some(e => e.address === txn.to)) {
                    toExpand.push({address: txn.to, type: "ETH", txn: newTx});
                }
            }

            return [newTx, gas]
        });

        let recs = [];
        for (let e of toExpand) {
            const {address, type, txn} = e;
            let a;
            switch (type) {
                case "ETH":
                    a = new EthAccount(address);
                    break;
                case "BTC":
                    a = new NullAccount(address);
                    break;
                case "SSD":
                    a = new ShapeshiftAccount(txn.from.toLowerCase(), txn.time);
                    break;
                default:
                    throw new Error("Couldn't handle ", type);
            }
            // TODO: this await  is  blocking the other  loop iterations
            recs = recs.concat(await a.getTxns(depth - 1, dontExpand));
        }

        return mine.concat(recs);
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
