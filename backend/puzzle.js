'use strict';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyGrid() {
  return Array.from({ length: 9 }, () => new Array(9).fill(0));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(grid, row, col, num) {
  // Row
  if (grid[row].includes(num)) return false;
  // Column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  // 3×3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

// ─── Backtracking solver ──────────────────────────────────────────────────────

/**
 * Fills `grid` in place. Returns true if a solution was found.
 * When `randomise` is true, digits are tried in random order (for generation).
 * When `countOnly` is true, counts solutions up to `limit` and returns the count.
 */
function solve(grid, randomise = false, countOnly = false, limit = 2) {
  // Find next empty cell
  let row = -1, col = -1;
  outer: for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) { row = r; col = c; break outer; }
    }
  }
  if (row === -1) return countOnly ? 1 : true; // Solved

  const digits = randomise ? shuffle([1,2,3,4,5,6,7,8,9]) : [1,2,3,4,5,6,7,8,9];
  let count = 0;

  for (const num of digits) {
    if (isValid(grid, row, col, num)) {
      grid[row][col] = num;
      const sub = solve(grid, randomise, countOnly, limit);
      if (countOnly) {
        count += sub;
        if (count >= limit) { grid[row][col] = 0; return count; }
      } else {
        if (sub) return true;
      }
      grid[row][col] = 0;
    }
  }
  return countOnly ? count : false;
}

function hasUniqueSolution(grid) {
  const copy = grid.map(r => [...r]);
  return solve(copy, false, true, 2) === 1;
}

// ─── Generator ────────────────────────────────────────────────────────────────

const CLUE_TARGETS = {
  easy:   46,
  medium: 36,
  hard:   28,
};

function generate(difficulty = 'medium') {
  // 1. Build a filled solution grid
  const solution = emptyGrid();
  solve(solution, true);

  // 2. Remove cells while maintaining a unique solution
  const puzzle = solution.map(r => [...r]);
  const clueTarget = CLUE_TARGETS[difficulty] ?? CLUE_TARGETS.medium;
  const cells = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  let clues = 81;
  for (const [r, c] of cells) {
    if (clues <= clueTarget) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (!hasUniqueSolution(puzzle)) {
      puzzle[r][c] = backup; // Restore if uniqueness lost
    } else {
      clues--;
    }
  }

  return { puzzle, solution };
}

module.exports = { generate };
