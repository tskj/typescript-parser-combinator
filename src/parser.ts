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

  chain<A>(...parsers: Parser<T, A>[]): A[];
  choice<A>(...parsers: Parser<T, A>[]): A;

  option<A>(parser: Parser<T, A>): A[];
  many<A>(parser: Parser<T, A>): A[];
  repeat<A>(parser: Parser<T, A>): A[];

  run<A>(
    f: Parser<T, A>,
    options?:
      | { withDefault: A }
      | { replaceErrors: string[] }
      | { withErrors: string[] }
      | { withError: string }
      | { bindError: (errors: string[]) => Parser<T, A> }
  ): A;
};

type Parser<T, U> = (p: ParserState<T>) => U;

const createParser = <T>(input: Iterable<T>): ParserState<T> => {
  let stream = copyableIterator(input);
  const s: ParserState<T> = {
    recognize: (p: (x: T) => boolean) => {
      const { done, value: token } = stream.next();
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
      return s.run((s) => s.recognize((x) => x === token), {
        withError: `Expected ${token}`,
      });
    },

    chain: (...parsers) => {
      return parsers.map((parser) => s.run(parser));
    },
    choice: (...parsers) => {
      if (parsers.length === 0) {
        throw [];
      }
      const [parser, ...rest] = parsers;
      return s.run(parser, {
        bindError: (errors) => (s) =>
          s.run((s) => s.choice(...rest), { withErrors: errors }),
      });
    },

    option: (parser) => {
      return s.run(
        (s) => {
          const parsed = s.run(parser);
          return [parsed];
        },
        {
          bindError: (errors) => (s) => [],
        }
      );
    },
    many: (parser) => {
      return s.run((s) => s.repeat(parser), {
        bindError: (errors) => (s) => [],
      });
    },
    repeat: (parser) => {
      const parsed = s.run(parser);
      const restParsed = s.many(parser);
      return [parsed, ...restParsed];
    },

    run: (parser, options) => {
      try {
        parser(createParser({ [Symbol.iterator]: stream.copy }));
        return parser(s);
      } catch (errors) {
        if (options === undefined) {
          throw errors;
        }

        if ('bindError' in options) {
          return options.bindError(errors)(s);
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
  return s;
};

const s = createParser('AABABBAABBABABAA');

const abbaParser = (s: ParserState<string>) => {
  const a1 = s.accept('A');
  const b1 = s.accept('B');
  const b2 = s.accept('B');
  const a2 = s.accept('A');
  return a1.concat(b1).concat(b2).concat(a2);
};

const stuffParser = (s: ParserState<string>) => {
  const a = s.accept('A');
  const a2 = s.accept('A');
  const a3 = s.accept('B');

  const abba = s.run(abbaParser, {
    withError: "Can't find",
  });

  const cs = s.choice(
    (s) => s.accept('B'),
    (s) => s.accept('A'),
    abbaParser
  );

  const bs = s.repeat((s) => s.accept('B'));
  const none = s.many((s) => s.accept('B'));
  const as = s.many((s) => s.accept('A'));

  const noA = s.option((s) => s.accept('A'));
  const anB = s.option((s) => s.accept('B'));

  // const rest = p.chain(abbaParser, abbaParser);

  return [a, a2, a3, abba, cs, bs, none, as, noA, anB];
};

console.log(s.run(stuffParser));
