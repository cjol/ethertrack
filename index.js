const EthAccount = require("./ethereum");

go();

// tcns after 27th ish are to/from a separate exchange
// 3x -13 went wrong with shapeshift - one left as Dash, two refunded as a 26
// another out to Bruce (25 + 0.01)

async function go() {
    const ethMap = {
        "0xe2536c77a54bd722ddd3935b900ad079d70f4568": "Chris",
        "0xb12464e18f12cca3d19589563118b2b11a3ff30b": "David",
        "0x0000000000000000000000000000000000000000": "Gas",
        "0x70faa28a6b8d6829a4b1e649d26ec9a2a39ba413": "Shapeshift",
        "0x6643aa4c023eb75d34222d785ff127319c1ea4b9": "Ethereum Wallet"
    };

    try {
        const mainEth = new EthAccount("0xe2536c77a54bd722ddd3935b900ad079d70f4568");
        const txns    = await mainEth.getTxns(2, ["0xb12464e18f12cca3d19589563118b2b11a3ff30b", "0x70faa28a6b8d6829a4b1e649d26ec9a2a39ba413"]);

        simplify(txns); // mutates the original txns because screw it

        txns.sort((a, b) => a.time - b.time);
        txns.forEach(t => {
            t.from = ethMap[t.from.toLowerCase()] || t.from;
            t.to   = ethMap[t.to.toLowerCase()] || t.to;
        });
        // const balanceSheet = await ethereum.getTxns(ethMap);

        console.log(txns.map(t => {
            let vString = "";
            if (t.fromType === t.toType) {
                vString = `${t.fromValue} ${t.fromType}`
            } else {
                vString = `${t.fromValue}  ${t.fromType} / ${t.toValue} ${t.toType}`
            }
            return `${t.from} -(${vString})-> ${t.to}`
        }))
    } catch (e) {
        console.error(e);
    }

    // Get all txns from base account (simplifying transitively where appropriate)
    // for all unexpanded accounts (up to some max depth), get all txns and merge in
}

function simplify(txns) {
    // find the addresses which were only output for one txn
    const ellidable   = {};
    const moreThanOne = {};
    txns.forEach(t => {
        const addr = `${t.toType}%%%${t.to}`.toLowerCase();
        if (addr in moreThanOne) return;
        if (addr in ellidable) {
            moreThanOne[addr] = ellidable[addr];
            delete ellidable[addr];
        } else {
            ellidable[addr] = t;
        }
    });

    Object.values(ellidable).forEach(a => {
        txns.forEach(t => {
            if (t.from === a.to && t.fromType === a.toType) {
                // simplify!
                t.from     = a.from;
                t.fromType = a.fromType;
                a.fromValue -= t.fromValue;
            }
        })
    });
    return txns;

}
// async function follow(txn, addressMap, maxDepth = 3) {
//     const d = new Date();
//     d.setTime(parseInt(txn.timeStamp) * 1000);
//
//     if (maxDepth >= 0) {
//
//         if (!(txn.to in addressMap)) {
//             // unknown destination. See if it's to an account with a single input
//             const intermediary = txn.to.toLowerCase();
//             const onwardsTxns  = await getRawTxns([intermediary]);
//             const inwards      = onwardsTxns.filter(t => t.to.toLowerCase() === intermediary);
//             const outwards     = onwardsTxns.filter(t => t.from.toLowerCase() === intermediary);
//
//             if (inwards.length === 1) {
//                 // only one transaction went into this account - it must be the same as the one we just followed
//                 // separate it into the funds that stopped here (inc. fees, and the onwards funds)
//
//                 const onwardsTxns = _.flatten(await Promise.all(outwards.map(oTxn => follow(oTxn, addressMap, maxDepth - 1))));
//                 return onwardsTxns.concat(
//                     [
//                         {
//                             time  : d,
//                             target: "0x0000000000000000000000000000000000000000",
//                             value : -parseInt(txn.gas) * parseInt(txn.gasPrice) / weiPerEther
//                         },
//                         // money that stopped here
//                         {
//                             time  : d,
//                             target: intermediary,
//                             value : (-parseInt(txn.value) + outwards.reduce((sum, {value}) => sum + parseInt(value), 0)) / weiPerEther
//                         }
//                     ]
//                 );
//             } else {
//                 console.log("couldn't follow ", txn);
//             }
//         }
//     } else {
//         console.log("Exceeded max depth for ", txn);
//     }
//
//     // this is a known (or problem) destination, we can just leave it as-is
//     // separate out the actual transaction from the fee
//     const result = [
//  ll   ];
//
//     if (addressMap[txn.to] === "Shapeshift") {
//         // track this as the
//     }
//
//     return  result
// }

