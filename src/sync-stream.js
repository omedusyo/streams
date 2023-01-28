
// ===Synchronous Lazy Streams===

// stream analogue of the list (123, 512, 715)
// example0 : Stream[Int]
var example0 = () => ({
  isDone: false,
  head: 123,
  tail: () => ({
    isDone: false,
    head: 512,
    tail: () => ({
      isDone: false,
      head: 715,
      tail: () => ({
        isDone: true,
      }),
    }),
  }),
});
exports.example0 = example0;

// Hence streams are lazy objects of two sorts:
//  1. A stream that's not finished yet
//     { isDone: false, head: some_val0, tail: some_other_stream0 }
//  2. A finished stream (empty stream)
//     { isDone: true }
//
// If we had types, we would define a recursive type
//   type Stream[A] :=
//     Unit ->
//         Done
//       | Continues(head: A, tail: Stream[A])
//
// If in our type system we actually tracked effects with e.g.
//   type Effect[A] := Unit -> A
// then we could define the stream type that supports effects as
//
//   type Stream[A] :=
//     Effect(Done | Continues(head: A, tail: Stream[A]))
// i.e.
//   type Stream[A] :=
//     Effect(
//         Done
//       | Continues(
//           A,
//           Effect(
//              Done
//            | Continues(
//                A,
//                Effect(...)
//              )
//         )
//     )
// i.e. a lazy stream
//   is either done or it continues with a value in A and another lazy stream that is either done or it continues with a value in A or a lazy straem ...

// Note that some streams are finite - they eventually reach the Done state.
// And some are infinite - they can be unfolded without bounds never reaching the Done state.

// TODO: We could generalize streams to have two tails... then we would have a branching stream instead of a linear stream

// empty : Stream[A]
// empty == ()
var empty = () => ({ isDone: true });
exports.empty = empty;

// cons : A, Stream[A] -> Stream[A]
function cons(x, stream) {
  return () => {
    return {
      isDone: false,
      head: x,
      tail: stream,
    };
  };
}
exports.cons = cons;

// singleton : A -> Stream[A]
function singleton(x) {
  return cons(x, empty);
}
exports.singleton = singleton;

// countFrom : Nat -> Stream[Nat]
// countFrom(n) == (n, n + 1, n + 2, ...)
function countFrom(n) {
  return () => {
    return {
      isDone: false,
      head: n,
      tail: countFrom(n + 1),
    };
  };
}
exports.countFrom = countFrom;


// nats : Stream[Int]
//
// This is an infinite stream.
//   nats == (0, 1, 2, 3, ...)
var nats = countFrom(0);
exports.nats = nats;

// take : Nat, Stream[A] -> Stream[A]
function take(n, stream) {
  return () => {
    var out = stream();
    if (out.isDone || n <= 0) {
      return { isDone: true };
    } else {
      return {
        isDone: false,
        head: out.head,
        tail: take(n - 1, out.tail),
      };
    }
  };
}
exports.take = take;

// A finite stream
// firstTenNats == (0, 1, 2, ..., 9)
var firstTenNats = take(10, nats);

// Stream[A] -> Strema[A]
//
// note tail(empty) == empty
function tail(stream) {
  return () => {
    var out0 = stream();
    if (out0.isDone) {
      return { isDone: true };
    } else {
      var out1 = out0.tail();
      return out1;
    }
  };
}
exports.tail = tail;


// toList : Stream[A] -> Effect(List[A])
function toList(stream) {
  return () => {
    let xs = [];
    let out = stream();
    while (!out.isDone) {
      xs.push(out.head);
      out = out.tail();
    }
    return xs;
  };
}
exports.toList = toList;


// [3, 4, 5, 6, 7, 8, 9]
var example1 = toList(tail(tail(tail(firstTenNats))))
exports.example1 = example1;

var example2 = toList(cons(1, cons(2, cons(3, empty))));
exports.example2 = example2;

// concat : Stream[A], Stream[A] -> Stream[A]
function concat(stream0, stream1) {
  return () => {
    var out = stream0();
    if (out.isDone) {
      return stream1();
    } else {
      return {
        isDone: false,
        head: out.head,
        tail: concat(out.tail, stream1),
      };
    }
  };
}
exports.concat = concat;

