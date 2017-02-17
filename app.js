var request  = require('superagent');
var nocache  = require('superagent-no-cache');
var prefix   = require('superagent-prefix')('/static');
var cheerio  = require('cheerio');  
var async    = require('async');
var util     = require('util');
var mongoose = require('mongoose');
var _        = require('lodash');
var moment   = require('moment');
var Live     = require(__dirname + '/model/live');
var db       = require(__dirname + '/config/dbConfig');
var urlMap   = require(__dirname + '/config/pfConfig');

mongoose.connect('mongodb://' + db.host + ':' + db.port + '/' + db.database);

var formatNumber = function(number) {
  if (number.lastIndexOf('万') == -1) {
    return number
  }
  return number.substring(0, number.indexOf('万')) * 10000
}

var diffValues = function(newItem, oldItem) {
  _.forEach(newItem, function(newValue, newKey) {
    if (newValue === oldItem[newKey]) {
      delete newItem[newKey]
    }
  })
  return newItem
}

var saveLiveData = function(item, callback) {
  var name = item.name, pf = item.pf
  async.waterfall([
    function(cb) {
      Live.find({ name: item.name, pf: item.pf }, function(err, rows) {
        if (err) {
          cb(err); return
        }

        if (rows.length === 0) {
          cb(null, { save: true }); return
        }

        var diff = diffValues(item, rows[0])
        if (_.isEmpty(diff)) {
          cb(null, { save: false }); return
        }

        diff['addTime'] = new Date()
        Live.findOneAndUpdate({ name: item.name, pf: item.pf }, diff, function(err) {
          if (err) {
            cb(err); return
          }
          util.log('update live information...', name, pf)
          cb(null, { save: false })
        })
      })
    },
    function(need, cb) {
      if (need.save) {
        var live = new Live(item)
        live.save(function(err) {
          if (err) {
            cb(err); return
          }
          util.log('saveLivesData...', item.pf, item.type, item.title, item.href, item.number)
          cb(null)
        })
      } else {
        cb(null)
      }
    }
  ], function(err) {
    callback(err)
  })
}

var saveLives = {
  '熊猫TV': function($, pf, type, callback) {
    async.eachSeries($('#sortdetail-container li a'), function(a, cb) {
      saveLiveData({
        pf:      pf,
        type:    type,
        href:    urlMap[pf].host + $(a).attr('href'),
        imgHref: $(a).children('.video-cover').children('.video-img').attr('data-original'),
        title:   $(a).children('.video-title').text(),
        name:    $(a).children('.video-info').children('.video-nickname').text(),
        number:  $(a).children('.video-info').children('.video-number').text()
      }, function(err) {
        if (err) {
          cb(err); return
        }
        cb(null)
      })
    }, function(err) {
      callback(err)
    })
  },
  '斗鱼': function($, pf, type, callback) {
    async.eachSeries($('#live-list-contentbox li a'), function(a, cb) {
      saveLiveData({
        pf:      pf,
        type:    type,
        href:    urlMap[pf].host + $(a).attr('href'),
        imgHref: $(a).children('.imgbox').children('img').attr('data-original'),
        title:   $(a).children('.mes').children('.mes-tit').children('.ellipsis').eq(0).text().replace(/^\r\n/, '').replace(/^\s+/, '').replace(/\s+$/, ''),
        name:    $(a).children('.mes').children('p').children('.dy-name').text(),
        number:  formatNumber($(a).children('.mes').children('p').children('.dy-num').text())
      }, function(err) {
        if (err) {
          cb(err); return
        }
        cb(null)
      })
    }, function(err) {
      callback(err)
    })
  }
}

var action = function(uri, pf, type, callback) {
  request
    .get(uri)
    .use(prefix)
    .use(nocache)
    .end(function(err, res) {
      if (err) {
        util.log('error', err); return
      }

      var $ = cheerio.load(res.text)
      saveLives[pf]($, pf, type, callback)
    })
}

var canRun = true
var task = function() {
  if (!canRun) {
     util.log('爬虫程序正在运行......'); return
  }
  util.log('爬虫程序开始运行......');
  canRun = false
  async.forEachOf(urlMap, function(value1, key1, cb1) {
    async.forEachOf(value1.kinds, function(value2, key2, cb2) {
      action(value2, key1, key2, cb2)
    }, cb1)
  }, function(err) {
    if (err) {
      util.log(err); return
    }

    util.log('爬虫程序爬行结束......')
    canRun = true
    return setTimeout(function() {
      util.log('---------------------------------------------------');
      return task()
    }, 1000 * 10)
  })
}
task()