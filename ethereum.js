const axios       = require("axios");
const _           = require("lodash");
const weiPerEther = 1000000000000000000;

module.exports = {
    getBalanceSheet,
    getTxns,
    getBalance
};

async function makeAPICall(params) {
    const etherAPIKey = "FRA76RN1BCQGJF8ISJPS82RYM4T1BPCAWH";
    const baseURL     = "https://api.etherscan.io/api";

    const {data} = await axios.get(baseURL, {
        params: Object.assign({}, params, {etherAPIKey})
    });
    return data
}

async function getBalance(address) {
    const data = await makeAPICall({
        module: "account",
        action: "balance",
        address
    });

    if (data.status === "1" && data.message === 'OK')
        return data.result;

    throw Error("API Error: " + data.message)
}

async function getRawTxns(addresses, startBlock = 0, endBlock = 99999999) {
    const txns = await Promise.all(addresses.map(async address => {
        const data = await makeAPICall({
            module: "account",
            action: "txlist",
            startBlock,
            endBlock,
            address
        });

        if (data.status === "1" && data.message === 'OK')
            return data.result;

        // TODO: aggregate if we have more than 10k transactions

        throw Error("API Error: " + data.message)
    }));

    return [].concat.apply([], txns);
}

async function getTxns(addressMap, startBlock, endBlock) {

    addressMap      = _.mapKeys(addressMap, (v, k) => k.toLowerCase());
    const addresses = _.chain(addressMap)
        .entries()
        .filter(([k, v]) => v === "me")
        .map(([k, v]) => k)
        .value();

    const txns = await getRawTxns(addresses, startBlock, endBlock);

    const expandedPromises = _.map(txns, async t => {
        const d = new Date();
        d.setTime(parseInt(t.timeStamp) * 1000);

        t.from = (t.from || "").toLowerCase();
        t.to   = (t.to || "").toLowerCase();

        if (addressMap[t.from] === "me") {
            return follow(t, addressMap, 3)
        } else {
            // money we receive (the fee has been paid)
            return [{
                time  : d,
                target: t.from,
                value : parseInt(t.value) / weiPerEther
            }];
        }
    });

    const t = await Promise.all(expandedPromises);

    return _.chain(t)
        .flatten()
        .groupBy('target')
        .mapValues(a => a.map(t => delete t['target'] && t))
        .mapKeys((v, k) => addressMap[k] || k)
        .value();

    // TODO: merge back together transactions at the same time to the same address
    // TODO (cont.): Relatedly, an immediate refunded transaction should be cancelled
}

// TODO: Follow transactions transitively (up to a certain depth) to see if we can match known addresses (e.g. Shapeshift)
async function follow(txn, addressMap, maxDepth = 3) {
    const d = new Date();
    d.setTime(parseInt(txn.timeStamp) * 1000);

    if (maxDepth >= 0) {

        if (!(txn.to in addressMap)) {
            // unknown destination. See if it's to an account with a single input
            const intermediary = txn.to.toLowerCase();
            const onwardsTxns  = await getRawTxns([intermediary]);
            const inwards      = onwardsTxns.filter(t => t.to.toLowerCase() === intermediary);
            const outwards     = onwardsTxns.filter(t => t.from.toLowerCase() === intermediary);

            if (inwards.length === 1) {
                // only one transaction went into this account - it must be the same as the one we just followed
                // separate it into the funds that stopped here (inc. fees, and the onwards funds)

                const onwardsTxns = _.flatten(await Promise.all(outwards.map(oTxn => follow(oTxn, addressMap, maxDepth - 1))));
                return onwardsTxns.concat(
                    [
                        {
                            time  : d,
                            target: "0x0000000000000000000000000000000000000000",
                            value : -parseInt(txn.gas) * parseInt(txn.gasPrice) / weiPerEther
                        },
                        // money that stopped here
                        {
                            time  : d,
                            target: intermediary,
                            value : (-parseInt(txn.value) + outwards.reduce((sum, {value}) => sum + parseInt(value), 0)) / weiPerEther
                        }
                    ]
                );
            } else {
                console.log("couldn't follow ", txn);
            }
        }
    } else {
        console.log("Exceeded max depth for ", txn);
    }

    // this is a known (or problem) destination, we can just leave it as-is
    // separate out the actual transaction from the fee
    return [
        {
            time  : d,
            target: txn.to,
            value : -parseInt(txn.value) / weiPerEther
        },
        {
            time  : d,
            target: "0x0000000000000000000000000000000000000000",
            value : -parseInt(txn.gas) * parseInt(txn.gasPrice) / weiPerEther
        }
    ]
}

async function getBalanceSheet(addressMap) {

    const txns = await getTxns(addressMap);
    return _.mapValues(txns, ts =>
        _.reduce(ts, (sum, {value}) => value + sum, 0)
    )
}
