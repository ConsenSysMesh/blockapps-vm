/*



*/

function call(params, cb) {
  var txParams = params[0]
  var blockHash = ethUtil.stripHexPrefix(params[1]);
  var enableTrace = params[2];
  var self = this;

  // this.getStateAtBlock(blockHash, function(err, stateTrie){
  //   if (err) return cb(err);

    // var vm = new VM(stateTrie, self.app.blockchain);
    var stateProvider = new StateProvider(stateTrie, self.app.blockchain);
    var vm = new VM(stateProvider);

    var transaction = new Transaction({
      to: txParams.to,
      from: txParams.from,
      value: txParams.value,
      data: txParams.data,
      gasLimit: txParams.gas || '0xffffffffffffffff',
      gasPrice: txParams.gasPrice,
    });

    //from is special unfortally and is not normilized by the setter
    transaction.from = new Buffer(ethUtil.stripHexPrefix(txParams.from), 'hex');

    // stateTrie.checkpoint();
    stateProvider.checkpoint();

    vm.runTx({
      tx: transaction,
      block: self.app.blockchain.head,
      skipNonce: true,
    }, function(err, results) {

      // cleanup
      stateTrie.revert();
      if (enableTrace) {
        stream.end();
      }

      // abort on error
      if (err) return cb(err);

      // process results
      if (results.vm.returnValue) {
        var returnValue = hexStrPrefix + results.vm.returnValue.toString('hex')
        if (enableTrace) {
          returnValue = {
            result: returnValue,
            vmTrace: vmTrace
          } 
        }
        cb(null, returnValue);
      } else {
        cb(null, null);
      }
    });
  });
}