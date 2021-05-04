type CopyableIterator<T> = Iterator<T> & { copy: () => CopyableIterator<T> };

const copyableIterator = <T>(iterable: Iterable<T>): CopyableIterator<T> => {
  const iterator = iterable[Symbol.iterator]();

  const state: IteratorResult<T>[] = [];

  const _this = (): CopyableIterator<T> => {
    let i = 0;
    return {
      next: () => {
        if (i < state.length) {
          const current = state[i];
          i += 1;
          return current;
        } else {
          const current = iterator.next();
          state.push(current);
          i += 1;
          return current;
        }
      },
      copy: () => {
        return _this();
      },
    };
  };
  return _this();
};

type ParserState<T> = {
  recognize(p: (x: T) => boolean): T;
  accept(x: T): T;
  chain<A>(...xs: Parser<T, A>[]): A[];
  run<A>(f: Parser<T, A>, options?: { withError?: string }): A;
};

type Parser<T, U> = (p: ParserState<T>) => U;

const createParser = <T>(input: Iterable<T>): ParserState<T> => {
  let state = input[Symbol.iterator]();
  const _this: ParserState<T> = {
    recognize: (p: (x: T) => boolean) => {
      const { done, value: token } = state.next();
      if (done) {
        throw [`Expected token, but reached end of input`];
      }
      if (p(token)) {
        return token;
      } else {
        throw [`Found ${token}`];
      }
    },
    accept: (token: T) => {
      return _this.run((p) => p.recognize((x) => x === token), {
        withError: `Expected ${token}`,
      });
    },
    chain: () => {
      throw 'NOT IMPLEMENTED';
    },
    run: (parser, { withError } = {}) => {
      try {
        return parser(_this);
      } catch (errors) {
        if (withError !== undefined) {
          throw [...errors, withError];
        }
        throw errors;
      }
    },
  };
  return _this;
};

const p = createParser('AABABBABBABABAA');

const abbaParser = (p: ParserState<string>) => {
  const a1 = p.accept('A');
  const b1 = p.accept('B');
  const b2 = p.accept('B');
  const a2 = p.accept('A');
  return a1.concat(b1).concat(b2).concat(a2);
};

const stuffParser = (p: ParserState<string>) => {
  const a = p.accept('A');
  const a2 = p.accept('A');
  const a3 = p.accept('B');

  const abba = p.run(abbaParser, { withError: "Can't find abba" });

  return [a, a2, a3, abba];
};

console.log(p.run(stuffParser));
