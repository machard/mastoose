#Mastoose


**Mastoose** (Master of Mongoose) is a utility that helps to deal with exposition and modification rules for Mongoose documents.

It allows to declare models access/modification logic in one place and not to worry of creating security issues when using them.

It's designed to be part of a **resource reflection** library.

Unlike some other libs, **it does not require to define rules directly in the model schema**.

It supports **nested schemas, sub-models and aggregated/populated documents**.

[![Build Status](https://travis-ci.org/machard/mastoose.svg?branch=master)](https://travis-ci.org/machard/mastoose)
[![Coverage Status](https://coveralls.io/repos/machard/mastoose/badge.svg?branch=master)](https://coveralls.io/r/machard/mastoose?branch=master)
[![npm version](https://badge.fury.io/js/mastoose.svg)](http://badge.fury.io/js/mastoose)
[![Dependency Status](https://david-dm.org/machard/mastoose.svg)](https://david-dm.org/machard/mastoose)
[![devDependency Status](https://david-dm.org/machard/mastoose/dev-status.svg)](https://david-dm.org/machard/mastoose#info=devDependencies)

---

##Initialisation
You need to pass the mongoose instance you use.

```
var mastoose = new Mastoose(mongoose);
```


##Defining rules

Given this model

```
var Model = mongoose.model('Model', new mongoose.Schema({
  ppte : String,
  ppte2 : String,
  nested : {
    ppte : String,
    ppte2 : String
  },
  to : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : User.modelName
  }]
}));
```

We define rules for Model and User


```
mastoose.addRule(Model, {
	
  // define if this model can be accessed
  access : true/false/function(ctx, callback) {
	// `this` is the current model instance
	callback(err, true/false);
  },
   
  // define if a property should be exposed (by default all properties are exposed)
  exposes : {
    // boolean
    ppte : false/true,

    // or a function with a callback
    'nested.ppte' : function(ctx, callback) {
    	// `this` is the current model instance
        callback(err, true/false);
    }
  },    
  
  // define which paths can be modified (by default all are)
  allowsModification : {
    ppte : false/true,

    'nested.ppte' : function(ctx, callback) {
    	// `this` is the current model instance
        callback(err, true/false);
    }
  },
  
  // define authorizations for calling methods (by default all are)
  allows : {
  	method1 : true/false,
  	method2 : function(ctx, callback) {
  		// `this` is the current model instance
        callback(err, true/false);
  }
});

mastoose.addRule(User, {...});
```

## Using Mastoose

- Exposing a document

You can pass any kind of documents/objects. Mastoose will apply the `exposes` rules accordingly.

```
var ctx = {user : user, ... };
mastoose.expose(ctx, data, function(err, data_clean) {
  res.json(data_clean);
});
```

internally it uses the rule `access`. it will raise an error if a document in `data` should not be accessed.


- Protecting a document modification/creation

You can check if pending modifications of a document (new or not) are allowed by the rules. Based on Mongoose `isModified` property.

```
mastoose.allowsModification(ctx, doc, function(err, allowed) {
  if (allowed) {
    model.save();
  }
})
```

- Protecting a document method

You can check if a method can be used

```
mastoose.allows(ctx, doc, 'method', function(err, allowed) {
  if (allowed) {
    model.save();
  }
})
```


## Use it with Expoose

- linking them

```
var expoose = new Expoose(mongoose);

// command checker

expoose.on('command', function(method, req, model, callback) {
  if (method !== 'save') {
    mastoose.allows(req.user, model, method, function(err, allows) {
      callback(err || (!allows && new restify.NotAuthorizedError()));
    });
    return;
  }

  mastoose.allowsModification(req.user, model, function(err, allows) {
    callback(err || (!allows && new restify.NotAuthorizedError()));
  });
});

// data filtering

expoose.on('expose', function(req, data, callback) {
  mastoose.expose(req.user, data, function(err, filtered_data) {
  	callback(err, filtered_data);
  });
});

// error management

expoose.on('error', function(err, res) {
  if (err instanceof Mastoose.errors.CanNotAccess) {
    err = new restify.NotAuthorizedError();
  }

  if (!(err instanceof restify.HttpError)) {
    switch (err.type) {
      case 'InvalidArgument':
        err = new restify.InvalidArgumentError(err.message);
        break;
      default :
        err = new restify.InternalError(err.message);
    }
  }

  res.json(err);
});
```

- using Expoose without worrying to make security mistakes

```
server
  .get(
    '/users/:user_id',
    middlewares.get('me'),
    expoose.detail(User, {id : 'user_id'})
  );

server
  .post(
    'users',
    expoose.insert(User)
  );

server.get(
  '/users',
  expoose.list(User)
);

server
  .del(
    'users/:user_id',
    expoose.remove(User, {id : 'user_id'})
  );
  
server
  .get(
    '/users/:user_id/discussions',
    middlewares.get('me'),
    expoose.method(User, 'discussions', {id : 'user_id'})
  );

```

**The idea is that all validations and eventual reactions to models changes are handled thanks to mongoose hooks and/or plugins.
It allows to make a nice model/event driven API.**


**Expoose** has currently not been open sourced. Some work is still needed.