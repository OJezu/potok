[![Build Status](https://travis-ci.org/OhJeez/potok.svg?branch=master)](https://travis-ci.org/OhJeez/potok) [![Coverage Status](https://coveralls.io/repos/OhJeez/potok/badge.svg)](https://coveralls.io/r/OhJeez/potok)


# TOC
   - [Potok](#potok)
     - [.prototype](#potok-prototype)
       - [.enter(promise)](#potok-prototype-enterpromise)
       - [.end()](#potok-prototype-end)
       - [.lazyEnd()](#potok-prototype-lazyend)
       - [.ended()](#potok-prototype-ended)
       - [.push(promise)](#potok-prototype-pushpromise)
       - [.finalPushResults()](#potok-prototype-finalpushresults)
       - [.chain(potok)](#potok-prototype-chainpotok)
       - [.failOnReject()](#potok-prototype-failonreject)
       - [.onlyFulfilled()](#potok-prototype-onlyfulfilled)
       - [.onlyRejected()](#potok-prototype-onlyrejected)
       - [.branch(potok)](#potok-prototype-branchpotok)
       - [.pipe](#potok-prototype-pipe)
     - [handlers](#potok-handlers)
       - [»beforeAll« handler](#potok-handlers-beforeall-handler)
       - [»each« handler](#potok-handlers-each-handler)
       - [»eachRejected« handler](#potok-handlers-eachrejected-handler)
       - [»afterAll« handler](#potok-handlers-afterall-handler)
       - [»all« handler](#potok-handlers-all-handler)
     - [.combine(potok[])](#potok-combinepotok)
   - [Stream](#stream)
     - [.chain()](#stream-chain)
<a name=""></a>
 
<a name="potok"></a>
# Potok
works with "new" in front.

```js
var each = function(){return true;};
var mp = new Potok({each: each});
mp._handlers.each.should.be.equal(each);
```

works without "new" in front.

```js
var each = function(){return true;};
var mp = Potok({each: each});
mp._handlers.each.should.be.equal(each);
```

accepts »beforeAll« handler.

```js
Potok({beforeAll: function(){}});
```

accepts »each« handler.

```js
Potok({each: function(){}});
```

accepts »eachFulfilled« handler.

```js
Potok({eachFulfilled: function(){}});
```

accepts »eachRejected« handler.

```js
Potok({eachRejected: function(){}});
```

accepts »afterAll« handler.

```js
Potok({afterAll: function(){}});
```

accepts »all« handler.

```js
Potok({all: function(){}});
```

accepts »all« handler, but not allows other handlers when it is set.

```js
var all = function(){};
try {
	Potok({all: all, each: all});
	throw new Error('unexpected success');
} catch (err){
	err.message.should.match(/»all« handler is declared/);
}
```

~mocks handlers when "all" handler is set.

```js
try{
	var all = function(){return true;};
	var mp = Potok({all: all});
	mp._handlers.afterAll.should.be.instanceOf(Function);
	mp._handlers.each.should.be.instanceOf(Function);
} catch (err){
	throw err;
}
```

not allows non-function handlers.

```js
var all = ':p';
try {
	Potok({all: all});
	throw new Error('Unexpected success.');
} catch (err){
	err.message.should.match(/handler »all« is not a function/i);
}
```

throws error when started without handlers argument.

```js
try {
	Potok();
	throw new Error('unexpected success');
} catch (err){
	err.message.should.match(/handlers must be an object/i);
}
```

not allows unknown handler names.

```js
try{
	Potok({uga: function(){}});
	throw new Error('unexpected success');
} catch (err){
	err.should.be.instanceof(Errors.PotokError);
}
```

can add promises with ».enter()«.

```js
var mp = Potok({
	eachFulfilled: function(input){ return input+'_fulfil';},
	eachRejected: function(input){ return input+'_reject';},
});
mp.enter('foo');
mp.enter(when.reject('bar'));
mp.end();
return when.all(mp.ended()).then(function(results){
	results.sort().should.be.deep.equal(['bar_reject', 'foo_fulfil']);
});
```

<a name="potok-prototype"></a>
## .prototype
<a name="potok-prototype-enterpromise"></a>
### .enter(promise)
rejects with WriteAfterEnd when called after end.

```js
var mp = Potok({});
mp.end().ended().done();
return mp.enter().then(function(){
	throw new Error('unexpected success');
}, function(err){
	err.should.be.instanceof(Errors.WriteAfterEnd);
});
```

passes through unhandled rejected promises.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var mp = new Potok({
	eachFulfilled: function(enter){return enter;},
});
for(var key in nv){
	mp.enter(nv[key]);
}
return when.settle(mp.end().ended()).then(function(res){
	res.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{reason: 'bar', state: 'rejected'},
	]);
});
```

passes through unhandled resolved promises.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var mp = new Potok({
	eachRejected: function(enter){return enter;},
});
for(var key in nv){
	mp.enter(nv[key]);
}
return when.settle(mp.end().ended()).then(function(res){
	res.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{value: 'bar', state: 'fulfilled'},
	]);
});
```

passes through all unhandled promises.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var mp = new Potok({});
for(var key in nv){
	mp.enter(nv[key]);
}
return when.settle(mp.end().ended()).then(function(res){
	res.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{reason: 'bar', state: 'rejected'},
	]);
});
```

can be quite recursive.

```js
var mp = new Potok({
	each: function(entry){
		return when(entry).then(function(entry){
			if(entry > 0){
				mp.enter(--entry);
				return entry+1;
			} else {
				mp.end();
				return entry;
			}
		});
	}
});
mp.enter(10);

return when.all(mp.ended()).then(function(result){
	result.should.be.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
});
```

can be quite recursive with lazy_end.

```js
var mp = new Potok({
	each: function(entry){
		return when(entry).then(function(entry){
			if(entry > 0){
				mp.enter(--entry);
				return entry+1;
			} else {
				return entry;
			}
		});
	}
});
mp.enter(10);
mp.lazyEnd();

return when.all(mp.ended()).then(function(result){
	result.should.be.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
});
```

<a name="potok-prototype-end"></a>
### .end()
waits for all tasks to finish.

```js
var tasks = 0;
var each = function(result){
	return when(true).delay(2).tap(function(){
		++tasks;
	});
};
var mp = Potok({each: each});
mp.enter('foo');
mp.enter('bar');
return mp.end().ended().then(function(){
	tasks.should.be.equal(2);
});
```

waits for »beforeAll« handler before ending.

```js
var before_all_finished = false;
var mp = Potok({
	beforeAll: function(){
		return when().delay(3).tap(function(){
			before_all_finished = true;
		});
	}
});

return mp.end().ended().then(function(){
	before_all_finished.should.be.true;
});
```

waits for all tasks to finish before calling afterAll.

```js
var tasks = 0;
var each = function(result){
	return when(true).delay(2).tap(function(){
		++tasks;
	});
};
var after_all_called = false;

var mp = Potok({
	each: each,
	afterAll: function(){
		after_all_called = true;
		tasks.should.be.equal(2);
	}
});
mp.enter('foo');
mp.enter('bar');
return mp.end().ended().then(function(){
	after_all_called.should.be.true;
	tasks.should.be.equal(2);
});
```

creates result in a form of array of all promises that do not resolve to null.

```js
var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer'), when.resolve(null)];

var mp = Potok({});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(result){
	return when.settle(result).then(function(res){
		res.should.be.deep.equal([
			{value: 'foo', state: 'fulfilled'},
			{reason: 'bar', state: 'rejected'},
			{value: 'baz', state: 'fulfilled'},
			{reason: 'fer', state: 'rejected'},
		]);
		return true;
	});
});
```

passes result to »afterAll« handler.

```js
var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer'), when.resolve(null)];

var after_all_called = false;

var mp = Potok({
	afterAll: function(res){
		return when.settle(res).then(function(res){
			res.should.be.deep.equal([
				{value: 'foo', state: 'fulfilled'},
				{reason: 'bar', state: 'rejected'},
				{value: 'baz', state: 'fulfilled'},
				{reason: 'fer', state: 'rejected'},
			]);
			after_all_called = true;
			return true;
		});
	}
});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(){
	after_all_called.should.be.true;
});
```

not passes nulls.

```js
var entries = [
	when.resolve(null),
	when.reject(null),
	when.resolve('baz'),
	when.reject('fer'),
];
var mp = Potok({});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(result){
	return when.settle(result).then(function(res){
		res.should.be.deep.equal([
			{reason: null, state: 'rejected'},
			{value: 'baz', state: 'fulfilled'},
			{reason: 'fer', state: 'rejected'},
		]);
		return true;
	});
});
```

passes nulls when »pass_nulls« option is on.

```js
var entries = [
	when.resolve(null),
	when.reject(null),
	when.resolve('baz'),
	when.reject('fer'),
];
var mp = Potok({}, {pass_nulls: true});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(result){
	return when.settle(result).then(function(res){
		res.should.be.deep.equal([
			{value: null, state: 'fulfilled'},
			{reason: null, state: 'rejected'},
			{value: 'baz', state: 'fulfilled'},
			{reason: 'fer', state: 'rejected'},
		]);
		return true;
	});
});
```

<a name="potok-prototype-lazyend"></a>
### .lazyEnd()
<a name="potok-prototype-ended"></a>
### .ended()
returns promise that will resolve once Potok is ended.

```js
var mp = Potok({}, {});
mp.end();
return mp.ended();
```

resolves with full output in a form of array of promises for all tasks which did not resolve to null.

```js
var mp = Potok({
	afterAll: function(){
		mp.finalPushResult('baw');
		mp.finalPushResult(null);
		return 'baz';
	}
});
mp.enter('foo');
mp.enter(null);
mp.enter('bar');
mp.end();
return mp.ended().then(function(result){
	return when.all(result).then(function(res){
		res.should.be.deep.equal(['foo', 'bar', 'baw']);
	});
});
```

resolves with full output in a form of array of promises for all tasks if »pass_nulls« option is on.

```js
var mp = Potok({
	afterAll: function(){
		mp.finalPushResult('baw');
		mp.finalPushResult(null);
	}
}, {pass_nulls: true});
mp.enter('foo');
mp.enter(null);
mp.enter('bar');
mp.end();
return mp.ended().then(function(result){
	return when.all(result).then(function(res){
		res.should.be.deep.equal(['foo', null, 'bar', 'baw', null]);
	});
});
```

<a name="potok-prototype-pushpromise"></a>
### .push(promise)
adds things to the output thing.

```js
var entries = [
	when.resolve('foo'),
	when.resolve('baz'),
];

var mp = Potok({
	eachFulfilled: function(entry){
		mp.push(entry+'_2');
		return entry;
	}
});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(result){
	return when.all(result).then(function(result){
		result.sort().should.be.deep.equal(['baz', 'baz_2', 'foo', 'foo_2']);
	});
});
```

adds rejected things to the output thing.

```js
var entries = [
	when.resolve('foo'),
	when.resolve('baz'),
];

var mp = Potok({
	eachFulfilled: function(entry){
		mp.push(when.reject(entry+'_2'));
		return entry;
	}
});

entries.forEach(mp.enter, mp);

return mp.end().ended().then(function(result){
	return when.settle(result).then(function(res){
		res.sort(function(a, b){return (a.value || a.reason).localeCompare(b.value || b.reason);});
		//yeah, I know localeCompare is slow.
		
		res.should.be.deep.equal([
	  						{value: 'baz', state: 'fulfilled'},
	  						{reason: 'baz_2', state: 'rejected'},
	  						{value: 'foo', state: 'fulfilled'},
	  						{reason: 'foo_2', state: 'rejected'},
	  					]);
	});
});
```

throws WriteAfterEnd after end finished waiting for tasks.

```js
var mp = Potok({});
return mp.end().ended()
.then(function(){
	return mp.push('bar_2');
}).then(function(){
	throw new Error('unwated success');
}, function(error){
	error.should.be.instanceof(Errors.WriteAfterEnd);
});
```

is included in output even if called asynchronously in handler.

```js
var mp = Potok({
	each: function(entry){
		when().then(mp.push.bind(mp, 'bar_2')).done();
		return entry;
	}
	
});
mp.enter('bar');
return mp.end().ended().then(function(result){
	return when.all(result).then(function(result){
		result.should.be.deep.equal(['bar', 'bar_2']);
	});
});
```

<a name="potok-prototype-finalpushresults"></a>
### .finalPushResults()
<a name="potok"></a>
# Potok
<a name="potok-handlers"></a>
## handlers
<a name="potok-handlers-beforeall-handler"></a>
### »beforeAll« handler
is called when Potok is constructed.

```js
var beforeAll = function(){
	done();
};

Potok({beforeAll: beforeAll});
```

can add promises with ».enter()«.

```js
var mp;
var beforeAll = function(){
	mp.enter('foo');
	mp.enter(when.reject('bar'));
	mp.end();
	return null;
};

mp = Potok({
	beforeAll: beforeAll,
	eachFulfilled: function(input){ return input+'_fulfil';},
	eachRejected: function(input){ return input+'_reject';},
});
return when.all(mp.ended()).then(function(results){
	results.sort().should.be.deep.equal(['bar_reject', 'foo_fulfil']);
});
```

»each« handler waits until it finishes.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var before_finished = false;
var beforeAll = function(){
	return when().delay(4).tap(function(){
		before_finished = true;
	});
};
var each = function(){
	if(!before_finished){
		done(new Error('Before has not finished yet!'));
	}
	return null;
};
var mp = Potok({
	each: each,
	beforeAll: beforeAll
});
mp.enter(nv.foo);
mp.enter(nv.bar);
return mp.end().ended().yield().done(done, done);
```

»eachRejected« and »eachFulfiled« handler waits until it finishes.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var before_finished = false;
var beforeAll = function(){
	return when().delay(4).tap(function(){
		before_finished = true;
	});
};
var each = function(){
	if(!before_finished){
		done(new Error('Before has not finished yet!'));
	}
	return null;
};
var mp = Potok({
	eachRejected: each,
	eachFulfilled: each,
	beforeAll: beforeAll
});
mp.enter(nv.foo);
mp.enter(nv.bar);
return mp.end().ended().yield().done(done, done);
```

<a name="potok-handlers-each-handler"></a>
### »each« handler
is called on each promise.

```js
var nv = ['foo', 'bar', 'foobar'];
var each = function(result){
	return when(result).then(function(result){
		nv = nv.filter(function(e){return e !== result;});
		if(nv.length ===0) {
			done();
		}
		return true;
	});
};
var mp = Potok({each: each});
mp.enter('foo');
mp.enter(when('bar'));
mp.enter(when('foobar'));
mp.enter(when.reject('rejected!'));
```

its called with promise as the argument.

```js
var mp = Potok({
	each: function(promise){
		return when.isPromiseLike(promise);
	}
});

['foo', when.reject('bar'), when('foobar')].forEach(mp.enter, mp);

return when.all(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([true, true, true]);
});
```

its results are in the outcome.

```js
var vals = ['foo', when.reject('bar'), when('foobar')];
var i=0;
var mp = Potok({
	each: function(promise){
		return vals[i++];
	}
});
mp.enter('your');
mp.enter('mom');
mp.enter('haha');
return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{reason: 'bar', state: 'rejected'},
		{value: 'foobar', state: 'fulfilled'},
	]);
});
```

if it returns null, promise is removed from the outcome.

```js
var i=0;
var mp = Potok({
	each: function(promise){
		return (i++)%2 ? null : promise;
	},
});

['foo', when('foobar'), when.reject('bar')].forEach(mp.enter, mp);

return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{reason: 'bar', state: 'rejected'},
	]);
});
```

if it returns null when »pass_nulls« option is on, null is in result.

```js
var i=0;
var mp = Potok({
	each: function(promise){
		return (i++)%2 ? null : promise;
	},
}, {pass_nulls: true});

['foo', when('foobar'), when.reject('bar')].forEach(mp.enter, mp);

return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([
		{value: 'foo', state: 'fulfilled'},
		{value: null, state: 'fulfilled'},
		{reason: 'bar', state: 'rejected'},
	]);
});
```

if it rejects rejection (even null) it is in the outcome.

```js
var mp = Potok({
	each: function(promise){
		return when.reject(null);
	},
});

['foo', when('foobar')].forEach(mp.enter, mp);

return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([
		{reason: null, state: 'rejected'},
		{reason: null, state: 'rejected'},
	]);
});
```

<a name="potok-handlers-eachrejected-handler"></a>
### »eachRejected« handler
is called on each rejected promise.

```js
var nv = ['foo', 'bar', 'foobar'];
var eachRejected = function(result){
	return when(result).then(function(result){
		nv = nv.filter(function(e){return e !== result;});
		if(nv.length ===0) {
			done();
		}
		return true;
	});
};
var mp = Potok({eachRejected: eachRejected});
mp.enter(when.reject('foo'));
mp.enter(when.reject('bar'));
mp.enter(when.reject('foobar'));
mp.enter(when.resolve('fulfilled!'));
```

if it returns null, promise is removed from the outcome.

```js
var mp = Potok({
	eachRejected: function(promise){
		return null;
	},
});

[when.reject('foo'), when.reject('foobar')].forEach(mp.enter, mp);

return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([]);
});
```

if it rejects rejection (even null) it is in the outcome.

```js
var mp = Potok({
	eachRejected: function(promise){
		return when.reject(null);
	},
});

[when.reject('foo'), when.reject('foobar')].forEach(mp.enter, mp);

return when.settle(mp.end().ended()).then(function(result){
	result.should.be.deep.equal([
		{state: 'rejected', reason: null},
		{state: 'rejected', reason: null},
	]);
});
```

<a name="potok-handlers-afterall-handler"></a>
### »afterAll« handler
is called when Potok is constructed.

```js
var beforeAll = function(){
	done();
};

Potok({beforeAll: beforeAll});
```

<a name="potok-handlers-all-handler"></a>
### »all« handler
<a name="potok"></a>
# Potok
<a name="potok-prototype"></a>
## .prototype
<a name="potok-prototype-chainpotok"></a>
### .chain(potok)
accepts another Potok as sole argument.

```js
var mp_a = Potok({});
var mp_b = Potok({});
mp_a.chain(mp_b);
```

actually accepts anything with »enter« and »end« methods.

```js
var mp_a = Potok({});
var mp_b = {enter: function(){}, end: function(){}};
mp_a.chain(mp_b);
```

but not accepts anything else.

```js
var mp_a = Potok({});
var mp_b = {enter: function(){}, end: 'foo'};
try {
	mp_a.chain(mp_b);
	throw new Error('Unexpected error');
} catch(err) {
	err.should.be.instanceof(Errors.PotokError);
}
```

returns its argument.

```js
var mp_a = Potok({});
var mp_b = {enter: function(){}, end: function(){}};
mp_a.chain(mp_b).should.be.equal(mp_b);
```

fires handlers of chained Potok as soon as possible.

```js
var hits = 0;
var mp_a = Potok({});
var mp_b = Potok({each: function(){++hits;}});
mp_a.chain(mp_b);
mp_a.enter('foo');
mp_a.enter('bar');
return when().delay(2).then(function(){
	hits.should.be.equal(2);
	mp_a.end();
});
```

propagates end to chained Potok.

```js
var mp_a = Potok({});
var mp_b = Potok({afterAll: function(){done();}});
mp_a.chain(mp_b);
mp_a.end();
```

propagates entries and »end« even if chain happened after end.

```js
var hits = 0;
var after_all_called = false;
var mp_a = Potok({});
var mp_b = Potok({
	afterAll: function(){
		after_all_called = true;
		return null;
	},
	each: function(value){
		++hits;
		return value;
	}
});
mp_a.enter('foo');
mp_a.end();
return mp_a.chain(mp_b).ended().then(function(result){
	hits.should.be.equal(1);
	after_all_called.should.be.true;
});
```

spropagates errors.

```js
var mp_a = Potok({});
var mp_b = Potok({});
mp_a.enter(when.reject('foo'));
mp_a.end();

return when.all(mp_a.chain(mp_b).ended()).then(function(){
	throw new Error('Unwanted success');
}, function(error){
	error.should.be.equal('foo');
});
```

passes result of earlier »afterAll« handler to chained Potok.

```js
var mp_a = Potok({
	afterAll: function(){
		mp_a.finalPush('after_all_pushed');
		return 'after_all';
	}
});
var mp_b = Potok({
	each: function(value){
		return value;
	}
});
mp_a.enter('foo');
mp_a.end();
return mp_a.chain(mp_b).ended().then(function(result){
	return when.all(result).then(function(result){
		result.sort().should.be.deep.equal(['after_all', 'after_all_pushed', 'foo']);
	});
});
```

not passes nulls.

```js
var mp_a = Potok({});
var mp_b = Potok({}, {pass_nulls: true});
mp_a.enter('foo');
mp_a.enter(null);
mp_a.end();
return mp_a.chain(mp_b).ended().then(function(result){
	return when.all(result).then(function(result){
		result.should.be.deep.equal(['foo']);
	});
});
```

passes nulls if »pass_nulls« option is on.

```js
var mp_a = Potok({}, {pass_nulls: true});
var mp_b = Potok({}, {pass_nulls: true});
mp_a.enter('foo');
mp_a.enter(null);
mp_a.end();
return mp_a.chain(mp_b).ended().then(function(result){
	return when.all(result).then(function(result){
		result.should.be.deep.equal(['foo', null]);
	});
});
```

does not complain if chained multi_promise is ended.

```js
var mp_a = Potok({});
var mp_b = Potok({});

mp_a.chain(mp_b);
mp_b.end();
return mp_a.enter('foo');
```

passes through »null« promise just before receiver ends.

```js
var mp_a = Potok({}, {pass_nulls: true});
var mp_b = Potok({}, {pass_nulls: true});

mp_a.chain(mp_b);
mp_a.enter(null);
mp_b.end();
mp_a.end();
return mp_b.ended().then(function(result){
	return when.all(result).then(function(result){
		result.should.be.deep.equal([null]);
	});
});
```

<a name="potok"></a>
# Potok
<a name="potok-prototype"></a>
## .prototype
<a name="potok-prototype-failonreject"></a>
### .failOnReject()
returns promise.

```js
var potok = Potok({});
return when.isPromiseLike(potok.failOnReject()).should.be.true;
```

if there are no rejected tasks returns promise fulfilling with the array of tasks.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter(when('bar'));
potok.end();
return potok.failOnReject().then(function(result){
	result.sort().should.be.deep.equal([
		'bar',
		'foo'
	]);
});
```

if any task was rejected returns promise rejecting with one of the rejection reasons.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter(when.reject('bar'));
potok.end();
return potok.failOnReject().then(function(result){
	throw new Error('Unwated success.');
}, function(error){
	error.should.be.equal('bar');
});
```

if some task were rejected returns promise rejecting with one of the rejection reasons.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter(when.reject('bar'));
potok.enter(when.reject('foobar'));
potok.end();
return potok.failOnReject().then(function(result){
	throw new Error('Unwated success.');
}, function(error){
	error.should.satisfy(function(e){
		return e === 'bar' || e === 'foobar';
	});
});
```

<a name="potok-prototype-onlyfulfilled"></a>
### .onlyFulfilled()
returns promise.

```js
var potok = Potok({});
return when.isPromiseLike(potok.onlyFulfilled()).should.be.true;
```

returns promise resolving to array of results of all tasks that fulfilled.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter(when('bar'));
potok.enter(when.reject('foobar'));
potok.end();
return potok.onlyFulfilled().then(function(result){
	result.sort().should.be.deep.equal([
		'bar',
		'foo'
	]);
});
```

if no tasks where fullfiled, resolves to empty array.

```js
var potok = Potok({});
potok.enter(when.reject('foo'));
potok.enter(when.reject('bar'));
potok.end();
return potok.onlyFulfilled().then(function(result){
	result.should.be.deep.equal([]);
});
```

<a name="potok-prototype-onlyrejected"></a>
### .onlyRejected()
returns promise.

```js
var potok = Potok({});
return when.isPromiseLike(potok.onlyRejected()).should.be.true;
```

returns promise resolving to array of results of all tasks that fulfilled.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter(when('bar'));
potok.enter(when.reject('foobar'));
potok.enter(when.reject('spam'));
potok.end();
return potok.onlyRejected().then(function(result){
	result.sort().should.be.deep.equal([
		'foobar',
		'spam',
	]);
});
```

if no tasks where rejected, resolves to empty array.

```js
var potok = Potok({});
potok.enter('foo');
potok.enter('bar');
potok.end();
return potok.onlyRejected().then(function(result){
	result.should.be.deep.equal([]);
});
```

<a name="potok"></a>
# Potok
<a name="potok-prototype"></a>
## .prototype
<a name="potok-prototype-branchpotok"></a>
### .branch(potok)
returns original potok.

```js
var potok = Potok({});
var potok_b = Potok({});
potok.branch(potok_b).should.be.equal(potok);
```

passes tasks to branch.

```js
var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
var potok = Potok({});
var potok_b = Potok({each:function(promise){
	return promise
		.otherwise(function(error){return error;})
		.then(function(i){
			delete nv[i];
		});
}});

potok_b.ended().then(function(){
	Object.keys(nv).length.should.be.equal(0);
}).yield().done(done, done);

for(var key in nv){
	potok.enter(nv[key]);
}
potok.end();
potok.branch(potok_b).should.be.equal(potok);
```

<a name="potok"></a>
# Potok
<a name="potok-combinepotok"></a>
## .combine(potok[])
ends immediately if there are no potoki to combine.

```js
var combined = Potok.combine([]);
return combined.ended();
```

returns a potok.

```js
var combined = Potok.combine([]);
combined.end();
combined.should.be.instanceof(Potok);
```

accepts multiple potoki, not throw and end.

```js
var combined = Potok.combine([
	Potok({}).end(),
	Potok({}).end(),
	Potok({}).end(),
]);
return combined.ended();
```

collects promises from multiple potoki.

```js
var potok_a = Potok({});
var potok_b = Potok({});
var potok_c = Potok({});

potok_a.enter('foo');
potok_b.enter(when.reject('bar'));
potok_c.enter(when('foobar'));
potok_c.enter(when.reject('spam'));
potok_a.end();
potok_b.end();
potok_c.end();

var combined = Potok.combine([potok_a, potok_b, potok_c]);
return when.settle(combined.ended()).then(function(result){
	result.sort(sortPromises).should.be.deep.equal([
		{state: 'rejected',  reason: 'bar'},
		{state: 'fulfilled', value:  'foo'},
		{state: 'fulfilled', value:  'foobar'},
		{state: 'rejected',  reason: 'spam'},
	]);
});
```

collects promises from multiple potoki, even if one potok is delayed a tad.

```js
var potok_a = Potok({});
var potok_b = Potok({});
var potok_c = Potok({});

potok_a.enter('foo');
potok_b.enter(when.reject('bar'));

potok_a.end();
potok_b.end();
when().delay(2).then(function(){
	potok_c.enter(when('foobar'));
	potok_c.enter(when.reject('spam'));
	return potok_c.end();
}).done();

var combined = Potok.combine([potok_a, potok_b, potok_c]);
return when.settle(combined.ended()).then(function(result){
	result.sort(sortPromises).should.be.deep.equal([
		{state: 'rejected',  reason: 'bar'},
		{state: 'fulfilled', value:  'foo'},
		{state: 'fulfilled', value:  'foobar'},
		{state: 'rejected',  reason: 'spam'},
	]);
});
```

<a name="stream"></a>
# Stream
has .chain() method in prototype.

```js
Stream.prototype.chain.should.be.a('function');
```

exposes .chain() method on various streams.

```js
var stream = fs.createReadStream(__filename, {flags: 'r'});
stream.chain.should.be.a('function');
```

<a name="stream-chain"></a>
## .chain()
does not work on streams not in object mode.

```js
var stream = fs.createReadStream(__filename, {flags: 'r'});
stream.chain.bind(stream).should.throw(Errors.PotokError);
```

can be called as method of stream in object mode.

```js
var stream = through.obj(function(chunk, enc, cb){});
stream.chain(Potok({}));
```

sends through objects to chained potok.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){cb(undefined, chunk);});
stream.chain(
	Potok({
		each: function(promise){
			return when(promise).then(function(value){
				items = items.filter(function(entry){
					return entry !== value;
				});
				if(items.length === 0){
					done();
				}
			});
		},
	})
).ended().done(undefined, done);

