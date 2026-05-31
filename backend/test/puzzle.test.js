'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generate } = require('../puzzle');

function isValidRow(row) {
  return new Set(row).size === 9 && row.every((value) => value >= 1 && value <= 9);
}

function isValidSolution(grid) {
  for (let i = 0; i < 9; i++) {
    const row = grid[i];
    const col = grid.map((r) => r[i]);
    if (!isValidRow(row) || !isValidRow(col)) return false;
  }

  for (let boxRow = 0; boxRow < 9; boxRow += 3) {
    for (let boxCol = 0; boxCol < 9; boxCol += 3) {
      const box = [];
      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          box.push(grid[r][c]);
        }
      }
      if (!isValidRow(box)) return false;
    }
  }

  return true;
}

test('generate returns a valid Sudoku puzzle and solution pair', () => {
  const { puzzle, solution } = generate('medium');

  assert.equal(puzzle.length, 9);
  assert.equal(solution.length, 9);
  assert.ok(isValidSolution(solution));

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      assert.ok(puzzle[r][c] === 0 || puzzle[r][c] === solution[r][c]);
    }
  }
});

test('generate honors difficulty by increasing clue count for easier boards', () => {
  const easy = generate('easy').puzzle.flat().filter(Boolean).length;
  const hard = generate('hard').puzzle.flat().filter(Boolean).length;

  assert.ok(easy >= hard);
});