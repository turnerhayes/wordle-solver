const puppeteer = require('puppeteer');
const { promisify } = require('util');
const writeFile = promisify(require('fs').writeFile);
const { analyzeWords } = require('./analyze_words');
const wordList = require('./word-list.json');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

class Solution {
  _available = new Set(ALPHABET);

  _availableByPosition = [
    new Set(ALPHABET),
    new Set(ALPHABET),
    new Set(ALPHABET),
    new Set(ALPHABET),
    new Set(ALPHABET),
  ];

  _correct = ['', '', '', '', ''];

  _misplaced = {};

  _letterCounts = ALPHABET.reduce((counts, letter) => {
    counts[letter] = 0;
    return counts;
  }, {});

  _misplacedByIndex = [];

  _regex = /[a-z]{5}/;

  correct(letter, indexes) {
    for (const index of indexes) {
      this._correct[index] = letter;
    }
    this._letterCounts[letter] = Math.max(this._letterCounts[letter] || 0, indexes.length);
  }

  misplaced(letter, indexes) {
    for (const index of indexes) {
      this._misplaced[letter] = this._misplaced[letter] || new Set();
      this._misplaced[letter].add(index);

      this._misplacedByIndex[index] = this._misplacedByIndex[index] || new Set();
      this._misplacedByIndex[index].add(letter);

      this._availableByPosition[index].delete(letter);
    }
    this._letterCounts[letter] = Math.max(this._letterCounts[letter] || 0, indexes.length)
  }

  incorrect(letter, indexes) {
    for (const index of indexes) {
      this._availableByPosition[index].delete(letter);
    }
    if (this._letterCounts[letter]) {
      this._letterCounts[letter] = Math.max(this._letterCounts[letter] - indexes.length, 0);
    }
    else {
      this._letterCounts[letter] = 0;
    }
    this._available.delete(letter);
  }

  hasLetter(letter) {
    return this._letterCounts[letter] > 0;
  }