items.forEach(stream.write, stream);
```

sends through errors to chained potok as rejections.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){cb(chunk, undefined);});
stream.chain(
	Potok({
		each: function(promise){
			return when(promise).catch(function(value){
				items = items.filter(function(entry){
					return entry !== value;
				});
				if(items.length === 0){
					done();
				}
			});
		},
	})
).ended().done(undefined, done);

items.forEach(stream.write, stream);
```

propagates end.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){cb(undefined, chunk);});
items.forEach(stream.write, stream);
stream.end();
return stream.chain(Potok({})).ended();
```

<a name="potok"></a>
# Potok
<a name="potok-prototype"></a>
## .prototype
<a name="potok-prototype-pipe"></a>
### .pipe
sends through fulfilled promises to piped stream.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){
	items = items.filter(function(item){return chunk !== item;});
	if(items.length === 0){
		done();
	}
	cb();
});

var potok = Potok({});
potok.pipe(stream);
items.forEach(potok.enter, potok);
```

sends through rejected promises to piped stream as errors.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){cb();});
stream.on('error', function(chunk){
	items = items.filter(function(item){return chunk !== item;});
	if(items.length === 0){
		done();
	}
});

var potok = Potok({});
potok.pipe(stream);
items.map(when.reject).forEach(potok.enter, potok);
```

propagates end.

```js
var items = ['foo', 'bar', 'foobar'];
var stream = through.obj(function(chunk, enc, cb){cb();});

var potok = Potok({});
potok.pipe(stream);
stream.on('end', done);
stream.on('error', done);

items.forEach(potok.enter, potok);
potok.end();
stream.resume();
```

