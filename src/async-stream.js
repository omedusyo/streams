
// ===Asynchronous Streams===
// adding Continuation Passing Style (CPS) to streams
// so we can do async stuff with them.

// tickEverySecond : Number -> AsyncStream[Number]
function tickEverySecond(initialValue) {
  // k stands for continuation
  return k => {
    setTimeout(() => {
      k({
        isDone: false,
        head: initialValue,
        tail: tickEverySecond(initialValue + 1),
      });
    }, 1000);
  };
}
exports.tickEverySecond = tickEverySecond;

// We'll switch the language.
// We will call such streams Producers.
// And the continuations passed to them we will call Consumers.
// so...
// tickEverySecond : Number -> Producer[Number]


// synchronous (123, 512, 715)
// syncStream0 : Stream[Int]
var syncStream0 = () => {
  return {
    isDone: false,
    head: 123,
    tail: () => {
      return {
        isDone: false,
        head: 512,
        tail: () => {
          return {
            isDone: false,
            head: 715,
            tail: () => {
              return { isDone: true };
            },
          };
        },
      };
    },
  };
};
exports.syncStream0 = syncStream0;

// same stream but done in CPS style
// asyncProducer0 : Producer[Int]
var asyncProducer0 = k => {
  k({
    isDone: false,
    head: 123,
    tail: k => {
      // note that I shadowed the previous continuation/consumer
      k({
        isDone: false,
        head: 512,
        tail: k => {
          k({
            isDone: false,
            head: 715,
            tail: k => {
              k({
                isDone: true
              });
            },
          });
        },
      });
    },
  });
};
exports.asyncProducer0 = asyncProducer0;

// printingConsumer : Consumer[A]
function printingConsumer(out) {
  if (out.isDone) {
    console.log("done!");
  } else {
    console.log(out.head);
    out.tail(printingConsumer);
  }
}
exports.printingConsumer = printingConsumer;
// Note how the consumer is also defined recursively

// An explicit way to combine a producer with a consumer.
//
// combine : Producer[A], Consumer[A] -> Eff[Unit]
function combine(producer, consumer) {
  return () => {
    producer(consumer);
  };
}

var example0 = combine(asyncProducer0, printingConsumer);
exports.example0 = example0;


// empty : Producer[A]
var empty = k => {
  return k({ isDone: true });
};
exports.empty = empty;


// countFrom : Nat -> Producer[Nat]
function countFrom(n) {
  return k => {
    k({
      isDone: false,
      head: n,
      tail: countFrom(n + 1),
    });
  };
}
exports.countFrom = countFrom;

var nats = countFrom(0);
exports.nats = nats;

// take : Nat, Producer[A] -> Producer[A]
function take(n, producer) {
  return k => {
    producer(out => {
      if (out.isDone) {
        k({ isDone: true });
      } else if (n <= 0) {
        k({ isDone: true });
      } else {
        k({
          isDone: false,
          head: out.head,
          tail: take(n - 1, out.tail),
        });
      }
    });
  };
}
exports.take = take;

// delayBy : Duration, Producer[A] -> Producer[A]
function delayBy(duration, producer) {
  return k => {
    producer(out => {
      setTimeout(() => {
        if (out.isDone) {
          k({ isDone: true });
        } else {
          k({
            isDone: false,
            head: out.head,
            tail: delayBy(duration, out.tail),
          })
        }
      }, duration);
    });
  };
}
exports.delayBy = delayBy;


// fromList : List[A] -> Producer[A]
function fromList(xs) {
  function helper(i) {
    return k => {
      if (i < xs.length) {
        k({
          isDone: false,
          head: xs[i],
          tail: helper(i + 1),
        });
      } else {
        k({ isDone: true });
      }
    };
  }
  return helper(0);
}
exports.fromList = fromList;

// concat : Producer[A], Producer[A] -> Producer[A]
function concat(producer0, producer1) {
  return k => {
    producer0(out => {
      if (out.isDone) {
        producer1(k);
      } else {
        k({
          isDone: false,
          head: out.head,
          tail: concat(out.tail, producer1),
        });
      }
    });
  };
}
exports.concat = concat;

// map : Producer[A], (A -> B) -> Producer[B]
function map(producer, f) {
  return consumer => {
    producer(out => {
      if (out.isDone) {
        consumer({ isDone: true });
      } else {
        consumer({
          isDone: false,
          head: f(out.head),
          tail: map(out.tail, f),
        });
      }
    });
  };
}
exports.map = map;

// filter : Producer[A], (A -> Bool) -> Producer[A]
function filter(producer, p) {
  function ignoreUntilFoundThen(consumer) {
    return out => {
      if (out.isDone) {
        consumer({ isDone: true });
      } else {
        if (p(out.head)) {
          consumer({
            isDone: false,
            head: out.head,
            tail: filter(out.tail, p),
          });
        } else {
          out.tail(ignoreUntilFoundThen(consumer));
        }
      }
    };
  };
  return consumer => {
    producer(ignoreUntilFoundThen(consumer));
  };
}
exports.filter = filter;

// zipWith : Producer[A], Producer[B], (A, B -> C) -> Producer[C]
function zipWith(producer0, producer1, f) {
  return consumer => {
    producer0(out0 => {
      if (out0.isDone) {
        consumer({ isDone: true });
      } else {
        producer1(out1 => {
          if (out1.isDone) {
            consumer({ isDone: true });
          } else {
            consumer({
              isDone: false,
              head: f(out0.head, out1.head),
              tail: zipWith(out0.tail, out1.tail, f),
            });
          }
        });
      }
    });
  };
}
exports.zipWith = zipWith;


// toListConsumer : Consumer[List[A]] -> Consumer[A]
function toListConsumer(consumer) {
  var xs = [];
  function newConsumer(out) {
    if (out.isDone) {
      consumer(xs);
    } else {
      xs.push(out.head);
      out.tail(newConsumer);
    }
  }
  return newConsumer;
}
exports.toListConsumer = toListConsumer;

// cons : A, Producer[A] -> Producer[A]
function cons(x, producer) {
  return consumer => {
    consumer({
      isDone: false,
      head: x,
      tail: producer,
    });
  };
}
exports.cons = cons;


// TODO: This is the first concurrency operation!
//       It runs two streams independently of each other
//       and pushes the messages onto a common "bus" stream
//
// I feel like if we allow this operation, it completely changes the nature of the stream...
// concurrentCompose : Producer[A], Producer[B] -> Producer[A + B]
function concurrentCompose(producer0, producer1) {
  return consumer => {
    // Note that this requires a non-linear use of the consumer... pretty weird
    producer0(consumer);
    producer1(consumer);
  };
}
exports.concurrentCompose = concurrentCompose;


// TODO: do random...
//       then compose concurrently...
