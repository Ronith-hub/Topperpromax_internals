import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SubjectCAE {
  cae1: number;          // raw 0-50
  cae2: number;          // raw 0-50 (0 if CAE 2 not completed)
  c1Converted: number;   // (cae1 * 2) * 0.2 (max 20)
  c2Converted: number;   // (cae2 * 2) * 0.2 (max 20, or 0 if pending)
  internalTotal: number; // if CAE 2 completed: c1 + c2 (max 40); if CAE 2 pending: c1 (max 20)
}

export interface StudentScoreRecord {
  id: string;
  name: string;
  regNumber?: string;
  cae2Completed: boolean;  // true if both CAE 1 & 2; false if CAE 2 is incomplete/pending
  maxPossibleMarks: number; // 200 if both, 100 if CAE 1 only
  subjects: {
    maths: SubjectCAE;
    eee: SubjectCAE;
    phy: SubjectCAE;
    clang: SubjectCAE;
    eng: SubjectCAE;
  };
  totalInternals: number; // max 200 (if both) or max 100 (if CAE 1 only)
  c1Total: number;        // sum of 5 subjects * /20 (max 100)
  c2Total: number;        // sum of 5 subjects * /20 (max 100)
  percentage: number;     // 0-100%
  grade: string;
  tier: string;
  timestamp: string;
  createdAt: number;
}

const DATA_FILE = path.join(__dirname, 'scores.json');
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'Roni@15';
const ADMIN_CODE = '4505';

function isAuthorized(key?: string): boolean {
  if (!key) return false;
  return key === ADMIN_CODE || key === HOST_PASSWORD;
}

export function computeCae(raw: number | string): number {
  const val = Math.max(0, Math.min(50, Number(raw) || 0));
  return parseFloat(((val * 2) * 0.2).toFixed(2));
}

export function buildSubjectCAE(
  cae1Raw: number | string,
  cae2Raw: number | string,
  cae2Completed: boolean = true
): SubjectCAE {
  const c1 = computeCae(cae1Raw);
  const c2 = cae2Completed ? computeCae(cae2Raw) : 0;
  const internalTotal = cae2Completed ? parseFloat((c1 + c2).toFixed(2)) : c1;
  return {
    cae1: Math.max(0, Math.min(50, Number(cae1Raw) || 0)),
    cae2: cae2Completed ? Math.max(0, Math.min(50, Number(cae2Raw) || 0)) : 0,
    c1Converted: c1,
    c2Converted: c2,
    internalTotal,
  };
}

export function determineTier(totalInternals: number, maxPossible: number = 200): { tier: string; grade: string } {
  const pct = (totalInternals / maxPossible) * 100;
  if (pct >= 90) return { tier: 'Topper Promax Champion 👑', grade: 'O (Outstanding)' };
  if (pct >= 80) return { tier: 'Topper Promax Tier 🔥', grade: 'A+ (Excellent)' };
  if (pct >= 70) return { tier: 'First Class Distinction ✨', grade: 'A (Very Good)' };
  if (pct >= 60) return { tier: 'First Class Merit 🎓', grade: 'B+ (Good)' };
  if (pct >= 50) return { tier: 'Second Class Pass 📘', grade: 'B (Above Average)' };
  return { tier: 'Needs Improvement ⚠️', grade: 'RA (Reappear)' };
}

function createSeedStudent(
  id: string,
  name: string,
  regNumber: string,
  marks: {
    maths: [number, number];
    eee: [number, number];
    phy: [number, number];
    clang: [number, number];
    eng: [number, number];
  },
  timestamp: string,
  hoursAgo: number,
  cae2Completed: boolean = true
): StudentScoreRecord {
  const maths = buildSubjectCAE(marks.maths[0], marks.maths[1], cae2Completed);
  const eee = buildSubjectCAE(marks.eee[0], marks.eee[1], cae2Completed);
  const phy = buildSubjectCAE(marks.phy[0], marks.phy[1], cae2Completed);
  const clang = buildSubjectCAE(marks.clang[0], marks.clang[1], cae2Completed);
  const eng = buildSubjectCAE(marks.eng[0], marks.eng[1], cae2Completed);

  const c1Total = parseFloat((maths.c1Converted + eee.c1Converted + phy.c1Converted + clang.c1Converted + eng.c1Converted).toFixed(2));
  const c2Total = parseFloat((maths.c2Converted + eee.c2Converted + phy.c2Converted + clang.c2Converted + eng.c2Converted).toFixed(2));

  const maxPossibleMarks = cae2Completed ? 200 : 100;
  const totalInternals = cae2Completed
    ? parseFloat((maths.internalTotal + eee.internalTotal + phy.internalTotal + clang.internalTotal + eng.internalTotal).toFixed(2))
    : c1Total;

  const percentage = parseFloat(((totalInternals / maxPossibleMarks) * 100).toFixed(2));
  const { tier, grade } = determineTier(totalInternals, maxPossibleMarks);

  return {
    id,
    name,
    regNumber,
    cae2Completed,
    maxPossibleMarks,
    subjects: { maths, eee, phy, clang, eng },
    totalInternals,
    c1Total,
    c2Total,
    percentage,
    grade,
    tier,
    timestamp,
    createdAt: Date.now() - 3600000 * hoursAgo,
  };
}

