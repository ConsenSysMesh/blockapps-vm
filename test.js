// polyfill for node
require('xhr').XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

var async = require('async')
var test = require('tape')
var Transaction = require('ethereumjs-tx')
var blockappsVm = require('./index.js')
var BlockappsTestServer = require('./server.js')
var allTests = require('./first-test.json')
var testUtil = require('ethereumjs-vm/tests/util.js')
var ethUtil = require('ethereumjs-util')

var server = new BlockappsTestServer()

// select tests
var selectedTests = allTests
var targetTestName = process.argv[2]
if (targetTestName) {
  selectedTests = [allTests[targetTestName]]
  if (!selectedTests[0]) throw new Error('No such test')
}
// run tests
runSelectedTests(selectedTests)

function runSelectedTests(){
  async.eachSeries(Object.keys(selectedTests), runStateTest, function(){
    server.close()
  })
}

function runStateTest(testName, cb){
  var testData = selectedTests[testName]
  console.log('------------------------ test start ------------------------------------')
  test(testName, function(t){
  console.log('------------------------ test end ------------------------------------')

    runTest(t, testData, function(err){
      t.end(err)
      cb()
    })
  })
}

function runTest(t, testData, cb){
  console.log('------------------------------------------------------------')
  console.log(JSON.stringify(testData, null, 2))
  console.log('------------------------------------------------------------')
  // setup server
  server.setData(testData)

  // setup vm
  var vm = blockappsVm({
    url: 'http://localhost:3000/',
  })
  var tx = testUtil.makeTx(testData.transaction)
  var block = testUtil.makeBlockFromEnv(testData.env)
  vm.stateManager.checkpoint()

  if (tx.validate()) {
    // run test
    vm.runTx({
      tx: tx,
      block: block,
    }, finishTest)
    // vm.createTraceStream().on('data', console.log.bind(console))
  } else {
    finishTest()
  }

  function finishTest(err, results) {
    console.log('------------------------ results ------------------------------------')
    if (err) console.error(err.stack)
    if (results) console.log(results)
    console.log('------------------------------------------------------------')

    // t.error(err, 'runTx did not error')
    verifyPostState(t, vm, testData, function(err){
      t.error(err, 'post-state verification did not error')
      vm.stateManager.revert(cb)
    })
  }

}

function verifyPostState(t, vm, testData, cb){
  var stateManager = vm.stateManager
  // verify accounts
  var postData = testData.post
  async.eachSeries(Object.keys(postData), verifyAccount, cb)

  function verifyAccount(addressHex, cb){
    var address = new Buffer(addressHex, 'hex')
    var accountData = postData[addressHex]
    stateManager.getAccount(addressHex, function(err, account){
      if (err) return cb(err)
      // verify balance + nonce
      var accountBalance = account.balance.toString('hex') || '00'
      t.equal(accountBalance, ethUtil.stripHexPrefix(accountData.balance), 'correct balance for '+addressHex)
      var accountNonce = account.nonce.toString('hex') || '00'
      t.equal(accountNonce, ethUtil.stripHexPrefix(accountData.nonce), 'correct nonce for '+addressHex)
      // verify storage
      var storageData = accountData.storage
      async.eachSeries(Object.keys(storageData), verifyStorage.bind(null, address), cb)
    })
  }

  function verifyStorage(address, originalStorageKeyHex, cb){
    var addressHex = address.toString('hex')
    var accountData = postData[addressHex]
    var storageData = accountData.storage
    var storageKey = ethUtil.pad(originalStorageKeyHex, 32)
    var storageKeyHex = storageKey.toString('hex')
    stateManager.getContractStorage(address, storageKey, function(err, storageValue){
      if (err) return cb(err)
      var expectedValue = ethUtil.pad(storageData[originalStorageKeyHex], 32).toString('hex')
      var currentValue = ethUtil.pad(storageValue, 32).toString('hex')
      t.equal(currentValue, expectedValue, 'correct storage value for '+addressHex+' at '+storageKeyHex)
      cb()
    })
  }
}