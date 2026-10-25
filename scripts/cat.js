// Runs when someone opens a "cat|feed" / "cat|play" / "cat|pet" issue.
const fs = require('fs');
const cat = require('./cat-core');

const action = (process.env.ISSUE_TITLE || '').split('|')[1]?.trim().toLowerCase();
const user = process.env.ISSUE_USER;
const now = new Date();

const st = cat.load();
cat.decay(st, now);
const reply = cat.ACTIONS[action]
  ? cat.apply(st, action, user, now)
  : 'Huna tilts her head. She only knows `feed`, `play` and `pet`. Try a button on the profile!';
cat.writeAll(st, now);
fs.writeFileSync(process.env.REPLY_FILE || 'reply.md', reply);
console.log(reply);
