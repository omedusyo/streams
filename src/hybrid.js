

// =======Producers===========

// Signal[A] (Aggressive Producer)
//   an aggressive streaming producer
//   retains control
//   the consumer must be passive and be 
//   prepared to receive output from the signal at any time.

//   example. Mouse x,y coordinates?
//            Keyboard input

// Stream[A] (Passive Producer)
//   a producer that produces on demand of the client.
//   The client is in control (aggressive), client can asks for output at any time,
//   and then once it gets it, can ask for more...

// =======Consumers===========
// Subscriber[A] (Passive Consumer)
//   the consumer is prepared to receive output from the signal at any time.

// Client[A] (Aggressive Consumer)
//   the consumer requests data from the stream.
//   And he can do it whenever he wants.




// Interactions
//   Aggressive Producer pushes stuff to Passive Consumer
//       Signal ~> Subscriber

//   PassiveProducer is pulled from by the Aggressive Consumer
//       Stream ~> Client



// ========Combination==========
// You could have a thing that starts off
//   1. passive consumer i.e. it waits for someone to give it a value of type A
//   2. once it gets it, suddenly there is an inversion of control and it becomes
//      an aggressive producer of B

// Arr[A, B]
//   looks like a function

// What is the dual object doing?
//   1. aggressive producer of A, and then it becomes
//   2. passive consumer of B
//   looks like function application
// Feels like chat



// Another one...
//   1. passive producer of A, but once someone requests a value of it
//   2. aggressive consumer of B


// countFrom : Number -> ProducerArrow[Count, List[Number]]
function countFrom(x) {
  return N => {
    let state = x;
    const xs = [];
    for (let i = 0; i < N; i++) {
      xs.push(state);
      state += 1;
    }
    return {
      isDone: false,
      head: xs,
      tail: countFrom(state),
    };
  };
}
exports.countFrom = countFrom;

var nats = countFrom(0)
exports.nats = nats;


function asyncCountFrom(x) {
  return N => consumer => {
    let state = x;
    let xs = [];
    for (let i = 0; i < N; i++) {
      xs.push(state)
      state += 1;
    }
    consumer({
      done: false,
      head: xs,
      tail: asyncCountFrom(state),
    })
  };
}

var asyncNats = asyncCountFrom(0);

asyncNats(5)(out => {
  console.log(out.head);
  out.tail(4)(out => {
    console.log(out.head);
    out.tail(8)(out => {
      console.log(out.head);
    });
  });
});


