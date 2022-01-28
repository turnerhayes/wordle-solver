const { promisify } = require('util');
const writeFile = promisify(require('fs').writeFile);
const axios = require('axios');
// const url = 'https://raw.githubusercontent.com/dwyl/english-words/master/words.txt';
const url = 'http://www.mieliestronk.com/corncob_lowercase.txt';

(async () => {
  const response = await axios({
    url,
  });

  const words = response.data.split(/\r?\n/).filter(
    (word) => /^[a-z]{5}$/.test(word)
  );

  // console.log(words.slice(0, 30));

  await writeFile('./word-list.json', JSON.stringify(words));
})();