const Tree = require('functional-red-black-tree')

module.exports = CheckpointedStore


function CheckpointedStore(initState) {
  var self = this
  self._tree = Tree()
  self._checkpoints = []

  Object.defineProperty(self, 'isCheckpoint', {
    get: function () {
      return !!self._checkpoints.length
    }
  })

  // intialize state
  initState = initState || {}
  for (var keyHex in initState) {
    var val = initState[keyHex]
    self.put(new Buffer(keyHex, 'hex'), val, function(){})
  }
}

CheckpointedStore.prototype.put = function(key, value, cb) {
  var self = this
  var keyHex = key.toString('hex')
  var valueHex = value.toString('hex')
  var iterator = self._tree.find(keyHex)
  console.log('CheckpointedStore put', keyHex, '->', valueHex)
  if (iterator.node) {
    self._tree = iterator.update(valueHex)
  } else {
    self._tree = self._tree.insert(keyHex, valueHex)
  }
  cb()
}

CheckpointedStore.prototype.get = function(key, cb) {
  var self = this
  var keyHex = key.toString('hex')
  var iterator = self._tree.find(keyHex)
  if (iterator.node) {
    console.log('CheckpointedStore get', keyHex, '->', iterator.value)
    cb(null, new Buffer(iterator.value, 'hex'))
  } else {
    console.log('CheckpointedStore get', keyHex, '->', undefined)
    cb(null, undefined)
  }
}

CheckpointedStore.prototype.del = function(key, cb) {
  var self = this
  var keyHex = key.toString('hex')
  console.log('CheckpointedStore del')
  self._tree = self._tree.remove(keyHex)
  cb()
}

CheckpointedStore.prototype.checkpoint = function() {
  var self = this
  console.log('checkpointed store - checkpoint')
  self._checkpoints.push(self._tree)

}

CheckpointedStore.prototype.revert = function(cb) {
  var self = this
  console.log('checkpointed store - revert')
  if (self.isCheckpoint) {
    self._tree = self._checkpoints.pop(self._tree)
    if (cb) cb()
  } else {
    var err = new Error('Checkpoint store reverted without a checkpoint.')
    cb(err)
  }
}

CheckpointedStore.prototype.commit = function(cb) {
  var self = this
  console.log('checkpointed store - commit')
  if (self.isCheckpoint) {
    self._checkpoints.pop()
    if (cb) cb()
  } else {
    var err = new Error('Checkpoint store committed without a checkpoint.')
    cb(err)
  }
}
