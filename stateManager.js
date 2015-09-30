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
}

//
// blockapps-specific methods
//

// account

proto._loadAccountForAddress = function(addressHex, cb){
  var self = this
  var targetUrl = self.apiBase+'account?address='+addressHex.toString('hex')
  // console.log(targetUrl)
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
      self._contractCode[codeHash] = code
    }
    cb(null, account, exists)
  })
}


proto._getAccountForAddress = function(addressHex, cb){
  var self = this
  self._loadAccountForAddress(addressHex, function(err, account){
    if (err) return cb(err)
    cb(null, account)
  })
}

// storage

proto._loadStorageForAddress = function(addressHex, cb){
  var self = this
  var targetUrl = self.apiBase+'storage?address='+addressHex.toString('hex')
  // console.log(targetUrl)
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

proto._getStorageForAddress = function(addressHex, cb){
  var self = this
  var storage = self._storageTries[addressHex]
  if (storage) {
    cb(null, storage)
  } else {
    self._loadStorageForAddress(addressHex, function(err, storage){
      if (err) return cb(err)
      // console.log('storage for', addressHex)
      // console.log(storage)
      var fancyStore = new CheckpointedStore(storage)
      self._storageTries[addressHex] = fancyStore
      cb(null, fancyStore)
    })
  }
}

//
// StateManager overrides
//

proto._lookupAccount = function(address, cb) {
  var self = this
  var addressHex = address.toString('hex')
  self._getAccountForAddress(addressHex, cb)
}

proto.commitContracts = function(cb) {
  var self = this
  for (var addressHex in self._storageTries) {
    var storage = self._storageTries[addressHex]
    // delete self._storageTries[addressHex]
    try {
      storage.commit()
    } catch (e) {
      console.log('storageTrie - unblanced checkpoints')
    }
  }
  cb()
}

proto.revertContracts = function() {
  var self = this
  self._storageTries = {}
}

proto.getContractStorage = function(address, key, cb){
  var self = this
  var addressHex = address.toString('hex')
  var keyHex = key.toString('hex')
  self._getStorageForAddress(addressHex, function(err, storage){
    if (err) return cb(err)
    var rawValue = storage.get(keyHex)
    // console.log('RETURNED STORAGE:', storage)
    // console.log('RETURNED rawValue:', rawValue)
    // console.log('STORAGE TRIES:', Object.keys(self._storageTries))
    var value = rawValue ? new Buffer(rawValue, 'hex') : null
    cb(null, value)
  })
}

proto.putContractStorage = function(address, key, value, cb){
  var self = this
  var addressHex = address.toString('hex')
  var keyHex = key.toString('hex')
  var valueHex = value.toString('hex')
  // console.log('storage put for '+addressHex+' at '+keyHex+' = '+valueHex)
  self._getStorageForAddress(addressHex, function(err, storage){
    if (err) return cb(err)
    if (valueHex) {
      storage.put(keyHex, valueHex)
    } else {
      storage.del(keyHex)
    }
    var rawValue = storage.get(keyHex)
    // console.log('SET valueHex:', valueHex)
    // console.log('RETURNED rawValue:', rawValue)
    // console.log('STORAGE TRIES:', Object.keys(self._storageTries))
    
    cb()
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