type CopyableIterator<T> = Iterator<T> & { copy: () => CopyableIterator<T> };

const copyableIterator = <T>(iterable: Iterable<T>): CopyableIterator<T> => {
  const iterator = iterable[Symbol.iterator]();

  const state: IteratorResult<T>[] = [];

  const _this = (start = 0): CopyableIterator<T> => {
    let i = start;
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
        return _this(i);
      },
    };
  };
  return _this();
};

type ParserState<T> = {
  recognize(p: (x: T) => boolean): T;
  accept(x: T): T;
  chain<A>(...xs: Parser<T, A>[]): A[];
  choice<A>(...xs: Parser<T, A>[]): A;
  run<A>(
    f: Parser<T, A>,
    options?:
      | { withDefault: A }
      | { replaceErrors: string[] }
      | { withErrors: string[] }
      | { withError: string }
  ): A;
};

type Parser<T, U> = (p: ParserState<T>) => U;

const createParser = <T>(input: Iterable<T>): ParserState<T> => {
  let state = copyableIterator(input);
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
    chain: (...parsers) => {
      return parsers.map((parser) => _this.run(parser));
    },
    choice: (...parsers) => {
      if (parsers.length === 0) {
        throw [];
      }
      const [parser, ...rest] = parsers;
      try {
        return createParser({ [Symbol.iterator]: state.copy }).run(parser);
      } catch (error) {
        return createParser({ [Symbol.iterator]: state.copy }).run(
          (p) => p.choice(...rest),
          { withError: error }
        );
      }
    },
    run: (parser, options) => {
      try {
        return parser(_this);
      } catch (errors) {
        if (options === undefined) {
          throw errors;
        }

        if ('withDefault' in options) {
          return options.withDefault;
        }

        let accumulatedErrors =
          'replaceErrors' in options ? options.replaceErrors : errors;

        if ('withErrors' in options) {
          accumulatedErrors = [...accumulatedErrors, ...options.withErrors];
        }
        if ('withError' in options) {
          accumulatedErrors = [...accumulatedErrors, options.withError];
        }
        throw accumulatedErrors;
      }
    },
  };
  return _this;
};

const p = createParser('AABABBAABBABABAA');

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

  const abba = p.run(abbaParser, {
    withError: "Can't find",
  });

  const cs = p.choice(
    (p) => p.accept('A'),
    (p) => p.accept('B'),
    abbaParser
  );

  // const rest = p.chain(abbaParser, abbaParser);

  return [a, a2, a3, abba, cs];
};

console.log(p.run(stuffParser));
