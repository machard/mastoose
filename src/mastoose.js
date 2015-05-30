'use strict';

require('es6-shim');
var _ = require('lodash');
var async = require('async');

//because async.filter does not deal with the err parameter in callback
function filter(arr, truth, callback) {
  async.reduce(arr, [], function(filtered, item, callback) {
    truth(item, function(err, isTrue) {
      callback(err, isTrue ? filtered.concat([item]) : filtered);
    });
  }, callback);
}

// (['key', 'nested'], value) ==> {key : {nested : value}}
function treeObject(path, value) {
  return _.reduceRight(path, function(value, key) {
    return _.object([[key, value]]);
  }, value);
}

// Mastoose
function Mastoose(mongoose) {
  var self = this;

  self.rules = new Map();
  self.mongoose = mongoose;

  _.bindAll(this);
}

Mastoose.prototype.addRule = function(schema, rules) {
  var self = this;

  if (self.getRule(schema)) {
    rules = _.merge(rules, self.getRule(schema));
  }

  self.rules.set(schema, rules);
};

Mastoose.prototype.getRule = function(schema) {
  var self = this;

  return self.rules.get(schema);
};

Mastoose.prototype.exposes = function(ctx, doc, path, callback) {
  var self = this;

  var rule = self.getRule(doc.schema);

  if (!rule || !rule.expose) {
    return callback(null, true);
  }

  var exposed = rule.expose[path];

  if (_.isFunction(exposed)) {
    return exposed.call(doc, ctx, callback);
  }

  return callback(null, exposed === undefined || exposed);
};

Mastoose.prototype.expose = function(ctx, doc, callback) {
  var self = this;

  if (doc instanceof self.mongoose.Document) {
    var paths = _.keys(doc.schema.paths);

    async.waterfall([
      function(callback) {
        self.access(ctx, doc, function(err, canAccess) {
          callback(err || (!canAccess && new Mastoose.CanNotAccess()));
        });
      },
      _.partial(filter, paths, _.partial(self.exposes, ctx, doc)),
      function(ePaths, callback) {
        async.map(ePaths, function(path, callback) {
          self.expose(ctx, doc.get(path), function(err, obj) {
            callback(err, treeObject(path.split('.'), obj));
          });
        }, callback);
      }
    ], function(err, treesObjects) {
      callback(err, _.merge.apply(_, treesObjects));
    });

    return;
  }

  if (_.isPlainObject(doc)) {
    return async.parallel(_.object(_.map(doc, function(value, path) {
      return [path, _.partial(self.expose, ctx, value)];
    })), callback);
  }

  if (_.isArray(doc)) {
    return async.map(doc, _.partial(self.expose, ctx), callback);
  }

  return callback(null, doc);
};

Mastoose.prototype.allowsPathModification = function(ctx, doc, path, callback) {
  var self = this;

  if (_.isArray(doc.get(path)) && doc.get(path)[0] instanceof self.mongoose.Document) {
    return async.map(doc.get(path), _.partial(self.allowsModification, ctx), function(err, results) {
      callback(err, _.reduce(results, function(pathAllowed, result) {
        return pathAllowed && result;
      }, true));
    });
  }

  var rule = self.getRule(doc.schema);

  if (!rule || !rule.allowsModification) {
    return callback(null, true);
  }

  var allowed = rule.allowsModification[path];

  if (_.isFunction(allowed)) {
    return allowed.call(doc, ctx, callback);
  }

  callback(null, allowed !== false);
};

Mastoose.prototype.allowsModification = function(ctx, doc, callback) {
  var self = this;

  var paths = _.keys(doc.schema.paths);

  filter(
    paths,
    _.partial(self.allowsPathModification, ctx, doc),
    function(err, aPaths) {
      var fPaths = _.difference(doc.modifiedPaths(), aPaths);

      callback(err, !fPaths.length, fPaths);
    }
  );
};

Mastoose.prototype.allows = function(ctx, doc, cmd, callback) {
  var self = this;

  var rule = self.getRule(doc.schema);

  if (!rule || !rule.allows || !rule.allows[cmd]) {
    return callback(null, true);
  }

  rule.allows[cmd].call(doc, ctx, callback);
};

Mastoose.prototype.access = function(ctx, doc, callback) {
  var self = this;

  var rule = self.getRule(doc.schema);

  if (!rule || !rule.access) {
    return callback(null, true);
  }

  if (_.isFunction(rule.access)) {
    return rule.access.call(doc, ctx, callback);
  }

  callback(null, rule.access !== false);
};

//Mastoose only error
Mastoose.CanNotAccess = function(message) {
  this.name = 'MastooseError';
  this.message = message || '';
  this.stack = (new Error()).stack;
};

module.exports = Mastoose;
