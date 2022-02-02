# Wordle Solver

This repo contains a script that attempts to solve [Wordle](https://www.powerlanguage.co.uk/wordle/) puzzles.

## Running the script

Run `npm start`. The script will run until it succeeds or fails. If it succeeds, it'll print the word it found.

## Fetching the word list

Run `npm run words`. If you want to modify the source of the word list, change the URL in [get_words.js](get_words.js).

## Seeing the browser as it runs

To see the browser as it makes its attempts to solve the puzzle, pass the argument `--show`:

`npm start -- --show`
