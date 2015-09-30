var async = require('async')
var test = require('tape')
var Transaction = require('ethereumjs-tx')
var blockappsVm = require('./index.js')
var buildServer = require('./server.js')
var testData = require('./first-test.json')['ContractStoreClearsOOG']
var testUtil = require('ethereumjs-vm/tests/util.js')
var ethUtil = require('ethereumjs-util')


var server = buildServer(testData)

var vm = blockappsVm()
var tx = testUtil.makeTx(testData.transaction)
var block = testUtil.makeBlockFromEnv(testData.env)

// stateTrie.checkpoint();

vm.runTx({
  tx: tx,
  block: block,
  skipNonce: true,
}, function(err, results) {

  // cleanup
  // stateTrie.revert();
  console.log('------------------------------------------------------------')
  console.log(err || results)

  test('post-state test', function(t){
    verifyPostState(t, vm, testData)
  })

})

function verifyPostState(t, vm, testData){
  var stateManager = vm.stateManager
  // verify accounts
  var postData = testData.post
  async.eachSeries(Object.keys(postData), function(addressHex, cb){
    var address = new Buffer(addressHex, 'hex')
    var accountData = postData[addressHex]
    stateManager.getAccount(addressHex, function(err, account){
      if (err) return cb(err)
      // verify balance + nonce
      var accountBalance = account.balance.toString('hex') || '00'
      t.equal(accountBalance, ethUtil.stripHexPrefix(accountData.balance), 'correct balance')
      var accountNonce = account.nonce.toString('hex') || '00'
      t.equal(accountNonce, ethUtil.stripHexPrefix(accountData.nonce), 'correct nonce')
      // verify storage
      var storageData = accountData.storage
      async.eachSeries(Object.keys(storageData), function(originalStorageKeyHex, cb){
        var storageKey = ethUtil.pad(originalStorageKeyHex, 32)
        var storageKeyHex = storageKey.toString('hex')
        // console.log('originalStorageKeyHex:',originalStorageKeyHex)
        // console.log('addressHex:',addressHex)
        // console.log('storageKey:',storageKey)
        // console.log('storageKeyHex:',storageKeyHex)
        stateManager.getContractStorage(address, storageKey, function(err, storageValue){
          if (err) return cb(err)
          var expectedValue = ethUtil.pad(storageData[originalStorageKeyHex], 32).toString('hex')
          var currentValue = ethUtil.pad(storageValue, 32).toString('hex')
          // console.log('test storageData value:', storageData[originalStorageKeyHex])
          // console.log('expectedValue:', expectedValue)
          // console.log('storageValue:', storageValue)
          // console.log('currentValue:', currentValue)
          t.equal(currentValue, expectedValue, 'correct storage value')
          cb()
        })
      }, cb)
    })
  })
}