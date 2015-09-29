var request = require('request')
var StateManager = require('ethereumjs-vm/lib/stateManager.js')
var CheckpointedStore = require('./checkpointed-store.js')
var async = require('async')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN
var Account = require('ethereumjs-account')

module.exports = BlockAppsStateManager

var _storages = {}
var _accounts = {}
var _code = {}
var apiBase = 'http://api.blockapps.net/eth/v1.0/'
function BlockAppsStateManager(baseStateManager, opts){
  opts = opts || {}
  if (opts.url) apiBase = opts.url

  baseStateManager.warmCache = warmCache.bind(baseStateManager)
  baseStateManager.getContractStorage = getContractStorage.bind(baseStateManager)
  baseStateManager.putContractStorage = putContractStorage.bind(baseStateManager)
  baseStateManager.getContractCode = getContractCode.bind(baseStateManager)

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
    
    var account = new Account()
    if (data) {
      account.balance = new BN(data.balance)
      account.stateRoot = new Buffer(data.contractRoot, 'hex')
      account.nonce = new Buffer(data.nonce, 'hex')
      var code = new Buffer(data.code, 'hex')
      var codeHash = ethUtil.sha3(code)
      account.codeHash = codeHash
      _code[codeHash] = code
      console.log(account)
      console.log(code)
    }
    cb(null, account)
  })
}


function getAccountForAddress(addressHex, cb){
  var account = _accounts[addressHex]
  if (account) {
    cb(null, account)
  } else {
    loadAccountForAddress(addressHex, function(err, account){
      if (err) return cb(err)
      _accounts[addressHex] = account
      cb(null, account)
    })
  }
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
    console.log(storage)
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
      var fancyStore = new CheckpointedStore(storage)
      _storages[addressHex] = fancyStore
      cb(null, fancyStore)
    })
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

/**
 * @param {Set} address
 * @param {cb} function
 */
function warmCache(addresses, cb) {
  var self = this

  // shim till async supports iterators
  var accountArr = []
  addresses.forEach(function (val) {
    if (val) accountArr.push(val)
  })

  async.each(accountArr, function (addressHex, done) {
    getAccountForAddress(addressHex, function(err, account){
      if (err) return cb(err)
      self.cache.put(new Buffer(addressHex, 'hex'), account, true)
      done()
    })
  }, cb)
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

function putContractStorage(address, key, value, cb){
  var addressHex = address.toString('hex')
  var keyHex = key.toString('hex')
  var valueHex = value.toString('hex')
  getStorageForAddress(addressHex, function(err, storage){
    if (err) return cb(err)
    storage.put(keyHex, valueHex)
    cb()
  })
}

// problem -- signature needs to change to address not account
function getContractCode(address, cb) {
  var addressHex = address.toString('hex')
  getCodeForAddress(addressHex, cb)
}