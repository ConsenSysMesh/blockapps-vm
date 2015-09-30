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
  


  // "post" : {
  //     "a94f5374fce5edbc8e2a8697c15331677e6ebf0b" : {
  //         "balance" : "0x01980c",
  //         "code" : "0x",
  //         "nonce" : "0x01",
  //         "storage" : {
  //         }
  //     },
  //     "b94f5374fce5edbc8e2a8697c15331677e6ebf0b" : {
  //         "balance" : "0x8aca",
  //         "code" : "0x",
  //         "nonce" : "0x00",
  //         "storage" : {
  //         }
  //     },
  //     "d2571607e241ecf590ed94b12d87c94babe36db6" : {
  //         "balance" : "0x0a",
  //         "code" : "0x6000600055600060015560006002556000600355600060045560006005556000600655600060075560006008556000600955",
  //         "nonce" : "0x00",
  //         "storage" : {
  //         }
  //     }
  // },

  // t.equal(format(account.balance, true), format(acctData.balance, true), 'correct balance')
  // t.equal(format(account.nonce, true), format(acctData.nonce, true), 'correct nonce')

  // var key = data.key.toString('hex')
  // var val = '0x' + rlp.decode(data.value).toString('hex')

  // // if (key === '0x') {
  // //   key = '0x00'
  // //   acctData.storage['0x00'] = acctData.storage['0x00'] ? acctData.storage['0x00'] : acctData.storage['0x']
  // //   delete acctData.storage['0x']
  // // }

  // t.equal(val, hashedStorage[key], 'correct storage value')
  // delete hashedStorage[key]

                //   "storage" : {
                //     "0x00" : "0x0c",
                //     "0x01" : "0x0c",
                //     "0x02" : "0x0c",
                //     "0x03" : "0x0c",
                //     "0x04" : "0x0c",
                //     "0x05" : "0x0c",
                //     "0x06" : "0x0c",
                //     "0x07" : "0x0c",
                //     "0x08" : "0x0c",
                //     "0x09" : "0x0c"
                // }

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
        console.log('addressHex:',addressHex)
        console.log('storageKey:',storageKey)
        console.log('storageKeyHex:',storageKeyHex)
        stateManager.getContractStorage(address, storageKey, function(err, storageValue){
          if (err) return cb(err)
          var expectedValue = ethUtil.pad(storageData[originalStorageKeyHex], 32).toString('hex')
          var currentValue = ethUtil.pad(storageValue, 32).toString('hex')
          // console.log('test storageData value:', storageData[originalStorageKeyHex])
          console.log('expectedValue:', expectedValue)
          console.log('storageValue:', storageValue)
          console.log('currentValue:', currentValue)
          t.equal(currentValue, expectedValue, 'correct storage value')
          cb()
        })
      }, cb)
    })
  })
}