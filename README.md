#Potok

Potok is a promise-based replacement for object stream. Potok instance accepts values (or promises which resolution) will be processed by user-defined handlers.

* [Documentation (so far, auto-generated from unit tests)](doc/api.md)
* [cujojs/when - Promise implementation Potok is using](https://github.com/cujojs/when)

###Potoki are using promises
```javascript
var potok_a = Potok({each: function(promise){ return promise.then(process); } });
potok_a.enter(Promise.resolve('foo'));
potok_a.enter('foo');
potok_a.enter(Promise.reject(new Error('bar')));
assert(when.isPromiseLike(potok_a.ended()));
```

###Potoki are indempotent
When chaining, it does not matter how many promises potok you are chaining to already 

The following:
```javascript
potok_a.chain(potok_b);
potok_a.enter('foo');
potok_a.end();
```
```javascript
potok_a.enter('foo');
potok_a.end();
potok_a.chain(potok_b);
```
```javascript
potok_a.chain(potok_b);
setTimeout(function(){
	potok_a.enter('foo');
    potok_a.end();
}, Math.random()*10000);
```
```javascript
potok_a.enter('foo');
potok_a.end();
setTimeout(function(){potok_a.chain(potok_b);}, Math.random()*10000);
```
all have the same effect: same promises will be passed through both `potok_a` and `potok_b`.

###Potoki are chainable

```javascript
var potok_a = new Potok({ eachFulfilled:function(e){return e+' was here!';} });
var potok_b = new Potok({ eachFulfilled:funcion(e){console.log(e); return e;} });

potok_a.enter('foo');
potok_a.enter('bar');
potok_a.chain(potok_b);
potok_a.end();
```
will log:
```
foo was here!
bar was here!
```

###Potoki have built-in error handling
Any rejected task will go through from the point it was entered into the chain to the end, passing through all `each` and `eachRejected` handlers.

```javascript
var potok_a = new Potok({}); //no-op potok, just because, pass through
var potok_b = new Potok({
	// do something only with fullfiled tasks
	eachFulfilled: function(value){
    	console.log('%s has passed here!', value); return value;
    }
});
var potok_c = new Potok({
	// do something only with rejected tasks
	eachRejected: function(error){
    	console.log('Oh noes! %s', error.message);
        // null by default is removed from potok
        return null;
    }
});

potok_a.chain(potok_b).chain(potok_c);
potok_a.enter('foo');
potok_a.enter(when.reject(new Error('All your errs is behandled')));
potok_a.enter('bar');

// .end ends the potok, and .ended returns a promise that will resolve
// when potok_a's handlers work is done
potok_a.end().ended().done()
```

###Potoki can be filtered
```javascript
var potok = new Potok({});

//returns promise for array with only rejected results
potok.onlyRejected(); 

//returns promise for array with only fulfilled results
potok.onlyFulfilled(); 

//returns promise for either all fulfilled results, or with a rejection reason if any task rejected
potok.failOnReject(); 
```

###Potoki can be combined
```javascript
var potok_a = Potok({});
var potok_b = Potok({});
var potok_c = Potok({});

potok_a.enter('foo');
potok_b.enter('bar');
potok_c.enter('baz');

potok_a.end();
potok_b.end();
potok_c.end();

var combined = Potok.combine([potok_a, potok_b, potok_c]);

when.all(combined.ended()).then(console.log);
```
Outputs `[ 'foo', 'bar', 'baz' ]`.
