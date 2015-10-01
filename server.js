var express = require('express')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN

module.exports = BlockappsTestServer


function BlockappsTestServer(initState){
  var self = this
  // console.log('initState::\n', initState)

  var app = self.app = express()

  app.get('/account', function(req, res){
    var address = req.query.address
    self._lookupAccount(address, function(err, data){
      if (err) {
        res.status(500).send({ error: err })
      } else {
        res.send(data)
      }
    })
  })

  app.get('/storage', function(req, res){
    var address = req.query.address
    self._lookupStorage(address, function(err, data){
      if (err) {
        res.status(500).send({ error: err })
      } else {
        res.send(data)
      }
    })
  })

  self.server = app.listen(3000)
}

var proto = BlockappsTestServer.prototype

proto.setData = function(testData){
  var self = this
  self._testData = testData
}

proto.close = function(){
  var self = this
  self.server.close()
}

proto._lookupAccount = function(address, cb){
  var self = this

  var preState = self._testData.pre
  var account = preState[address]
  var data = []
  
  if (account) {
    data = [{
      contractRoot: '0000000000000000000000000000000000000000000000000000000000000000',
      balance: new BN(ethUtil.stripHexPrefix(account.balance), 16).toString(),
      address: address,
      code: ethUtil.stripHexPrefix(account.code),
      nonce: parseInt(ethUtil.stripHexPrefix(account.nonce), 16),
    }] 
  }

  cb(null, data)
}

proto._lookupStorage = function(address, cb){
  var self = this

  var preState = self._testData.pre
  var account = preState[address]
  // console.log('account::\n', account)
  var data = []
  if (account) {
    data = Object.keys(account.storage).map(function(key){
      var value = account.storage[key]
      // strip 0x
      key = key.slice(2)
      value = value.slice(2)
      // pad
      key = pad(key)
      value = pad(value)
      return { value: value, key: key }
    })
  }

  cb(null, data)
}

var fullPad = '0000000000000000000000000000000000000000000000000000000000000000'
function pad(input){
  return fullPad.slice(input.length)+input
}