'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join('/data', 'leaderboard.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initialise();
    scheduleCleanup();
  }
  return db;
}

function initialise() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id  TEXT PRIMARY KEY,
      puzzle      TEXT NOT NULL,
      solution    TEXT NOT NULL,
      difficulty  TEXT NOT NULL,
      started_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      time_seconds INTEGER NOT NULL,
      difficulty  TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_difficulty_time
      ON scores (difficulty, time_seconds ASC);
  `);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function saveSession(session_id, puzzle, solution, difficulty) {
  getDb().prepare(`
    INSERT INTO sessions (session_id, puzzle, solution, difficulty, started_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(session_id, JSON.stringify(puzzle), JSON.stringify(solution), difficulty, Date.now());
}

function getSession(session_id) {
  const row = getDb().prepare(`
    SELECT * FROM sessions WHERE session_id = ?
  `).get(session_id);
  if (!row) return null;
  return {
    session_id: row.session_id,
    puzzle: JSON.parse(row.puzzle),
    solution: JSON.parse(row.solution),
    difficulty: row.difficulty,
    started_at: row.started_at,
  };
}

function deleteSession(session_id) {
  getDb().prepare(`DELETE FROM sessions WHERE session_id = ?`).run(session_id);
}

function purgeExpiredSessions() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const result = getDb().prepare(`DELETE FROM sessions WHERE started_at < ?`).run(cutoff);
  if (result.changes > 0) {
    console.log(`[cleanup] Purged ${result.changes} expired session(s).`);
  }
}

function scheduleCleanup() {
  // Run immediately on startup, then every hour
  purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 60 * 60 * 1000);
}

// ─── Scores ───────────────────────────────────────────────────────────────────

function saveScore(player_name, time_seconds, difficulty) {
  getDb().prepare(`
    INSERT INTO scores (player_name, time_seconds, difficulty, created_at)
    VALUES (?, ?, ?, ?)
  `).run(player_name, time_seconds, difficulty, Date.now());
}

function getLeaderboard(difficulty) {
  return getDb().prepare(`
    SELECT player_name, time_seconds, created_at
    FROM scores
    WHERE difficulty = ?
    ORDER BY time_seconds ASC
    LIMIT 10
  `).all(difficulty);
}

module.exports = { saveSession, getSession, deleteSession, saveScore, getLeaderboard };
