const wordList = require('./word-list.json');

function calculateWordScore(word, letterFrequencies) {
  let score = 0;
  for (let i = 0; i < word.length; i++) {
    score += letterFrequencies[word[i]];
  }
  const distinctLetters = new Set(word.split('')).size;
  return score * distinctLetters;
}

function analyzeWords(words) {
  const letterFrequencies = {};

  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      letterFrequencies[word[i]] = (letterFrequencies[word[i]] || 0) + 1;
    }
  }

  // console.log(letterFrequencies);

  const wordScores = {};

  for (const word of words) {
    wordScores[word] = calculateWordScore(word, letterFrequencies);
  }
  // console.log(wordScores);

  const sortedWords = Object.keys(wordScores).sort((a, b) => wordScores[b] - wordScores[a]);

  // console.log(sortedWords.slice(0, 10).map((word) => `${word} (${wordScores[word]})`).join('\n'));

  return sortedWords
}

// analyzeWords(wordList);

module.exports = {
  analyzeWords,
};