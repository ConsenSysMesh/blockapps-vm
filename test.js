var Transaction = require('ethereumjs-tx')
var blockappsVm = require('./index.js')
var buildServer = require('./server.js')
var testData = require('./first-test.json')['ContractStoreClearsOOG']


var server = buildServer(testData)

var vm = blockappsVm()
var txParams = testData.transaction
var transaction = new Transaction(txParams)
transaction.sign(new Buffer(txParams.secretKey, 'hex'))

// stateTrie.checkpoint();

vm.runTx({
  tx: transaction,
  // block: self.app.blockchain.head,
  skipNonce: true,
}, function(err, results) {

  // cleanup
  // stateTrie.revert();

  console.log(err || results)

})