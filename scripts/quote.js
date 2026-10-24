// assets/quote.svg — `fortune | catsay`, a new dev/anime quote every day. Add your own to QUOTES.
const L = require('./lib');
const { C, CW, X0, esc, wrap } = L;

const QUOTES = [
  ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
  ['First, solve the problem. Then, write the code.', 'John Johnson'],
  ['Simplicity is prerequisite for reliability.', 'Edsger W. Dijkstra'],
  ['Make it work, make it right, make it fast.', 'Kent Beck'],
  ['Premature optimization is the root of all evil.', 'Donald Knuth'],
  ['Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', 'Martin Fowler'],
  ['Deleted code is debugged code.', 'Jeff Sickel'],
  ['Programs must be written for people to read, and only incidentally for machines to execute.', 'Harold Abelson'],
  ['It works on my machine.', 'every developer, ever'],
  ['Weeks of coding can save you hours of planning.', 'ancient proverb'],
  ['There is no place like 127.0.0.1', 'sysadmin wisdom'],
  ['The best code is the code that ships.', 'Ali Hussain'],
  ['A lesson without pain is meaningless.', 'Edward Elric, Fullmetal Alchemist'],
  ['Whatever happens, happens.', 'Spike Spiegel, Cowboy Bebop'],
  ['You should enjoy the little detours to the fullest.', 'Ging Freecss, Hunter x Hunter'],
  ['If you don\'t take risks, you can\'t create a future.', 'Monkey D. Luffy, One Piece'],
  ['El Psy Kongroo.', 'Okabe Rintaro, Steins;Gate'],
  ['Plus Ultra!', 'All Might, My Hero Academia'],
  ['I\'m not gonna run away, I never go back on my word!', 'Naruto Uzumaki, Naruto'],
  ['Push through the pain. Giving up hurts more.', 'Vegeta, Dragon Ball Z'],
  ['People\'s dreams... never end!', 'Marshall D. Teach, One Piece'],
  ['If you win, you live. If you lose, you die. Fight!', 'Eren Yeager, Attack on Titan'],
  ['meow.', 'Byte, resident cat'],
];

// cowsay-style speech bubble.
function bubble(text, author) {
  const body = [...wrap(text, 56), '', `    -- ${author}`];
  const w = Math.max(...body.map(l => l.length));
  const pad = l => l + ' '.repeat(w - l.length);
  const edge = (i, n) => n === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === n - 1 ? ['\\', '/'] : ['|', '|'];
  return [
    ' ' + '_'.repeat(w + 2),
    ...body.map((l, i) => { const [a, b] = edge(i, body.length); return `${a} ${pad(l)} ${b}`; }),
    ' ' + '-'.repeat(w + 2),
  ];
}

function renderQuote(date = new Date()) {
  const [text, author] = QUOTES[Math.floor(date.getTime() / 86400000) % QUOTES.length];
  const T = L.typer();
  const lines = bubble(text, author);
  const top = 104, LH = 20;
  const catY = top + lines.length * LH;
  const H = catY + 3 * LH + 30;
  const line = (s, y, fill) => `<text x="${X0}" y="${y}" fill="${fill}" xml:space="preserve" textLength="${[...s].length * CW}" lengthAdjust="spacing">${esc(s)}</text>`;
  const slide = (d, s) => `<g class="slide" style="animation-delay:${d.toFixed(2)}s">${s}</g>`;
  const cat = [
    ['        \\   /\\_/\\', null],
    ['         \\ ( o.o )', '         \\ ( -.- )'],
    ['            > ^ <   ', null],
  ];
  const n = lines.length;
  const body = `
${T.command(74, 'fortune ~/quotes | catsay', 0.2, 1, 1)}
${lines.map((s, i) => slide(1 + i * 0.05, line(s, top + i * LH, i === n - 2 ? C.pink : C.text))).join('\n')}
${cat.map(([a, b], i) => {
    const y = catY + i * LH, d = 1 + (n + i) * 0.05;
    return b
      ? slide(d, `<g class="ea">${line(a, y, C.key)}</g><g class="eb">${line(b, y, C.key)}</g>`)
      : slide(d, line(a, y, C.key));
  }).join('\n')}`;
  const css = `
.ea{animation:ea 4s 2s steps(1,end) infinite}
.eb{opacity:0;animation:eb 4s 2s steps(1,end) infinite}
@keyframes ea{0%{opacity:1}92%{opacity:0}97%{opacity:1}}
@keyframes eb{0%{opacity:0}92%{opacity:1}97%{opacity:0}}
${T.css()}`;
  return L.chrome({ w: 900, h: H, title: 'fortune — today\'s wisdom', body, css, emberCount: 6, seed: 23 });
}

module.exports = { renderQuote };
