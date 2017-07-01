const ethereum = require("./ethereum");

go()

async function go(){
    const ethMap = {
        "0xE2536C77a54Bd722ddD3935B900ad079D70f4568" : "me",
        "0xb12464e18f12cca3d19589563118b2b11a3ff30b" : "David",
        "0x0000000000000000000000000000000000000000" : "Gas",
        "0x70faa28A6B8d6829a4b1E649d26eC9a2a39ba413" : "Shapeshift"
    }
    const balanceSheet = await ethereum.getBalanceSheet(ethMap)
    console.log(balanceSheet)
}