const INITIAL_SEEDS: StudentScoreRecord[] = [
  createSeedStudent(
    'score-1',
    'Aravind Swaminathan',
    '42110291',
    {
      maths: [49.5, 49],   // C1: 19.8, C2: 19.6 -> 39.4 / 40
      eee: [48, 48.5],     // C1: 19.2, C2: 19.4 -> 38.6 / 40
      phy: [49, 49.5],     // C1: 19.6, C2: 19.8 -> 39.4 / 40
      clang: [50, 49.5],   // C1: 20.0, C2: 19.8 -> 39.8 / 40
      eng: [48.5, 49],     // C1: 19.4, C2: 19.6 -> 39.0 / 40
    },
    '10:15 AM',
    3,
    true
  ),
  createSeedStudent(
    'score-2',
    'Kavitha Rangarajan',
    '42110415',
    {
      maths: [47, 48],     // C1: 18.8, C2: 19.2 -> 38.0 / 40
      eee: [46.5, 47],     // C1: 18.6, C2: 18.8 -> 37.4 / 40
      phy: [48, 47.5],     // C1: 19.2, C2: 19.0 -> 38.2 / 40
      clang: [47.5, 48],   // C1: 19.0, C2: 19.2 -> 38.2 / 40
      eng: [49, 49.5],     // C1: 19.6, C2: 19.8 -> 39.4 / 40
    },
    '11:04 AM',
    2,
    true
  ),
  createSeedStudent(
    'score-3',
    'Jesuroni S.',
    '42110108',
    {
      maths: [45.5, 46],   // C1: 18.2, C2: 18.4 -> 36.6 / 40
      eee: [44, 45],       // C1: 17.6, C2: 18.0 -> 35.6 / 40
      phy: [46, 46.5],     // C1: 18.4, C2: 18.6 -> 37.0 / 40
      clang: [48, 47.5],   // C1: 19.2, C2: 19.0 -> 38.2 / 40
      eng: [46, 47],       // C1: 18.4, C2: 18.8 -> 37.2 / 40
    },
    '11:42 AM',
    1.5,
    true
  ),
  createSeedStudent(
    'score-4',
    'Dinesh Karthik M.',
    '42110632',
    {
      maths: [42, 43],     // C1: 16.8, C2: 17.2 -> 34.0 / 40
      eee: [41.5, 42],     // C1: 16.6, C2: 16.8 -> 33.4 / 40
      phy: [43, 44],       // C1: 17.2, C2: 17.6 -> 34.8 / 40
      clang: [44, 44.5],   // C1: 17.6, C2: 17.8 -> 35.4 / 40
      eng: [42.5, 43],     // C1: 17.0, C2: 17.2 -> 34.2 / 40
    },
    '12:20 PM',
    0.8,
    true
  ),
  createSeedStudent(
    'score-5',
    'Priya Dharshini (CAE 2 Pending)',
    '42110544',
    {
      maths: [44, 0],      // C1: 17.6 / 20
      eee: [41, 0],        // C1: 16.4 / 20
      phy: [45, 0],        // C1: 18.0 / 20
      clang: [47, 0],      // C1: 18.8 / 20
      eng: [43, 0],        // C1: 17.2 / 20
    },
    '01:10 PM',
    0.4,
    false // CAE 2 not completed yet! Evaluated out of 20 per subject, 100 total
  ),
];

function loadScores(): StudentScoreRecord[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].subjects) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read scores.json:', err);
  }
  saveScores(INITIAL_SEEDS);
  return INITIAL_SEEDS;
}

function saveScores(scores: StudentScoreRecord[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write scores.json:', err);
  }
}

let inMemoryScores: StudentScoreRecord[] = loadScores();

const sseClients = new Set<express.Response>();

