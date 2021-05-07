const test = require('ava')
const SPVNodeDB = require('../../src/spvnode')

test.before(t => {
    // setup files
    let settings = getSettings(networks.REGTEST)
    
    // Test data folder
    settings.DATA_FOLDER = path.join(__dirname, 'data')
  
    


    t.context = { node }
})