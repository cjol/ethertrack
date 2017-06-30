const axios = require("axios");
const _ = require("lodash")

const weiPerEther = 1000000000000000000

go()

async function go(){
    const addressMap = {
        "0xE2536C77a54Bd722ddD3935B900ad079D70f4568" : "me",
        "0xb12464e18f12cca3d19589563118b2b11a3ff30b" : "David",
        "0x0000000000000000000000000000000000000000" : "Gas"
    }
    // const balance = await getBalance(myAddress)
    // console.log(balance);
    const balanceSheet = await getBalanceSheet(addressMap)
    console.log(balanceSheet)
}

async function getBalanceSheet(addressMap, startblock, endblock) {

    const txns = await getMyTxns(addressMap);
    return _.mapValues(txns, ts => 
        _.reduce(ts, (sum, {value}) => value + sum, 0)
    )
}

async function getMyTxns(addressMap, startblock, endblock) {

    addressMap = _.mapKeys(addressMap, (v, k) => k.toLowerCase());
    const addresses = _.chain(addressMap)
        .entries()
        .filter(([k, v]) => v === "me")
        .map(([k, v]) => k)
        .value();
    
    const txns = await getTxns(addresses, startblock, endblock);

    return _.chain(txns)
        .flatMap(t =>{
            const txns = []
            const d = new Date()
            d.setTime(parseInt(t.timeStamp)*1000)

            t.from = (t.from || "").toLowerCase()
            t.to   = (t.to || "").toLowerCase()

            if (addressMap[t.from] === "me") {
                // money we sent (we pay the fee)
                // separate out the actual transaction and the fee
                txns.push({
                    time: d,
                    target: t.to,
                    value: -parseInt(t.value)/ weiPerEther
                })
                txns.push({
                    time: d,
                    target: "0x0000000000000000000000000000000000000000",
                    value: -parseInt(t.gas) * parseInt(t.gasPrice)/ weiPerEther
                })
            } else {
                // money we receive (the fee has been paid)
                txns.push({
                    time: d,
                    target: t.from,
                    value: parseInt(t.value)/ weiPerEther
                })
            }
            return txns
        })
        .groupBy('target')
        .mapValues(a => a.map(t => delete t['target'] && t))
        .mapKeys((v, k) => addressMap[k] || k)
        .value();
    
    
    // TODO: merge back together transactions at the same time to the same address
    // TODO (cont.): Relatedly, an immediate refunded transaction should be cancelled
}

async function getTxns(addresses, startblock=0, endblock=99999999) {
    const txns = await Promise.all(addresses.map(async address => {
        const data = await makeAPICall({
            module: "account", 
            action: "txlist",
            startblock, 
            endblock,
            address
        })

        if (data.status == 1 && data.message == 'OK')
            return data.result

        // TODO: aggregate if we have more than 10k transactions

        throw Error("API Error: " + data.message)
    }))
    return [].concat.apply([], txns);
}

async function getBalance(address) {
    const data = await makeAPICall({
        module: "account", 
        action: "balance",
        address
    })

    if (data.status == 1 && data.message == 'OK')
        return data.result

    throw Error("API Error: " + data.message)
}

async function makeAPICall(params) {
    const apikey = "FRA76RN1BCQGJF8ISJPS82RYM4T1BPCAWH"
    const baseURL = "https://api.etherscan.io/api"

    const {data} = await axios.get(baseURL, {
        params: Object.assign({}, params, {apikey})
    })
    return data
}