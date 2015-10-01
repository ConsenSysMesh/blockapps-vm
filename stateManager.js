var request = require('request')
var BaseStateManager = require('ethereumjs-vm/lib/stateManager.js')
var CheckpointedStore = require('./checkpointed-store.js')
var async = require('async')
var util = require('util')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN
var Account = require('ethereumjs-account')
var apiBase = 'http://api.blockapps.net/eth/v1.0/'

module.exports = BlockAppsStateManager


util.inherits(BlockAppsStateManager, BaseStateManager)
var proto = BlockAppsStateManager.prototype

function BlockAppsStateManager(opts){
  var self = this

  BaseStateManager.call(self, opts)
  
  opts = opts || {}
  self.apiBase = opts.url || apiBase
  self._contractCode = {}
  self._retrievedStorage = {}
}

//
// StateManager overrides
//

proto._lookupAccount = function(address, cb) {
  var self = this
  var addressHex = address.toString('hex')
  var targetUrl = self.apiBase+'account?address='+addressHex.toString('hex')
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
      account.nonce = ethUtil.toBuffer(data.nonce)
      var code = new Buffer(data.code, 'hex')
      var codeHash = ethUtil.sha3(code)
      account.codeHash = codeHash
      self._contractCode[codeHash] = code
    }
    cb(null, account, exists)
  })
}

// performs a network lookup
proto._lookupStorageTrie = function(address, cb){
  var self = this
  var addressHex = address.toString('hex')
  // from network cache
  var storage = self._retrievedStorage[addressHex]
  if (storage) {
    var storageTrie = fakeMerkleTreeForStorage(storage)
    cb(null, storageTrie)
    return
  }
  // from network db
  var targetUrl = self.apiBase+'storage?address='+addressHex.toString('hex')
  console.log(targetUrl)
  request(targetUrl, function(err, res, body) {
    if (err) return cb(err)
    // parse response into storage obj
    var keyValues = JSON.parse(body)
    var storage = {}
    keyValues.forEach(function(keyValue){
      storage[keyValue.key] = keyValue.value
    })
    // cache network results
    self._retrievedStorage[addressHex] = storage
    // create storage tree
    var storageTrie = fakeMerkleTreeForStorage(storage)
    cb(null, storageTrie)
  })
}

proto.getContractCode = function(address, cb) {
  var self = this
  var addressHex = address.toString('hex')
  self.getAccount(address, function(err, account){
    if (err) return cb(err)
    var code = self._contractCode[account.codeHash]
    cb(null, code)
  })
}

proto.putContractCode = function(address, account, code, cb) {
  var self = this
  var addressHex = address.toString('hex')
  var codeHash = ethUtil.sha3(code)
  // update code cache
  self._contractCode[codeHash] = code
  // update account
  account.codeHash = codeHash
  self._putAccount(address, account, cb)
}

proto.commitContracts = function (cb) {
  var self = this
  async.each(Object.keys(self._storageTries), function (address, cb) {
    var trie = self._storageTries[address]
    // delete self._storageTries[address]
    if (trie.isCheckpoint) {
      trie.commit(cb)
    } else {
      console.log('unblanced checkpoints')
      cb()
    }
  }, cb)
}

// util

function fakeMerkleTreeForStorage(storage) {
  var storageTrie = new CheckpointedStore(storage)
  // we're using it as a merkle-patricia-tree replacement so provide fake stateRoot
  storageTrie.root = ethUtil.pad('0x', 32)
  return storageTrie  
}
