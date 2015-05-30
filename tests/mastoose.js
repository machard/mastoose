'use strict';

var assert = require('assert');
var async = require('async');
var _ = require('lodash');

var mongoose = require('mongoose');
var Mastoose = require('../src/mastoose');

var Model = mongoose.model('Model', new mongoose.Schema({
  _id : Number,
  ppte : String,
  ppte2 : String,
  ppte3 : String,
  nested : {
    ppte : String,
    ppte2 : String
  }
}));

var TopModel = mongoose.model('TopModel', new mongoose.Schema({
  populatePpte : {
    type : Number,
    ref : 'Model'
  },
  populatePpteArray : [{
    type : Number,
    ref : 'Model'
  }]
}));

var WithNestedArray = mongoose.model('WithNestedArray', new mongoose.Schema({
  nested : [Model.schema]
}));

function setup(done) {
  mongoose.connect(process.env.MASTOOSE_TEST_DB, function(err) {
    done(err, !err && mongoose.connection.db.dropDatabase());
  });
}

describe('Mastoose', function() {
  var mastoose, ctx;

  beforeEach(function() {
    mastoose = new Mastoose(mongoose);
    ctx = {
      hasRight0 : true
    };
  });

  it('should allow rules to be added in different calls', function() {
    mastoose.addRule(Model.schema, {
      a : true
    });
    mastoose.addRule(Model.schema, {
      b : true
    });

    assert(mastoose.getRule(Model.schema).a);
    assert(mastoose.getRule(Model.schema).b);
  });

  context('expose', function() {
    var model;

    beforeEach(function() {
      model = new Model({
        _id : 1,
        ppte : 'ppte',
        ppte2 : 'ppte2',
        ppte3 : 'ppte3',
        nested : {
          ppte : 'p',
          ppte2 : 'p2'
        }
      });
    });

    context('without expose rules', function() {
      it('should return all properties', function(done) {
        mastoose.expose(ctx, model, function(err, json) {

          assert(json.ppte);
          assert(json.ppte2);
          assert(json.ppte3);
          assert(json._id); // exposition is true by default

          assert(json.nested.ppte);
          assert(json.nested.ppte2);

          done();
        });
      });
    });

    context('with expose rules', function() {
      beforeEach(function() {
        mastoose.addRule(Model.schema, {
          expose : {
            ppte : false,
            ppte2 : function(ctx, callback) {
              assert.equal(this.schema, Model.schema);

              setTimeout(function() {
                callback(null, !ctx.hasRight0);
              });
            },
            ppte3 : function(ctx, callback) {
              assert.equal(this.schema, Model.schema);

              callback(null, ctx.hasRight0);
            },
            'nested.ppte' : false
          }
        });
      });

      it('should hide restricted properties from ctx', function(done) {
        mastoose.expose(ctx, model, function(err, json) {
          assert(!json.ppte);
          assert(!json.ppte2);
          assert(json.ppte3);
          assert(json._id); // exposition is true by default

          assert(!json.nested.ppte);
          assert(json.nested.ppte2);

          done();
        });
      });

      context('when passing a populated document', function() {
        var topModel;

        beforeEach(function(done) {
          topModel = new TopModel({
            populatePpte : 1,
            populatePpteArray : [1]
          });

          async.series([
            setup,
            _.bind(model.save, model),
            _.bind(topModel.populate, topModel, {path : 'populatePpte'}),
            _.bind(topModel.populate, topModel, {path : 'populatePpteArray'})
          ], done);
        });

        it('should hide restricted properties from ctx', function(done) {
          mastoose.expose(ctx, topModel, function(err, json) {
            assert(!json.populatePpte.ppte);
            assert(!json.populatePpte.ppte2);
            assert(json.populatePpte.ppte3);
            assert(json.populatePpte._id);

            assert(!json.populatePpte.nested.ppte);
            assert(json.populatePpte.nested.ppte2);

            assert(!json.populatePpteArray[0].ppte);
            assert(!json.populatePpteArray[0].ppte2);
            assert(json.populatePpteArray[0].ppte3);
            assert(json.populatePpteArray[0]._id);

            assert(!json.populatePpteArray[0].nested.ppte);
            assert(json.populatePpteArray[0].nested.ppte2);

            done();
          });
        });
      });

      context('when passing a model contained a nested array with subschema', function() {
        var withArrayModel;

        beforeEach(function() {
          withArrayModel = new WithNestedArray();
          withArrayModel.nested.push(model);
        });

        it('should hide restricted properties from ctx', function(done) {
          mastoose.expose(ctx, withArrayModel, function(err, json) {
            assert(!json.nested[0].ppte);
            assert(!json.nested[0].ppte2);
            assert(json.nested[0].ppte3);
            assert(json.nested[0]._id); // exposition is true by default

            assert(!json.nested[0].nested.ppte);
            assert(json.nested[0].nested.ppte2);

            done();
          });
        });
      });

      context('when passing a plain object containing document', function() {
        var obj;

        beforeEach(function() {
          obj = {model : model};
        });

        it('should hide restricted properties from ctx', function(done) {
          mastoose.expose(ctx, obj, function(err, json) {
            assert(!json.model.ppte);
            assert(!json.model.ppte2);
            assert(json.model.ppte3);
            assert(json.model._id);

            assert(!json.model.nested.ppte);
            assert(json.model.nested.ppte2);

            done();
          });
        });
      });
    });
  });

  context('allowsModification', function() {

    context('without allowsModification rules', function() {
      it('should return true for any ctx', function(done) {
        var model = new Model({ppte : 'p', ppte2 : 'p2', ppte3 : 'p3'});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(allowed);

          done();
        });
      });
    });

    context('with allowsModification rules', function() {
      beforeEach(function() {
        mastoose.addRule(Model.schema, {
          allowsModification : {
            ppte : false,
            ppte2 : function(ctx, callback) {
              assert.equal(this.schema, Model.schema);

              setTimeout(function() {
                callback(null, ctx.hasRight0);
              });
            },
            ppte3 : function(ctx, callback) {
              assert.equal(this.schema, Model.schema);

              callback(null, !ctx.hasRight0);
            },
            'nested.ppte' : false
          }
        });
      });

      it('should return false for ctx', function(done) {
        var model = new Model({ppte : 'ppte'});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(!allowed);

          done();
        });
      });

      it('should return false for ctx', function(done) {
        var model = new Model({ppte3 : 'ppte'});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(!allowed);

          done();
        });
      });

      it('should return false for ctx', function(done) {
        var model = new Model({nested : {ppte : 'ppte'}});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(!allowed);

          done();
        });
      });

      it('should return modified paths which are not allowed', function(done) {
        var model = new Model({ppte2 : 'p2', nested : {ppte : 'ppte'}});
        mastoose.allowsModification(ctx, model, function(err, allowed, fPaths) {
          assert.deepEqual(fPaths, ['nested', 'nested.ppte']);

          done();
        });
      });

      it('should return true for ctx', function(done) {
        var model = new Model({ppte2 : 'ppte'});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(allowed);

          done();
        });
      });

      it('should return true for ctx', function(done) {
        var model = new Model({_id : 1});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(allowed); // by defaul there is no protection

          done();
        });
      });

      it('should return false even if in a nested property', function(done) {
        var model = new WithNestedArray();
        model.nested.push({ppte3 : 'ppte'});
        mastoose.allowsModification(ctx, model, function(err, allowed) {
          assert(!allowed);

          done();
        });
      });
    });

  });

  context('allows', function() {

    context('without allows rules', function() {
      it('should return true for any ctx', function(done) {
        var model = new Model();
        mastoose.allows(ctx, model, 'command', function(err, allowed) {
          assert(allowed);

          done();
        });
      });
    });

    context('with allows rules', function() {
      beforeEach(function() {
        mastoose.addRule(Model.schema, {
          allows : {
            truthy : function(_ctx, callback) {
              assert.equal(ctx, _ctx);
              callback(null, true);
            },
            falsy : function(_ctx, callback) {
              assert.equal(ctx, _ctx);
              callback(null, false);
            }
          }
        });
      });

      it('should return false', function(done) {
        var model = new Model();
        mastoose.allows(ctx, model, 'falsy', function(err, allowed) {
          assert(!allowed);

          done();
        });
      });

      it('should return true', function(done) {
        var model = new Model();
        mastoose.allows(ctx, model, 'truthy', function(err, allowed) {
          assert(allowed);

          done();
        });
      });

    });

  });
});
