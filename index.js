const VM = require('ethereumjs-vm')
const Trie = require('merkle-patricia-tree/secure.js')
const BlockAppsStateManager = require('./stateManager.js')

module.exports = buildVM

function buildVM(opts){

  // create a new VM instance
  var trie = new Trie()
  var vm = new VM(trie)
  vm.stateManager = new BlockAppsStateManager(opts)

  // debug utilities!
  // var traceStream = vm.createTraceStream()
  // traceStream.on('data', function(data){
  //   console.log(data.opcode.opcode)
  // })
  // injectBugs('root', vm.stateManager)

  return vm

}

// adds function wrappers that logs the method being called
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