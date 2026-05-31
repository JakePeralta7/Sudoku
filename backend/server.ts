'use strict';

const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generate } = require('./puzzle');
const { saveSession, getSession, deleteSession, saveScore, getLeaderboard } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DIFFICULTIES = ['easy', 'medium', 'hard'];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateDifficulty(res, difficulty) {
  if (!DIFFICULTIES.includes(difficulty)) {
    res.status(400).json({ error: `difficulty must be one of: ${DIFFICULTIES.join(', ')}` });
    return false;
  }
  return true;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/puzzle — generate a new puzzle and persist the session
app.post('/api/puzzle', (req, res) => {
  const difficulty = (req.body.difficulty || 'medium').toLowerCase();
  if (!validateDifficulty(res, difficulty)) return;

  const { puzzle, solution } = generate(difficulty);
  const session_id = uuidv4();
  saveSession(session_id, puzzle, solution, difficulty);

  res.json({ session_id, puzzle, difficulty });
});

// GET /api/puzzle/:sessionId — resume a persisted session
app.get('/api/puzzle/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  // Return puzzle + metadata but never the solution
  res.json({
    session_id: session.session_id,
    puzzle: session.puzzle,
    difficulty: session.difficulty,
    started_at: session.started_at,
  });
});

// POST /api/validate — validate a completed board
app.post('/api/validate', (req, res) => {
  const { session_id, board } = req.body;

  if (!session_id || !Array.isArray(board)) {
    return res.status(400).json({ error: 'session_id and board are required.' });
  }

  const session = getSession(session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  // board must be 9×9 of numbers 1–9
  if (board.length !== 9 || board.some(r => !Array.isArray(r) || r.length !== 9)) {
    return res.status(400).json({ error: 'board must be a 9×9 array.' });
  }

  const correct = board.every((row, r) =>
    row.every((cell, c) => cell === session.solution[r][c])
  );

  res.json({ correct });
});

// GET /api/leaderboard?difficulty= — top 10 scores for a difficulty
app.get('/api/leaderboard', (req, res) => {
  const difficulty = (req.query.difficulty || 'medium').toLowerCase();
  if (!validateDifficulty(res, difficulty)) return;

  const rows = getLeaderboard(difficulty);
  res.json({ difficulty, scores: rows });
});

// POST /api/leaderboard — submit a score
app.post('/api/leaderboard', (req, res) => {
  const { player_name, time_seconds, difficulty, session_id } = req.body;

  if (!player_name || typeof player_name !== 'string' || !player_name.trim()) {
    return res.status(400).json({ error: 'player_name is required.' });
  }
  if (typeof time_seconds !== 'number' || time_seconds <= 0) {
    return res.status(400).json({ error: 'time_seconds must be a positive number.' });
  }
  if (!validateDifficulty(res, (difficulty || '').toLowerCase())) return;

  // Verify the session exists before accepting the score (anti-cheat)
  const session = getSession(session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  if (session.difficulty !== difficulty.toLowerCase()) {
    return res.status(400).json({ error: 'Difficulty mismatch with session.' });
  }

  saveScore(player_name.trim(), Math.round(time_seconds), difficulty.toLowerCase());
  deleteSession(session_id);

  res.status(201).json({ message: 'Score saved.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sudoku server running on http://localhost:${PORT}`);
});
