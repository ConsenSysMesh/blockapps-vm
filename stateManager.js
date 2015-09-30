var request = require('request')
var StateManager = require('ethereumjs-vm/lib/stateManager.js')
var CheckpointedStore = require('./checkpointed-store.js')
var async = require('async')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN
var Account = require('ethereumjs-account')

module.exports = BlockAppsStateManager

var _storages = {}
var _code = {}
var apiBase = 'http://api.blockapps.net/eth/v1.0/'
function BlockAppsStateManager(baseStateManager, opts){
  opts = opts || {}
  if (opts.url) apiBase = opts.url

  baseStateManager._lookupAccount = _lookupAccount.bind(baseStateManager)
  
  baseStateManager.getContractStorage = getContractStorage.bind(baseStateManager)
  baseStateManager.putContractStorage = putContractStorage.bind(baseStateManager)
  
  baseStateManager.commitContracts = commitContracts.bind(baseStateManager)
  baseStateManager.revertContracts = revertContracts.bind(baseStateManager)
  
  baseStateManager.getContractCode = getContractCode.bind(baseStateManager)

  // baseStateManager.history.on('commit', _commitContractStorage)
  // baseStateManager.history.on('revert', _revertContractStorage)

  return baseStateManager
}

//
// blockapps
//

// account

function loadAccountForAddress(addressHex, cb){
  var targetUrl = apiBase+'account?address='+addressHex.toString('hex')
  console.log(targetUrl)
  request(targetUrl, function(err, res, body) {
    if (err) return cb(err)
    // parse response into raw account
    var data
    try {
      data = JSON.parse(body)[0]
    } catch (err) {
      console.log(body)
      throw err
    }
    
    var exists = false
    var account = new Account()
    if (data) {
      exists = true
      account.balance = new BN(data.balance)
      account.stateRoot = new Buffer(data.contractRoot, 'hex')
      account.nonce = new Buffer(data.nonce, 'hex')
      var code = new Buffer(data.code, 'hex')
      var codeHash = ethUtil.sha3(code)
      account.codeHash = codeHash
      _code[codeHash] = code
    }
    cb(null, account, exists)
  })
}


function getAccountForAddress(addressHex, cb){
  // var account = _accounts[addressHex]
  // if (account) {
  //   cb(null, account)
  // } else {
    loadAccountForAddress(addressHex, function(err, account){
      if (err) return cb(err)
      // _accounts[addressHex] = account
      cb(null, account)
    })
  // }
}

// storage

function loadStorageForAddress(addressHex, cb){
  var targetUrl = apiBase+'storage?address='+addressHex.toString('hex')
  console.log(targetUrl)
  request(targetUrl, function(err, res, body) {
    if (err) return cb(err)
    // parse response into storage obj
    var keyValues = JSON.parse(body)
    var storage = {}
    keyValues.forEach(function(keyValue){
      storage[keyValue.key] = keyValue.value
    })
    cb(null, storage)
  })
}

function getStorageForAddress(addressHex, cb){
  var storage = _storages[addressHex]
  if (storage) {
    cb(null, storage)
  } else {
    loadStorageForAddress(addressHex, function(err, storage){
      if (err) return cb(err)
      console.log('storage for', addressHex)
      console.log(storage)
      var fancyStore = new CheckpointedStore(storage)
      _storages[addressHex] = fancyStore
      cb(null, fancyStore)
    })
  }
}

function _revertContractStorage(){
  console.log('BASM - revert')
  for (var addressHex in _storages) {
    var storage = _storages[addressHex]
    if (storage.isCheckpointed()) {
      console.log('BASM - revert -', addressHex)
      storage.revert()
    }
  }
}
function _commitContractStorage(){
  console.log('BASM - commit')
  for (var addressHex in _storages) {
    var storage = _storages[addressHex]
    if (storage.isCheckpointed()) {
      console.log('BASM - commit -', addressHex)
      storage.commit()
    }
  }
}

// code

function getCodeForAddress(addressHex, cb){
  getAccountForAddress(addressHex, function(err, account){
    if (err) return cb(err)
    var code = _code[account.codeHash]
    cb(null, code)
  })
}

//
// StateManager
//

function _lookupAccount(address, cb) {
  var addressHex = address.toString('hex')
  getAccountForAddress(addressHex, cb)
}

function getContractStorage(address, key, cb){
  var addressHex = address.toString('hex')
  var keyHex = key.toString('hex')
  getStorageForAddress(addressHex, function(err, storage){
    if (err) return cb(err)
    var rawValue = storage.get(keyHex)
    var value = rawValue ? new Buffer(rawValue, 'hex') : null
    cb(null, value)
  })
}

function commitContracts(cb) {
  var self = this
  async.each(Object.keys(_storages), function (addressHex, cb) {
    var trie = _storages[addressHex]
    delete _storages[addressHex]
    try {
      trie.commit()
    } catch (e) {
      console.log('unblanced checkpoints')
    }
    cb()
  }, cb)
}

function revertContracts() {
  var self = this
  _storages = {}
}

function putContractStorage(address, key, value, cb){
  var addressHex = address.toString('hex')
  var keyHex = key.toString('hex')
  var valueHex = value.toString('hex')
  getStorageForAddress(addressHex, function(err, storage){
    if (err) return cb(err)
    if (valueHex) {
      storage.put(keyHex, valueHex)
    } else {
      storage.del(keyHex)
    }
    cb()
  })
}

function getContractCode(address, cb) {
  var self = this
  var addressHex = address.toString('hex')
  self.getAccount(address, function(err, account){
    if (err) return cb(err)
    var code = _code[account.codeHash]
    cb(null, code)
  })
}