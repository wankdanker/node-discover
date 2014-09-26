var encrypt = require('../lib/encrypt-stream')('asdf');
var decrypt = require('../lib/decrypt-stream')('asdf');

process.stdin.pipe(encrypt).pipe(decrypt).pipe(process.stdout);

