var express = require('express')
var ethUtil = require('ethereumjs-util')
var BN = ethUtil.BN
module.exports = buildApp


function buildApp(initState){
  console.log('initState::\n', initState)

  var app = express()

  app.get('/storage', function(req, res){
    var address = req.query.address
    var account = initState.pre[address]
    console.log('account::\n', account)
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
    res.send(data)
  })

  app.get('/account', function(req, res){
    var address = req.query.address
    var account = initState.pre[address]
    if (!account) {
      res.send([])
      return
    }

    var data = {
      contractRoot: '0000000000000000000000000000000000000000000000000000000000000000',
      balance: ethUtil.bufferToInt(new Buffer(ethUtil.stripHexPrefix(account.balance), 'hex')).toString(),
      address: address,
      code: ethUtil.stripHexPrefix(account.code),
      nonce: Number(ethUtil.bufferToInt(new Buffer(ethUtil.stripHexPrefix(account.nonce), 'hex')).toString()),
    }

    res.send([data])
  })

  app.listen(3000)

  return app
}

var fullPad = '0000000000000000000000000000000000000000000000000000000000000000'
function pad(input){
  return fullPad.slice(input.length)+input
}