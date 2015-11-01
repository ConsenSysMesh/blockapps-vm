var xhr = require('xhr')
var BaseStateManager = require('ethereumjs-vm/lib/stateManager.js')
var FakeMerklePatriciaTree = require('fake-merkle-patricia-tree')
var async = require('async')
var util = require('util')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN
var rlp = ethUtil.rlp
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
// BlockAppsStateManager specific code
//

// use this after a new block has been mined to enable new storage lookups
proto.resetNetworkCache = function(){
  var self = this
  self._retrievedStorage = {}
}

//
// StateManager overrides
//

proto._lookupAccount = function(address, cb) {
  var self = this
  var addressHex = address.toString('hex')
  var targetUrl = self.apiBase+'account?address='+addressHex.toString('hex')
  xhr({ uri: targetUrl, withCredentials: false }, function(err, res, body) {
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
    var storageTrie = new FakeMerklePatriciaTree(storage)
    cb(null, storageTrie)
    return
  }
  // from network db
  var targetUrl = self.apiBase+'storage?address='+addressHex.toString('hex')
  console.log(targetUrl)
  xhr({ uri: targetUrl, withCredentials: false }, function(err, res, body) {
    if (err) return cb(err)
    // parse response into storage obj
    var keyValues = JSON.parse(body)
    var storage = {}
    keyValues.forEach(function(keyValue){
      storage[keyValue.key] = rlp.encode('0x'+keyValue.value)
    })
    // cache network results
    self._retrievedStorage[addressHex] = storage
    // create storage tree
    var storageTrie = new FakeMerklePatriciaTree(storage)
    cb(null, storageTrie)
  })
}

proto.getContractCode = function(address, cb) {
  var self = this
  self.getAccount(address, function(err, account){
    if (err) return cb(err)
    var code = self._contractCode[account.codeHash]
    cb(null, code)
  })
}

proto.putContractCode = function(address, code, cb) {
  var self = this
  var codeHash = ethUtil.sha3(code)
  // update code cache
  self._contractCode[codeHash] = code
  // update account
  self.getAccount(address, function(err, account){
    if (err) return cb(err)
    account.codeHash = codeHash
    self._putAccount(address, account, cb)
  })
}

proto.commitContracts = function (cb) {
  var self = this
  async.each(Object.keys(self._storageTries), function (address, cb) {
    var trie = self._storageTries[address]
    // delete self._storageTries[address]
    if (trie.isCheckpoint) {
      trie.commit(cb)
    } else {
      console.error('unblanced checkpoints')
      cb()
    }
  }, cb)
}
