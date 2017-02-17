var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var liveSchema = new Schema({
  pf:      String,
  type:    String,
  href:    String,
  imgHref: String,
  title:   String,
  name:    String,
  number:  Number,
  addTime: { type: Date, default: Date.now },
});

var Live = mongoose.model('Live', liveSchema);

module.exports = Live;