  checkWord(word) {
    const passesRegex = this._regex.test(word);

    if (!passesRegex) {
      return false;
    }

    for (const misplaced of this._misplacedByIndex) {
      if (misplaced) {
        for (const letter of Array.from(misplaced)) {
          if (word.split('').filter((l) => l === letter).length < this._letterCounts[letter]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  updateRegex() {
    let regexString = '';
    for (let i = 0; i < this._correct.length; i++) {
      if (this._correct[i]) {
        regexString += this._correct[i];
      }
      else {
        regexString += `[${Array.from(this._availableByPosition[i]).join('')}]`;
      }
    }
    this._regex = new RegExp(`^${regexString}$`);
  }
}

function removeWordFromWordList(word) {
  const wordIndex = wordList.indexOf(word);
  wordList.splice(wordIndex, 1);
}

async function updateWordList() {
  await writeFile('./word-list.json', JSON.stringify(wordList));
}

function selectWord(words) {
  return words.shift();
}

async function getCurrentRow(board) {
  return await (
    (await board.$$('game-row[letters]:not([letters=""])')) || []
  ).pop();
}

async function clearRow(page, board, keys) {
  let backButton = null;
  for (let keyIndex = keys.length - 1; keyIndex >= 0; keyIndex--) {
    const keyName = await keys[keyIndex].evaluate((key) => key.getAttribute('data-key'));
    if (keyName === '←') {
      backButton = keys[keyIndex];
      break;
    }
  }
  if (!backButton) {
    throw new Error('Could not find backspace key');
  }

  const row = await getCurrentRow(board);

  let rowLetters = await row.evaluate((r) => r.getAttribute('letters'));

  while (rowLetters && rowLetters.length > 0) {
    await backButton.click();
    await page.waitForTimeout(100);
    rowLetters = await row.evaluate((r) => r.getAttribute('letters'));
  }
}

async function tryWord({
  word,
  solution,
  board,
  page,
  gameApp,
}) {
  const keyPressTimeoutMs = 100;
  for (let i = 0; i < word.length; i++) {
    board.type(word[i]);
    await page.waitForTimeout(keyPressTimeoutMs);
  }
  page.keyboard.press('Enter');

  let wordIsInList = true;
  try {
    await gameApp.waitForSelector('game-toast[text="Not in word list"]', {
      timeout: 3000,
    });
    wordIsInList = false;
    // Wait for the toast to disappear so we don't accidentally think the
    // next word we try is not in the word list.
    await gameApp.waitForSelector('game-toast[text="Not in word list"]', {
      hidden: true,
    });
  }
  catch (ex) {
    // Ignore timeout errors; we expect them when the word is recognized
    if (!ex.toString().startsWith('TimeoutError:')) {
      throw ex;
    }
  }
  if (!wordIsInList) {
    throw new Error(`Word ${word} is not in the word list`);
  }

  const wordRow = await getCurrentRow(board);
  if (wordRow) {
    const tiles = await wordRow.evaluate(
      (row) => Array.from(row.shadowRoot.querySelectorAll("div > game-tile")).map((tile) => {
        return {
          letter: tile.getAttribute('letter'),
          evaluation: tile.getAttribute('evaluation'),
        };
      })
    );
    const correct = {};
    const misplaced = {};
    const incorrect = {};
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.evaluation === 'correct') {
        correct[tile.letter] = (correct[tile.letter] || []).concat([i]);
      }
      else if (tile.evaluation === 'present') {
        misplaced[tile.letter] = (misplaced[tile.letter] || []).concat([i]);
      }
      else {
        incorrect[tile.letter] = (incorrect[tile.letter] || []).concat([i]);
      }
    }
    for (const letter of Object.keys(correct)) {
      solution.correct(letter, correct[letter]);
    }
    for (const letter of Object.keys(misplaced)) {
      solution.misplaced(letter, misplaced[letter]);
    }
    for (const letter of Object.keys(incorrect)) {
      if (!(letter in correct || letter in misplaced)) {
        solution.incorrect(letter, [0, 1, 2, 3, 4]);
      }
      else {
        solution.incorrect(letter, incorrect[letter]);
      }
    }
  }

  const winRow = await board.$('game-row[win]');

  if (winRow) {
    return true;
  }

  solution.updateRegex();
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
  });
  const pages = await browser.pages();
  const page = await (pages.length > 0 ? pages[0] : browser.newPage());

  await page.goto('https://www.powerlanguage.co.uk/wordle/');

  const popup = await page.evaluateHandle(
    'document.querySelector("body > game-app").shadowRoot.' +
    'querySelector("#game > game-modal")');

  if (popup) {
    popup.evaluate((b) => {
      b.click();
    });
  }

  const gameApp = await page.evaluateHandle('document.' +
    'querySelector("body > game-app").shadowRoot');

  const board = await gameApp.evaluateHandle((app) => app.querySelector("#board"));
  const keyboard = await gameApp.evaluateHandle(
    (app) => app.querySelector("#game > game-keyboard")
      .shadowRoot.querySelector("#keyboard"));
  const keys = await keyboard.$$('button');
  const solution = new Solution();
  const wordListSorted = analyzeWords(wordList);
  let words = [...wordListSorted];

  let win = false;

  const wordsToRemove = [];
  let winningWord = null;
  let guesses = 0;

  while (!win) {
    const word = selectWord(words);
    if (!word) {
      throw new Error('Unable to find a matching word');
    }

    try {
      guesses++;
      win = await tryWord({
        word,
        solution,
        board,
        page,
        gameApp,
      });
    }
    catch (ex) {
      console.error(ex);
      wordsToRemove.push(word);
      await clearRow(page, board, keys);
      continue;
    }

    if (win) {
      winningWord = word;
    }
    else {
      const currentRow = await getCurrentRow(board);
      if (!currentRow) {
        break;
      }
      words = words.filter((word) => solution.checkWord(word));
    }
  }

  if (wordsToRemove.length > 0) {
    for (const word of wordsToRemove) {
      removeWordFromWordList(word);
    }
    await updateWordList();
  }

  if (win) {
    console.log(`GOT IT! It was "${winningWord}". It took ${guesses} guesses.`);
  }
  else {
    console.log(`Rats! Couldn't guess it!`);
  }

  await browser.close();
})();