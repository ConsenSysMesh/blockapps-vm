const VM = require('ethereumjs-vm')
const Trie = require('merkle-patricia-tree/secure.js')
const BlockAppsStateManager = require('./stateManager.js')

module.exports = buildVM

function buildVM(){

  // create a new VM instance
  var trie = new Trie()
  var vm = new VM(trie)
  vm.stateManager = new BlockAppsStateManager({
    url: 'http://localhost:3000/',
  })

  var code = '7f4e616d65526567000000000000000000000000000000000000000000000000003055307f4e616d6552656700000000000000000000000000000000000000000000000000557f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5573661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000553360455560df806100c56000396000f3007f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3'

  var traceStream = vm.createTraceStream()
  traceStream.on('data', function(data){
    console.log(data.opcode.opcode)
  })

  injectBugs('root', vm.stateManager)

  // vm.runCode({
  //   // address: new Buffer('ffffffff', 'hex'),
  //   code: new Buffer(code, 'hex'),
  //   gasLimit: new Buffer('ffffffff', 'hex'),
  // }, function(err, results){
  //   console.log('returned: ' + results.return.toString('hex'))
  // })

  return vm

}


function injectBugs(label, target){
  bug(label, target, 'getAccount')
  bug(label, target, 'putAccount')
  bug(label, target, 'getAccountBalance')
  bug(label, target, 'putAccountBalance')
  bug(label, target, 'putContractCode')
  bug(label, target, 'getContractCode')
  bug(label, target, 'getContractCodeByAddress')
  bug(label, target, 'getContractStorage')
  bug(label, target, 'commitContracts')
  bug(label, target, 'revertContracts')
  bug(label, target, 'putContractStorage')
  bug(label, target, 'getBlockHashByNumber')
  bug(label, target, 'checkpoint')
  bug(label, target, 'commit')
  bug(label, target, 'revert')
  bug(label, target, 'getStateRoot')
  bug(label, target, 'warmCache')
  bug(label, target, 'cacheGet')
  bug(label, target, 'cachePut')
  bug(label, target, 'cacheDel')
  bug(label, target, 'cacheFlush')
  bug(label, target, 'cacheCheckpoint')
  bug(label, target, 'cacheCommit')
  bug(label, target, 'cacheRevert')
}

function bug(label, obj, key){
  var _super = obj[key]
  obj[key] = function bugWrapper(){
    // console.log(label+':', key, arguments)
    console.log(label+':', key)
    // console.log(arguments)
    return _super.apply(obj, arguments)
  }
}