// fromList : List[A] -> Stream[A]
// TODO: This implementation is very wrong! The stream value is not referentially transparent!
// function fromList(xs) {
//   return () => {
//     var state = xs;
//     if (state.length === 0) {
//       return { isDone: true };
//     } else {
//       var x = xs.shift();
//       return {
//         isDone: false,
//         head: x,
//         tail: fromList(xs),
//       };
//     }
//   };
// }
function fromList(xs) {
  function helper(i) {
    return () => {
      if (i < xs.length) {
        return {
          isDone: false,
          head: xs[i],
          tail: helper(i + 1),
        };
      } else {
        return { isDone: true };
      }
    };
  }
  return helper(0);
}
exports.fromList = fromList;

var example3 = toList(fromList([1, 2, 3]));
exports.example3 = example3;

var example4 = toList(concat(fromList([1,2,3]), fromList([10,20,30])));
exports.example4 = example4;

var example5 = toList(take(3, concat(nats, fromList([10,20,30]))));
exports.example5 = example5;



// (x0, x1, x2, ...) ~> (f(x0), f(x1), f(x2), ...)
// map : Stream[A], (A -> B) -> Stream[B]
function map(stream, f) {
  return () => {
    var out = stream();
    if (out.isDone) {
      return { isDone: true };
    } else {
      return {
        isDone: false,
        head: f(out.head),
        tail: map(out.tail, f),
      };
    }
  };
}
exports.map = map;

var example6 = toList(take(10, map(nats, x => x*x)));
exports.example6 = example6;

// Define[Recursive definition of continuous stream]
// Say
//   a stream is continuous (finitary)
// :iff
//   it takes finite time to compute the head and the tail is a continuous stream
//
// Filtering is unlike the previous stream operators.
// The filtering can turn a continous stream into a non-continuous stream.
// e.g. you can filter the stream (0, 1, 2, 3, ...) for all negative numbers
// and when we try to compute the head of this filtered stream, it will turn into an infiniet loop.
//
// filter : Stream[A], (A -> Bool) -> Stream[A]
function filter(stream, p) {
  return () => {
    var out = stream();
    if (out.isDone) {
      return { isDone: true };
    } else {
      while (!p(out.head)) {
        out = out.tail();
      }
      // here we know for sure that p(out.head) holds
      return {
        isDone: false,
        head: out.head,
        tail: filter(out.tail, p),
      };
    }
  };
}
exports.filter = filter;

var example7 = toList(take(10, filter(nats, x => x % 2 == 0)));
exports.example7 = example7;

// this has the same discontinous phenomenon as filter
// findFirst : Stream A, (A -> Bool) -> Eff (Maybe A)
function findFirst(stream, p) {
  return () => {
    var out = stream();
    while (!out.done) {
      if (p(out.head)) {
        return { found: true, val: out.head };
      }
      out = out.tail();
    }
    return { found: false };
  };
}
exports.findFirst = findFirst;


// andThen : Stream[A], (A -> Stream[B]) -> Stream[B]
function andThen(stream, f) {
  return () => {
    var out = stream();
    if (out.isDone) {
      return { isDone: true };
    } else {
      return concat(f(out.head), andThen(out.tail, f))();
    }
  };
}
exports.andThen = andThen;

var example8 = toList(take(10, andThen(nats, x => fromList([x, -x]))));
exports.example8 = example8;

// Note that this first queries stream0, then stream1.
// i.e. it is from left to right.
// It's not concurrent!
// zipWith : Stream[A], Stream[B], (A, B -> C) -> Stream[C]
function zipWith(stream0, stream1, f) {
  return () => {
    var out0 = stream0();
    if (out0.isDone) {
      return { isDone: true };
    } else {
      var out1 = stream1();
      if (out1.isDone) {
        return { isDone: true }
      } else {
        var y = f(out0.head, out1.head);
        return {
          isDone: false,
          head: y,
          tail: zipWith(out0.tail, out1.tail, f),
        };
      }
    }
  };
}
exports.zipWith = zipWith;

var example9 = toList(take(10, zipWith(nats, map(nats, x => x + 1), (x, y) => [x, y])));
exports.example9 = example9;

// x ~> (x, x, x, ...)
// repeat : A -> Stream[A]
function repeat(x) {
  return () => {
    return {
      isDone: false,
      head: x,
      tail: repeat(x),
    };
  };
}
exports.repeat = repeat;

var example10 = toList(take(5, repeat(10)))
exports.example10 = example10;

// This function takes a stream and just loops through it until it is finished (or it loops to infinity)
// drain : Stream[A], (A -> Unit) -> Effect(Unit)
function drain(stream, f=(_ => undefined)) {
  return () => {
    var out = stream();
    while (!out.isDone) {
      f(out.head);
      out = out.tail();
    }
  };
}
var forEach = drain;
exports.drain = drain;
exports.forEach = forEach;

