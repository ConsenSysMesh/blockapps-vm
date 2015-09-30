const Tree = require('functional-red-black-tree')

module.exports = CheckpointedStore

function CheckpointedStore(initState) {
  this._tree = Tree()
  this._checkpoints = []
  // intialize state
  initState = initState || {}
  for (var key in initState) {
    var val = initState[key]
    this.put(key, val, false)
  }
}

CheckpointedStore.prototype.put = function(key, value) {
  var iterator = this._tree.find(key)
  if (iterator.node) {
    this._tree = iterator.update(value)
  } else {
    this._tree = this._tree.insert(key, value)
  }
}

CheckpointedStore.prototype.get = function(key) {
  var iterator = this._tree.find(key)
  if (iterator.node) {
    return iterator.value
  } else {
    return undefined
  }
}

CheckpointedStore.prototype.isCheckpointed = function() {
  return !!this._checkpoints.length
}

CheckpointedStore.prototype.checkpoint = function() {
  this._checkpoints.push(this._tree)
}

CheckpointedStore.prototype.revert = function() {
  if (this._checkpoints.length > 0) {
    this._tree = this._checkpoints.pop(this._tree)
  } else {
    throw new Error('Checkpoint store reverted without a checkpoint.')
  }
}

CheckpointedStore.prototype.commit = function() {
  if (this._checkpoints.length > 0) {
    this._checkpoints.pop()
  } else {
    throw new Error('Checkpoint store committed without a checkpoint.')
  }
}

CheckpointedStore.prototype.del = function(key) {
  this._tree = this._tree.remove(key)
}