function broadcastScores() {
  const sorted = [...inMemoryScores].sort((a, b) => b.percentage - a.percentage);
  const data = JSON.stringify({ type: 'SYNC_SCORES', data: sorted });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // 1. Get all scores (sorted highest to lowest aggregate percentage)
  app.get('/api/scores', (_req, res) => {
    const sorted = [...inMemoryScores].sort((a, b) => b.percentage - a.percentage);
    res.json({ success: true, count: sorted.length, scores: sorted });
  });

  // 2. Real-Time Server-Sent Events (SSE) Stream
  app.get('/api/scores/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sorted = [...inMemoryScores].sort((a, b) => b.percentage - a.percentage);
    res.write(`data: ${JSON.stringify({ type: 'INITIAL_SYNC', data: sorted })}\n\n`);

    sseClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // 3. Post a new student score (Supports CAE 1 only OR both CAE 1 and 2)
  app.post('/api/scores', (req, res) => {
    const { name, regNumber, maths, eee, phy, clang, eng, isCae2Pending } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Student full name is required' });
    }

    const cae2Completed = isCae2Pending !== true && req.body.cae2Completed !== false;

    const m = buildSubjectCAE(maths?.cae1 ?? maths ?? 0, maths?.cae2 ?? maths ?? 0, cae2Completed);
    const e = buildSubjectCAE(eee?.cae1 ?? eee ?? 0, eee?.cae2 ?? eee ?? 0, cae2Completed);
    const p = buildSubjectCAE(phy?.cae1 ?? phy ?? 0, phy?.cae2 ?? phy ?? 0, cae2Completed);
    const c = buildSubjectCAE(clang?.cae1 ?? clang ?? 0, clang?.cae2 ?? clang ?? 0, cae2Completed);
    const en = buildSubjectCAE(eng?.cae1 ?? eng ?? 0, eng?.cae2 ?? eng ?? 0, cae2Completed);

    const c1Total = parseFloat((m.c1Converted + e.c1Converted + p.c1Converted + c.c1Converted + en.c1Converted).toFixed(2));
    const c2Total = parseFloat((m.c2Converted + e.c2Converted + p.c2Converted + c.c2Converted + en.c2Converted).toFixed(2));

    const maxPossibleMarks = cae2Completed ? 200 : 100;
    const totalInternals = cae2Completed
      ? parseFloat((m.internalTotal + e.internalTotal + p.internalTotal + c.internalTotal + en.internalTotal).toFixed(2))
      : c1Total;

    const percentage = parseFloat(((totalInternals / maxPossibleMarks) * 100).toFixed(2));
    const { tier, grade } = determineTier(totalInternals, maxPossibleMarks);

    const newRecord: StudentScoreRecord = {
      id: 'score-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      regNumber: (regNumber && typeof regNumber === 'string') ? regNumber.trim() : undefined,
      cae2Completed,
      maxPossibleMarks,
      subjects: {
        maths: m,
        eee: e,
        phy: p,
        clang: c,
        eng: en,
      },
      totalInternals,
      c1Total,
      c2Total,
      percentage,
      grade,
      tier,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
    };

    inMemoryScores.unshift(newRecord);
    saveScores(inMemoryScores);
    broadcastScores();

    res.status(201).json({ success: true, record: newRecord });
  });

  // 4. Admin Code Verification
  app.post('/api/admin/verify', (req, res) => {
    const { code } = req.body;
    if (code === ADMIN_CODE) {
      return res.json({ success: true, message: 'Authorization code verified' });
    }
    return res.status(401).json({ success: false, message: 'Invalid Authorization Code' });
  });

  // 5. Host Authorized Delete
  app.delete('/api/scores/:id', (req, res) => {
    const { id } = req.params;
    const hostPassword = (req.headers['x-host-password'] || req.body?.password) as string | undefined;

    if (!isAuthorized(hostPassword)) {
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid Host Authorization!' });
    }

    const index = inMemoryScores.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Score record not found' });
    }

    const removed = inMemoryScores.splice(index, 1);
    saveScores(inMemoryScores);
    broadcastScores();

    res.json({ success: true, message: 'Record deleted successfully', removed: removed[0] });
  });

  // 6. Host Authorized Clear All
  app.post('/api/scores/clear', (req, res) => {
    const hostPassword = (req.headers['x-host-password'] || req.body?.password) as string | undefined;

    if (!isAuthorized(hostPassword)) {
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid Host Authorization!' });
    }

    inMemoryScores = [];
    saveScores(inMemoryScores);
    broadcastScores();

    res.json({ success: true, message: 'All scoreboard records cleared' });
  });

  // 7. Host Authorized Reset with Seed Data
  app.post('/api/scores/reset-seed', (req, res) => {
    const hostPassword = (req.headers['x-host-password'] || req.body?.password) as string | undefined;

    if (!isAuthorized(hostPassword)) {
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid Host Authorization!' });
    }

    inMemoryScores = [...INITIAL_SEEDS];
    saveScores(inMemoryScores);
    broadcastScores();

    res.json({ success: true, message: 'Scoreboard reset to default class records' });
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Topper Promax server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