var example11 = forEach(take(10, nats), x => console.log(x));
exports.example11 = example11;

// repeatFromEffect : Effect[A] -> Stream[A]
function repeatFromEffect(effect) {
  return () => {
    var a = effect();
    return {
      isDone: false,
      head: a,
      tail: repeatFromEffect(effect),
    }
  };
}
exports.repeatFromEffect = repeatFromEffect;

// stream : Stream[A]
// initialState : State
// update : A, State -> State
// fold(stream, initialState, update) : Stream[State]
//
// also called accumulate.
function fold(stream, currentState, update) {
  function helper(stream, previousState, update) {
    return () => {
      var out = stream();
      if (out.isDone) {
        return { isDone: true };
      } else {
        var newState = update(out.head, previousState);
        return {
          isDone: false,
          head: newState,
          tail: helper(out.tail, newState, update),
        };
      }
    };
  }
  return () => ({
    isDone: false,
    head: currentState,
    tail: helper(stream, currentState, update),
  });
}
exports.fold = fold;


// lastOrElse : Stream[A], A -> Effect[A]
function lastOrElse(stream, defaultVal) {
  return () => {
    var out = stream();
    var last = defaultVal;
    while (!out.isDone) {
      last = out.head;
      out = out.tail();
    }
    return last;
  };
}
exports.lastOrElse = lastOrElse;

var example12 = lastOrElse(take(100000, fold(nats, 0, (n, state) => state + n)), "empty");
exports.example12 = example12;

// You can compare this to
// var sum0 = 0;
// for (let i = 0; i < 100000 - 1; i++) {
//   sum0 += i;
// }


// iterate : (A -> A), A -> Stream[A]
function iterate(f, state) {
  function helper(previousState) {
    var newState = f(previousState);
    return () => ({
      isDone: false,
      head: newState,
      tail: helper(newState),
    });
  }
  return () => ({
    isDone: false,
    head: state,
    tail: helper(state),
  });
}
exports.iterate = iterate;

// Stream[A], Stream[A] -> Stream[A]
// Stream[A], Stream[B] -> Stream[A + B]
function interleave(stream0, stream1) {
  return () => {
    var out0 = stream0();
    if (out0.isDone) {
      return stream1();
    } else {
      return {
        isDone: false,
        head: out0.head,
        tail: interleave(stream1, out0.tail),
      };
    }
  };
}
exports.interleave = interleave;

// repeatStream : Stream[A] -> Stream[A]
function repeatStream(streamToBeRepeated) {
  function repeatNonEmptyStream(stream) {
    // Inside of this function we can assume that `streamToBeRepeated` is non empty
    return () => {
      var out0 = stream();
      if (out0.isDone) {
        var out1 = streamToBeRepeated();
        return {
          isDone: false,
          head: out1.head,
          tail: repeatNonEmptyStream(out1.tail),
        };
      } else {
        return {
          isDone: false,
          head: out0.head,
          tail: repeatNonEmptyStream(out0.tail),
        };
      }
    };
  }
  return () => {
    var out = streamToBeRepeated();
    if (out.isDone) {
      return { isDone: true };
    } else {
      return {
        isDone: false,
        head: out.head,
        tail: repeatNonEmptyStream(out.tail),
      };
    }
  };
}
exports.repeatStream = repeatStream;

var example13 = toList(take(10, repeatStream(fromList([0,1,2]))));
exports.example13 = example13;



// TODO: Define Uniformly Continuous streams (bounded streams?)
// TODO: Continuous can be turned into discontinous
// TODO: Implement filter in terms on findFirst
// TODO: Explain prime sieve, what happens at runtime in terms of findFirst
//
// TODO: Try to implement a predicate on streams that determines if the stream is all zeroes or not.
//
// TODO: Implement a stream parser.
// TODO: Can we do regex operations on streams? (_)^*, (_)^+ easy...
// while loops, for loops... what about if-then-else... branching?
// what about comonad structure? Does that make sense? probably no... atleast for empty streams...
// Suppose M is a monoid, what additional structure does Stream[M] have?
//
// Can we think of streams as actors? Can we spawn, fork, join???
// What about mutable reference? Can that be modeled with a stream?
// Or you know... Elm app?
//
// modeling resources? locks/files?
//
// concurrency...
//   given two streams, I want to somehow run them independently of each other
//   and create a "bus" stream   all(stream0, stream1)
//   Then the stream `all(stream0, stream1)` will produce when one of the streams produces...
//   But obviously this doesn't apply to sync streams. Because the consumer has control over when
//   to ask. This needs to be an operation over async streams.
