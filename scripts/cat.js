// Runs when someone opens a "cat|feed" / "cat|play" / "cat|pet" issue (or one of the secret ones).
const fs = require('fs');
const cat = require('./cat-core');
const { fetchAvatar } = require('./avatar');

// "cat|feed" from the buttons, or just "feed" when someone types the title by hand.
const title = (process.env.ISSUE_TITLE || '').trim().toLowerCase();
const action = (title.startsWith('cat|') ? title.slice(4) : title).trim();
const user = process.env.ISSUE_USER;
const now = new Date();

(async () => {
  const st = cat.load();
  cat.decay(st, now);
  let reply = cat.unknownReply();
  if (cat.ALL[action]) {
    cat.setAvatar(user, await fetchAvatar(user));
    reply = cat.apply(st, action, user, now);
    cat.writeSticker(st, user);
  }
  cat.writeAll(st, now);
  require('./lib').stampReadme();
  fs.writeFileSync(process.env.REPLY_FILE || 'reply.md', reply);
  console.log(reply);
})().catch(e => { console.error(e); process.exit(1); });
