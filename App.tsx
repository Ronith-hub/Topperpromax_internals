import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Crown,
  Trophy,
  Volume2,
  VolumeX,
  FilePenLine,
  Calculator,
  RotateCcw,
  Trash2,
  Lock,
  Search,
  Users,
  Award,
  Sparkles,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Medal,
  Check,
  Shield,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export interface SubjectCAE {
  cae1: number;          // 0-50 raw
  cae2: number;          // 0-50 raw (0 if CAE 2 not completed)
  c1Converted: number;   // (cae1 * 2) * 0.2 (max 20)
  c2Converted: number;   // (cae2 * 2) * 0.2 (max 20)
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
  c1Total?: number;       // sum of 5 subjects * /20 (max 100)
  c2Total?: number;       // sum of 5 subjects * /20 (max 100)
  percentage: number;     // 0-100%
  grade: string;
  tier: string;
  timestamp: string;
  createdAt: number;
}

export const SUBJECT_CONFIG = [
  { key: 'maths', label: 'Mathematics', short: 'Maths', icon: '📐' },
  { key: 'eee', label: 'Electrical & Electronics (EEE)', short: 'EEE', icon: '⚡' },
  { key: 'phy', label: 'Physics', short: 'Physics', icon: '🔬' },
  { key: 'clang', label: 'C Programming Language', short: 'C Lang', icon: '💻' },
  { key: 'eng', label: 'Technical English', short: 'English', icon: '📖' },
] as const;

export type SubjectKey = typeof SUBJECT_CONFIG[number]['key'];

// Convert 0-50 raw mark into 20-mark CAE score: (Raw * 2) * 0.2
export function computeCae(raw: number | string): number {
  const num = Math.max(0, Math.min(50, parseFloat(String(raw)) || 0));
  return parseFloat(((num * 2) * 0.2).toFixed(2));
}

export function getTierInfo(totalInternals: number, maxPossible: number = 200): { label: string; bg: string; text: string; border: string } {
  const pct = (totalInternals / maxPossible) * 100;
  if (pct >= 90) {
    return {
      label: 'Topper Promax Champion 👑',
      bg: 'bg-amber-400/20',
      text: 'text-amber-300',
      border: 'border-amber-400/40',
    };
  }
  if (pct >= 80) {
    return {
      label: 'Topper Tier 🔥',
      bg: 'bg-yellow-400/20',
      text: 'text-yellow-300',
      border: 'border-yellow-400/30',
    };
  }
  if (pct >= 70) {
    return {
      label: 'Distinction Merit ✨',
      bg: 'bg-emerald-400/20',
      text: 'text-emerald-300',
      border: 'border-emerald-400/30',
    };
  }
  if (pct >= 60) {
    return {
      label: 'First Class 🎓',
      bg: 'bg-sky-400/20',
      text: 'text-sky-300',
      border: 'border-sky-400/30',
    };
  }
  if (pct >= 50) {
    return {
      label: 'Pass Grade 📘',
      bg: 'bg-slate-700/50',
      text: 'text-slate-300',
      border: 'border-slate-600',
    };
  }
  return {
    label: 'Needs Improvement ⚠️',
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  };
}

export default function App() {
  // Navigation: 'entry' (mark entry form), 'scoreboard' (Internal Scoreboard), 'admin' (Code 4505 Portal)
  const [currentPage, setCurrentPage] = useState<'entry' | 'scoreboard' | 'admin'>('entry');
  const [lastSubmittedRecord, setLastSubmittedRecord] = useState<StudentScoreRecord | null>(null);

  // CAE 2 Status Option: When true, CAE 2 is not completed; evaluates only CAE 1 out of 20 (Total 100)
  const [isCae2Pending, setIsCae2Pending] = useState<boolean>(false);

  // Scoreboard View Filter: 'all' | 'both_cae' | 'cae1_only'
  const [viewEvaluationMode, setViewEvaluationMode] = useState<'all' | 'both_cae' | 'cae1_only'>('all');

  // Admin authorization state: delete options are visible ONLY to this user when unlocked with code "4505"
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('topper_admin_unlocked') === 'true';
  });

  // Admin Code Page Input State
  const [adminInputCode, setAdminInputCode] = useState<string>('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showCodePassword, setShowCodePassword] = useState<boolean>(false);

  // Scoreboard state from server
  const [scores, setScores] = useState<StudentScoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<'connected' | 'connecting' | 'polling'>('connecting');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Form input state: Student details
  const [studentName, setStudentName] = useState<string>('');
  const [regNumber, setRegNumber] = useState<string>('');

  // Form input state: CAE 1 and CAE 2 for each subject (0-50 each)
  const [marksState, setMarksState] = useState<Record<SubjectKey, { cae1: string; cae2: string }>>({
    maths: { cae1: '', cae2: '' },
    eee: { cae1: '', cae2: '' },
    phy: { cae1: '', cae2: '' },
    clang: { cae1: '', cae2: '' },
    eng: { cae1: '', cae2: '' },
  });

  // Scoreboard UI state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'toppers' | 'merit' | 'pass'>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'recent'>('rank');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Confirmation modal for deletion (only callable when isAdminUnlocked is true)
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [confirmActionType, setConfirmActionType] = useState<'deleteRecord' | 'clearAll' | 'resetSeed'>('deleteRecord');
  const [targetDocId, setTargetDocId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: 'victory' | 'click' | 'delete') => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      if (type === 'victory') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.15, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.4);
        });
      } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'delete') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      }
    } catch {
      // Audio error safely ignored
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Real-time synchronization via Server-Sent Events (SSE) with fallback polling
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchScoresFallback = async () => {
      try {
        const res = await fetch('/api/scores');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.scores)) {
            setScores(data.scores);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchScoresFallback();

    try {
      eventSource = new EventSource('/api/scores/stream');

      eventSource.onopen = () => {
        setLiveStatus('connected');
        setIsLoading(false);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INITIAL_SYNC' || payload.type === 'SYNC_SCORES') {
            setScores(payload.data);
            setIsLoading(false);
          }
        } catch (e) {
          console.error('Error parsing SSE payload:', e);
        }
      };

      eventSource.onerror = () => {
        setLiveStatus('polling');
        if (!pollInterval) {
          pollInterval = setInterval(fetchScoresFallback, 3500);
        }
      };
    } catch {
      setLiveStatus('polling');
      pollInterval = setInterval(fetchScoresFallback, 3500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Update specific subject marks
  const handleMarkChange = (subject: SubjectKey, exam: 'cae1' | 'cae2', val: string) => {
    setMarksState((prev) => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [exam]: val,
      },
    }));
  };

  // Compute Subject-Wise Toppers & Comparisons across all recorded students
  const subjectToppers = useMemo(() => {
    if (scores.length === 0) return {} as Record<SubjectKey, { student: StudentScoreRecord; maxScore: number; maxPossible: number }>;

    const toppers: Record<SubjectKey, { student: StudentScoreRecord; maxScore: number; maxPossible: number }> = {} as any;

    SUBJECT_CONFIG.forEach((sub) => {
      let maxScore = -1;
      let topStudent: StudentScoreRecord | null = null;
      let maxPossible = 40;

      scores.forEach((student) => {
        // If comparing in CAE 1 Only view or if student is CAE 1 only
        const subData = student.subjects?.[sub.key];
        const score = subData ? subData.internalTotal : 0;
        if (score > maxScore) {
          maxScore = score;
          topStudent = student;
          maxPossible = student.cae2Completed ? 40 : 20;
        }
      });

      if (topStudent) {
        toppers[sub.key] = { student: topStudent, maxScore, maxPossible };
      }
    });

    return toppers;
  }, [scores]);

  // Overall #1 Top scorer
  const overallTopper = useMemo(() => {
    if (scores.length === 0) return null;
    const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
    return sorted[0];
  }, [scores]);

  // Check if a student is the topper in a specific subject
  const isSubjectTopper = (studentId: string, subjectKey: SubjectKey) => {
    return subjectToppers[subjectKey]?.student?.id === studentId;
  };

  // Find rank of last submitted student
  const lastSubmittedRank = useMemo(() => {
    if (!lastSubmittedRecord || scores.length === 0) return null;
    const sorted = [...scores].sort((a, b) => b.percentage - a.percentage);
    const idx = sorted.findIndex((s) => s.id === lastSubmittedRecord.id);
    return idx !== -1 ? idx + 1 : null;
  }, [lastSubmittedRecord, scores]);

  // Verify Admin Code on the dedicated page
  const handleVerifyAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminInputCode.trim() === '4505') {
      setIsAdminUnlocked(true);
      sessionStorage.setItem('topper_admin_unlocked', 'true');
      setAdminError(null);
      playSound('victory');
      showToast('Security code 4505 accepted! Delete options are now visible for your session.');
      setCurrentPage('scoreboard');
    } else {
      setAdminError('Invalid security code. Access denied.');
      playSound('delete');
    }
  };

  // Lock Admin Mode (Make delete options invisible again)
  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    sessionStorage.removeItem('topper_admin_unlocked');
    setAdminInputCode('');
    setAdminError(null);
    playSound('click');
    showToast('Admin mode locked. Delete options are now hidden.');
  };

  // Form submission handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      showToast('Please enter the student full name.');
      return;
    }

    setIsSubmitting(true);
    playSound('click');

    try {
      const payload = {
        name: studentName.trim(),
        regNumber: regNumber.trim() || undefined,
        isCae2Pending: isCae2Pending,
        cae2Completed: !isCae2Pending,
        maths: {
          cae1: parseFloat(marksState.maths.cae1) || 0,
          cae2: isCae2Pending ? 0 : parseFloat(marksState.maths.cae2) || 0,
        },
        eee: {
          cae1: parseFloat(marksState.eee.cae1) || 0,
          cae2: isCae2Pending ? 0 : parseFloat(marksState.eee.cae2) || 0,
        },
        phy: {
          cae1: parseFloat(marksState.phy.cae1) || 0,
          cae2: isCae2Pending ? 0 : parseFloat(marksState.phy.cae2) || 0,
        },
        clang: {
          cae1: parseFloat(marksState.clang.cae1) || 0,
          cae2: isCae2Pending ? 0 : parseFloat(marksState.clang.cae2) || 0,
        },
        eng: {
          cae1: parseFloat(marksState.eng.cae1) || 0,
          cae2: isCae2Pending ? 0 : parseFloat(marksState.eng.cae2) || 0,
        },
      };

      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.message || 'Failed to submit score');
      }

      const record: StudentScoreRecord = resData.record;

      if (record.percentage >= 80) {
        playSound('victory');
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#eab308', '#f59e0b', '#10b981', '#38bdf8', '#a855f7'],
        });
      } else {
        playSound('click');
      }

      setNewlyAddedId(record.id);
      setLastSubmittedRecord(record);
      setTimeout(() => setNewlyAddedId(null), 8000);

      const modeMsg = isCae2Pending ? ' (CAE 1 Only mode: evaluated out of 20 per subject)' : '';
      showToast(`🎉 Internal marks evaluated for ${record.name}${modeMsg}! Redirecting to Scoreboard...`);

      // Reset form
      handleResetForm();

      // Transition to Internal Scoreboard
      setCurrentPage('scoreboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error syncing score to live leaderboard';
      showToast('❌ ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setStudentName('');
    setRegNumber('');
    setMarksState({
      maths: { cae1: '', cae2: '' },
      eee: { cae1: '', cae2: '' },
      phy: { cae1: '', cae2: '' },
      clang: { cae1: '', cae2: '' },
      eng: { cae1: '', cae2: '' },
    });
  };

  // Trigger deletion actions (Only accessible when isAdminUnlocked === true)
  const triggerDeleteAction = (type: 'deleteRecord' | 'clearAll' | 'resetSeed', docId?: string) => {
    if (!isAdminUnlocked) {
      showToast('⚠️ Unauthorized action. Please enter code 4505 on the Security Access page.');
      return;
    }
    setConfirmActionType(type);
    setTargetDocId(docId || null);
    setConfirmModalOpen(true);
    playSound('click');
  };

  const handleExecuteConfirmedDelete = async () => {
    setConfirmLoading(true);

    try {
      let endpoint = '';
      let method = 'POST';

      if (confirmActionType === 'deleteRecord' && targetDocId) {
        endpoint = `/api/scores/${targetDocId}`;
        method = 'DELETE';
      } else if (confirmActionType === 'clearAll') {
        endpoint = '/api/scores/clear';
        method = 'POST';
      } else if (confirmActionType === 'resetSeed') {
        endpoint = '/api/scores/reset-seed';
        method = 'POST';
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-host-password': '4505',
        },
        body: JSON.stringify({ password: '4505' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Action failed');
      }

      playSound('delete');
      showToast(`Action executed: ${data.message}`);
      setConfirmModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      showToast('❌ ' + message);
    } finally {
      setConfirmLoading(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (scores.length === 0) {
      showToast('No student records to export.');
      return;
    }
    const headers = [
      'Rank',
      'Student Name',
      'Register No',
      'Assessment Mode',
      'Maths CAE1 (/20)', 'Maths CAE2 (/20)', 'Maths Internal',
      'EEE CAE1 (/20)', 'EEE CAE2 (/20)', 'EEE Internal',
      'Phy CAE1 (/20)', 'Phy CAE2 (/20)', 'Phy Internal',
      'C Lang CAE1 (/20)', 'C Lang CAE2 (/20)', 'C Lang Internal',
      'Eng CAE1 (/20)', 'Eng CAE2 (/20)', 'Eng Internal',
      'Total Internals',
      'Max Possible Marks',
      'Percentage (%)',
      'Tier',
      'Recorded At',
    ];

    const rows = sortedFilteredScores.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      s.regNumber || 'N/A',
      s.cae2Completed ? 'Full (CAE 1 + 2)' : 'CAE 1 Only (CAE 2 Pending)',
      s.subjects.maths.c1Converted, s.cae2Completed ? s.subjects.maths.c2Converted : 'Pending', s.subjects.maths.internalTotal,
      s.subjects.eee.c1Converted, s.cae2Completed ? s.subjects.eee.c2Converted : 'Pending', s.subjects.eee.internalTotal,
      s.subjects.phy.c1Converted, s.cae2Completed ? s.subjects.phy.c2Converted : 'Pending', s.subjects.phy.internalTotal,
      s.subjects.clang.c1Converted, s.cae2Completed ? s.subjects.clang.c2Converted : 'Pending', s.subjects.clang.internalTotal,
      s.subjects.eng.c1Converted, s.cae2Completed ? s.subjects.eng.c2Converted : 'Pending', s.subjects.eng.internalTotal,
      s.totalInternals,
      s.maxPossibleMarks,
      s.percentage,
      `"${s.tier}"`,
      `"${s.timestamp}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Internal_Scoreboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Internal Scoreboard exported as CSV file.');
  };

  // Filtered and Sorted scores list
  const sortedFilteredScores = useMemo(() => {
    let result = [...scores];

    // Mode filter (all, both CAE, CAE 1 only)
    if (viewEvaluationMode === 'both_cae') {
      result = result.filter((s) => s.cae2Completed === true);
    } else if (viewEvaluationMode === 'cae1_only') {
      result = result.filter((s) => s.cae2Completed === false);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.regNumber && s.regNumber.toLowerCase().includes(q))
      );
    }

    if (activeFilter === 'toppers') {
      result = result.filter((s) => s.percentage >= 80);
    } else if (activeFilter === 'merit') {
      result = result.filter((s) => s.percentage >= 60 && s.percentage < 80);
    } else if (activeFilter === 'pass') {
      result = result.filter((s) => s.percentage >= 50 && s.percentage < 60);
    }

    if (sortBy === 'rank') {
      result.sort((a, b) => b.percentage - a.percentage);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  }, [scores, viewEvaluationMode, searchQuery, activeFilter, sortBy]);

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-slate-900 border border-amber-400/40 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCurrentPage('entry');
                playSound('click');
              }}
              className="flex items-center gap-3 text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Crown className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                    Topper promax
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Live Sync
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Sathyabama University Continuous Assessment Engine
                </p>
              </div>
            </button>
          </div>

          {/* Navigation Page Tabs: Mark Entry vs Internal Scoreboard vs Admin Code Page */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setCurrentPage('entry');
                playSound('click');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentPage === 'entry'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FilePenLine className="w-3.5 h-3.5" />
              <span>Mark Entry Form</span>
            </button>

            <button
              onClick={() => {
                setCurrentPage('scoreboard');
                playSound('click');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentPage === 'scoreboard'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Internal Scoreboard</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  currentPage === 'scoreboard'
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {scores.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Dedicated Admin Page Button */}
            <button
              onClick={() => {
                setCurrentPage('admin');
                playSound('click');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isAdminUnlocked
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title="Admin Security Access (Separate Page)"
            >
              {isAdminUnlocked ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Admin Active</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Security Access</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) playSound('click');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Toggle Audio Sound Effects"
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">SFX On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">SFX Off</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full flex-grow">
        {/* ================= PAGE 1: CAE 1 & CAE 2 MARK ENTRY FORM ================= */}
        {currentPage === 'entry' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Top Prompt Banner */}
            <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-slate-900/90 border border-indigo-500/20">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-100">
                    Step 1: Student Mark Entry
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isCae2Pending
                      ? 'CAE 2 is incomplete: evaluating only CAE 1 raw marks converted out of 20 per subject (Total: 100 marks).'
                      : 'Evaluating both CAE 1 & CAE 2 raw marks converted to 20 + 20 = 40 internal marks per subject (Total: 200 marks).'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('scoreboard');
                  playSound('click');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <span>View Internal Scoreboard ({scores.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Entry Form Card */}
            <div className="glass-card p-6 sm:p-8 rounded-2xl relative shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <FilePenLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Student CAE Evaluation Form</h2>
                    <p className="text-xs text-slate-400">
                      {isCae2Pending
                        ? 'CAE 2 Incomplete Mode: Only CAE 1 is taken and evaluated out of 20 per subject'
                        : 'Full Evaluation Mode: CAE 1 (/50) + CAE 2 (/50) converted to 40 internals per subject'}
                    </p>
                  </div>
                </div>

                {/* CAE 2 Incomplete Toggle Option */}
                <div className="bg-slate-900/90 p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-700/80 flex items-center justify-between sm:justify-start gap-3">
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>CAE 2 Incomplete?</span>
                      {isCae2Pending && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-400 text-slate-950 uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {isCae2Pending ? 'Evaluate CAE 1 only (out of 20)' : 'Evaluate both CAE 1 & 2 (out of 40)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCae2Pending(!isCae2Pending);
                      playSound('click');
                      showToast(
                        !isCae2Pending
                          ? 'CAE 2 Incomplete mode enabled: only CAE 1 marks will be taken and evaluated out of 20!'
                          : 'Full mode enabled: both CAE 1 & CAE 2 marks will be evaluated out of 40!'
                      );
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isCae2Pending ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={isCae2Pending}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                        isCae2Pending ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Informational Banner when CAE 2 Incomplete is active */}
              {isCae2Pending && (
                <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-sm">CAE 2 is Not Completed Mode (ON)</span>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">
                      CAE 2 inputs are locked. The system will calculate scores <span className="font-bold text-amber-300">only by taking the CAE 1 values converted out of 20</span> per subject, resulting in a total internal score out of <span className="font-bold text-amber-300">100 marks</span>.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Student Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="studentName" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Student Full Name <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="studentName"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Aravind Swaminathan"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="regNumber" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Register No. (Optional)
                    </label>
                    <input
                      type="text"
                      id="regNumber"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      placeholder="e.g. 42110291"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-400 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* 5 Subjects: CAE 1 & CAE 2 Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Subject Marks (Raw Marks 0 to 50)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {isCae2Pending ? 'Evaluating CAE 1 out of 20' : 'Evaluating CAE 1 & 2 out of 40'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {SUBJECT_CONFIG.map((sub) => {
                      const isComplete = isCae2Pending
                        ? marksState[sub.key].cae1.trim() !== ''
                        : marksState[sub.key].cae1.trim() !== '' && marksState[sub.key].cae2.trim() !== '';

                      return (
                        <div
                          key={sub.key}
                          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{sub.icon}</span>
                              <div>
                                <span className="font-bold text-sm text-slate-200">{sub.label}</span>
                                <span className="text-[11px] text-slate-400 block">
                                  {isCae2Pending
                                    ? 'CAE 1 Raw Mark (0 to 50) → Converted /20'
                                    : 'Raw exam marks (0 to 50)'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* CAE 1 Input */}
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                                  CAE 1 (0-50)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  step="0.5"
                                  required
                                  value={marksState[sub.key].cae1}
                                  onChange={(e) => handleMarkChange(sub.key, 'cae1', e.target.value)}
                                  placeholder="0-50"
                                  className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400 transition-all"
                                />
                              </div>

                              {/* CAE 2 Input (Disabled if CAE 2 is pending) */}
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                                  CAE 2 (0-50)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  step="0.5"
                                  disabled={isCae2Pending}
                                  required={!isCae2Pending}
                                  value={isCae2Pending ? '' : marksState[sub.key].cae2}
                                  onChange={(e) => handleMarkChange(sub.key, 'cae2', e.target.value)}
                                  placeholder={isCae2Pending ? 'Pending' : '0-50'}
                                  className={`w-24 px-3 py-1.5 border rounded-lg text-xs outline-none transition-all ${
                                    isCae2Pending
                                      ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed placeholder:text-slate-600'
                                      : 'bg-slate-950 border-slate-700 text-white focus:border-amber-400'
                                  }`}
                                />
                              </div>

                              {/* Completion Status Indicator */}
                              <div className="min-w-[95px] text-center">
                                {isComplete ? (
                                  <span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>{isCae2Pending ? 'CAE 1 Done' : 'Ready'}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950 text-slate-500 border border-slate-800 inline-block">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evaluation Notice Card */}
                <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5 shadow-sm">
                  <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0 mt-0.5">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                      Internal Assessment Evaluation Notice
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {isCae2Pending ? (
                        <>
                          <span className="text-amber-400 font-semibold">CAE 2 is not completed.</span> Only CAE 1 raw marks (0–50) are taken. Upon clicking <span className="text-amber-400 font-semibold">"Submit & Show Internal Scoreboard"</span>, the system converts each CAE 1 mark to <span className="text-amber-400 font-semibold">20 internal marks per subject</span>, displaying your total out of <span className="text-amber-400 font-semibold">100 marks</span>.
                        </>
                      ) : (
                        <>
                          Enter your raw scores (0–50) above. When you click <span className="text-amber-400 font-semibold">"Submit & Show Internal Scoreboard"</span>, the system will convert each CAE out of 20, calculate your 40 internal marks for every subject (Total: 200 marks), and reveal your complete evaluated scores and rank on the Internal Scoreboard.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-sm sm:text-base"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Evaluating & Updating Internal Scoreboard...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit & Show Internal Scoreboard</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetForm();
                      playSound('click');
                    }}
                    className="py-3 px-5 rounded-xl font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200 transition-all cursor-pointer text-sm"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= PAGE 2: SEPARATE INTERNAL SCOREBOARD ================= */}
        {currentPage === 'scoreboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Control Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage('entry');
                    playSound('click');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>Enter Another Student</span>
                </button>

                <span className="text-xs text-slate-400 hidden sm:inline">|</span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Continuous Assessment Engine
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportToCSV}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Export Scoreboard to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                {/* Clear All is ONLY visible when user is authorized via code 4505 on the separate page */}
                {isAdminUnlocked && (
                  <button
                    onClick={() => triggerDeleteAction('clearAll')}
                    className="text-xs px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer font-semibold animate-fade-in"
                    title="Clear All Leaderboard Entries (Authorized via Code 4505)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Admin mode active notification banner (Only visible to authorized user) */}
            {isAdminUnlocked && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300 animate-fade-in shadow-md">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 block">
                      Admin Management Mode Active (Authorized via Code 4505)
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Student deletion trash icons and Clear All controls are currently visible only to your session.
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLockAdmin}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer text-xs font-semibold shrink-0"
                >
                  Lock Controls (Hide Delete)
                </button>
              </div>
            )}

            {/* Last Submitted Student Success Card */}
            {lastSubmittedRecord && (
              <div className="glass-card p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/40 border-2 border-emerald-500/40 shadow-xl animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase text-emerald-400 tracking-wider">
                          Internal Marks Evaluated Successfully!
                        </span>
                        {!lastSubmittedRecord.cae2Completed && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            CAE 1 Only Evaluation (CAE 2 Pending)
                          </span>
                        )}
                        {lastSubmittedRank && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-400 text-slate-950">
                            Ranked #{lastSubmittedRank} Overall
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5">
                        {lastSubmittedRecord.name}
                        {lastSubmittedRecord.regNumber && (
                          <span className="text-xs font-mono text-slate-400 ml-2">
                            ({lastSubmittedRecord.regNumber})
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Total Internals:{' '}
                        <span className="font-bold text-amber-400">
                          {lastSubmittedRecord.totalInternals} / {lastSubmittedRecord.maxPossibleMarks}
                        </span>{' '}
                        ({lastSubmittedRecord.percentage}%) • Grade:{' '}
                        <span className="font-semibold text-emerald-300">{lastSubmittedRecord.grade}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        setCurrentPage('entry');
                        playSound('click');
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <FilePenLine className="w-3.5 h-3.5" />
                      <span>Add Another Record</span>
                    </button>
                    <button
                      onClick={() => setLastSubmittedRecord(null)}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs cursor-pointer"
                      title="Dismiss banner"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overall #1 Champion Spotlight */}
            {overallTopper && overallTopper.percentage >= 70 && (
              <div className="glass-card-gold p-6 rounded-2xl relative overflow-hidden shadow-2xl animate-pulse-glow">
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 uppercase mb-2 shadow-md">
                      <Crown className="w-3.5 h-3.5 fill-current" /> Overall #1 Internal Topper Champion
                    </span>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                      {overallTopper.name}
                      {overallTopper.regNumber && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-mono">
                          {overallTopper.regNumber}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm font-semibold text-yellow-200 mt-1 flex items-center gap-2">
                      <span>
                        Total Internals: {overallTopper.totalInternals} / {overallTopper.maxPossibleMarks} ({overallTopper.percentage}%)
                      </span>
                      <span>•</span>
                      <span className="text-xs text-yellow-300/80">{overallTopper.grade}</span>
                      {!overallTopper.cae2Completed && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
                          CAE 1 Only
                        </span>
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {SUBJECT_CONFIG.map((sub) => {
                        const subScore = overallTopper.subjects?.[sub.key]?.internalTotal ?? 0;
                        const subMax = overallTopper.cae2Completed ? 40 : 20;
                        return (
                          <span
                            key={sub.key}
                            className="px-2.5 py-1 rounded-lg bg-black/50 text-amber-200 border border-amber-500/30 flex items-center gap-1"
                          >
                            <span>{sub.short}:</span>
                            <span className="font-bold text-white">{subScore}/{subMax}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-5xl text-yellow-400 opacity-90 drop-shadow-md">
                    <Trophy className="w-14 h-14" />
                  </div>
                </div>
              </div>
            )}

            {/* Subject-Wise Toppers Comparison Podium */}
            <div className="glass-card p-5 sm:p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Medal className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Subject-Wise Internal Toppers</h3>
                    <p className="text-[11px] text-slate-400">
                      Highest scorer in each individual subject based on evaluated internals
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  5 Subjects Evaluated
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {SUBJECT_CONFIG.map((sub) => {
                  const topperInfo = subjectToppers[sub.key];
                  const topStudent = topperInfo?.student;
                  const maxScore = topperInfo?.maxScore ?? 0;
                  const maxPossible = topperInfo?.maxPossible ?? 40;

                  return (
                    <div
                      key={sub.key}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 relative hover:border-amber-400/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                        <span className="flex items-center gap-1">
                          <span>{sub.icon}</span>
                          <span>{sub.short} Topper</span>
                        </span>
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                      </div>

                      {topStudent ? (
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm truncate" title={topStudent.name}>
                            {topStudent.name}
                          </h4>
                          <div className="text-amber-400 font-black text-lg mt-0.5">
                            {maxScore} <span className="text-xs text-slate-400 font-medium">/ {maxPossible}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {topStudent.cae2Completed
                              ? `C1: ${topStudent.subjects[sub.key].c1Converted} | C2: ${topStudent.subjects[sub.key].c2Converted}`
                              : `C1: ${topStudent.subjects[sub.key].c1Converted}/20 (CAE 2 Pending)`}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 py-2">No entries yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-time Internal Scoreboard List Card */}
            <div className="glass-card p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-lg font-bold text-slate-100">Internal Scoreboard</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {sortedFilteredScores.length} of {scores.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live rankings of every user updated in real-time across all connected devices
                  </p>
                </div>

                {/* Evaluation View Filter Switcher: All | Both CAE | CAE 1 Only */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setViewEvaluationMode('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      viewEvaluationMode === 'all'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Modes
                  </button>
                  <button
                    onClick={() => setViewEvaluationMode('both_cae')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      viewEvaluationMode === 'both_cae'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CAE 1+2 (/40)
                  </button>
                  <button
                    onClick={() => setViewEvaluationMode('cae1_only')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      viewEvaluationMode === 'cae1_only'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CAE 1 Only (/20)
                  </button>
                </div>
              </div>

              {/* Controls: Search, Filter Tabs, and Sort */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search student by name or register number..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setSortBy('rank')}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          sortBy === 'rank' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Rank
                      </button>
                      <button
                        onClick={() => setSortBy('recent')}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          sortBy === 'recent' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Recent
                      </button>
                      <button
                        onClick={() => setSortBy('name')}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          sortBy === 'name' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        A-Z
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      activeFilter === 'all'
                        ? 'bg-slate-700 text-white font-bold'
                        : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    All ({scores.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('toppers')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      activeFilter === 'toppers'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-900/80 text-amber-300 hover:text-amber-200 border border-slate-800'
                    }`}
                  >
                    Toppers ≥ 80% ({scores.filter((s) => s.percentage >= 80).length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('merit')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      activeFilter === 'merit'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-900/80 text-emerald-400 hover:text-emerald-300 border border-slate-800'
                    }`}
                  >
                    Merit 60-79% ({scores.filter((s) => s.percentage >= 60 && s.percentage < 80).length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('pass')}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                      activeFilter === 'pass'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'bg-slate-900/80 text-sky-400 hover:text-sky-300 border border-slate-800'
                    }`}
                  >
                    Pass ≥ 50% ({scores.filter((s) => s.percentage >= 50 && s.percentage < 60).length})
                  </button>
                </div>
              </div>

              {/* Scoreboard List */}
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {isLoading && scores.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                    <p className="text-sm">Connecting to real-time Internal Scoreboard...</p>
                  </div>
                ) : sortedFilteredScores.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 space-y-3">
                    <Trophy className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                    <p className="text-sm font-medium">
                      {searchQuery
                        ? `No students matching "${searchQuery}"`
                        : 'No records found for the selected view.'}
                    </p>
                    <button
                      onClick={() => setCurrentPage('entry')}
                      className="text-xs px-3.5 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      Enter Student Marks
                    </button>
                  </div>
                ) : (
                  sortedFilteredScores.map((record, index) => {
                    const rank = index + 1;
                    const isNewlyAdded = record.id === newlyAddedId;
                    const isExpanded = expandedCardId === record.id;
                    const tier = getTierInfo(record.totalInternals, record.maxPossibleMarks);
                    const topperInSubjects = SUBJECT_CONFIG.filter((s) => isSubjectTopper(record.id, s.key));

                    return (
                      <div
                        key={record.id}
                        className={`rounded-xl border transition-all duration-300 ${
                          isNewlyAdded
                            ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400'
                            : record.percentage >= 80
                            ? 'bg-slate-900/90 border-yellow-500/30 hover:border-yellow-400/60'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Rank Badge */}
                            <span
                              className={`w-9 h-9 rounded-lg font-black flex items-center justify-center text-xs shadow-sm ${
                                rank === 1
                                  ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black'
                                  : rank === 2
                                  ? 'bg-slate-300 text-slate-950'
                                  : rank === 3
                                  ? 'bg-amber-700 text-amber-100'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              #{rank}
                            </span>

                            {/* Name & details */}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-100 text-sm sm:text-base">{record.name}</h4>
                                {record.regNumber && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                    {record.regNumber}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${tier.bg} ${tier.text} ${tier.border}`}
                                >
                                  {tier.label}
                                </span>

                                {/* Mode Indicator Badge: CAE 1 Only vs CAE 1 + 2 */}
                                {!record.cae2Completed ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                    CAE 1 Only (/20 per sub)
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    CAE 1+2 (/40 per sub)
                                  </span>
                                )}

                                {topperInSubjects.length > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 flex items-center gap-1">
                                    <Crown className="w-3 h-3 fill-current" />
                                    <span>Topper in {topperInSubjects.map((s) => s.short).join(', ')}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                                <span>Recorded at {record.timestamp}</span>
                                <span>•</span>
                                <span className="text-slate-300 font-medium">{record.grade}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">{record.percentage}% Aggregate</span>
                              </div>
                            </div>
                          </div>

                          {/* Score and actions */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span
                                className={`text-xl sm:text-2xl font-black ${
                                  record.percentage >= 80
                                    ? 'text-yellow-400'
                                    : record.percentage >= 60
                                    ? 'text-emerald-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {record.totalInternals}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">
                                / {record.maxPossibleMarks}
                              </span>
                            </div>

                            <button
                              onClick={() => setExpandedCardId(isExpanded ? null : record.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title={isExpanded ? 'Hide subject breakdown' : 'View subject breakdown'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {/* DELETE BUTTON: ONLY visible to this user when authorized with Code 4505 on the separate page */}
                            {isAdminUnlocked && (
                              <button
                                onClick={() => triggerDeleteAction('deleteRecord', record.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer animate-fade-in"
                                title="Delete record (Authorized via Code 4505)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Subject Breakdown Table */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/60 rounded-b-xl">
                            <div className="text-[11px] font-bold uppercase text-slate-300 mb-2 flex items-center justify-between">
                              <span>
                                {record.cae2Completed
                                  ? '5-Subject CAE 1 & CAE 2 Detailed Internal Breakdown'
                                  : '5-Subject CAE 1 Only Internal Breakdown (CAE 2 Incomplete)'}
                              </span>
                              <span className="text-amber-400 text-[10px]">
                                Formula: (Raw × 2) × 0.2
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="text-[10px] uppercase text-slate-400 bg-slate-900 border-b border-slate-800">
                                  <tr>
                                    <th className="py-2 px-3">Subject</th>
                                    <th className="py-2 px-3 text-center">CAE 1 Raw (/50)</th>
                                    <th className="py-2 px-3 text-center">CAE 1 Converted (/20)</th>
                                    <th className="py-2 px-3 text-center">CAE 2 Raw (/50)</th>
                                    <th className="py-2 px-3 text-center">CAE 2 Converted (/20)</th>
                                    <th className="py-2 px-3 text-center text-amber-300 font-bold">
                                      Total Internal ({record.cae2Completed ? '/40' : '/20'})
                                    </th>
                                    <th className="py-2 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {SUBJECT_CONFIG.map((sub) => {
                                    const subData = record.subjects?.[sub.key];
                                    const isTop = isSubjectTopper(record.id, sub.key);

                                    return (
                                      <tr key={sub.key} className={isTop ? 'bg-amber-400/5' : ''}>
                                        <td className="py-2 px-3 font-semibold text-slate-200 flex items-center gap-1.5">
                                          <span>{sub.icon}</span>
                                          <span>{sub.label}</span>
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                                          {subData?.cae1 ?? 0}
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">
                                          {subData?.c1Converted ?? 0} / 20
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                                          {record.cae2Completed ? (subData?.cae2 ?? 0) : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                                          {record.cae2Completed ? `${subData?.c2Converted ?? 0} / 20` : 'Pending'}
                                        </td>
                                        <td className="py-2 px-3 text-center font-black text-amber-400 text-sm">
                                          {subData?.internalTotal ?? 0} / {record.cae2Completed ? 40 : 20}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          {isTop ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 inline-flex items-center gap-1">
                                              <Crown className="w-2.5 h-2.5 fill-current" /> Subject Topper
                                            </span>
                                          ) : subData?.internalTotal &&
                                            subData.internalTotal >= (record.cae2Completed ? 32 : 16) ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                                              High Score
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-500">Evaluated</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE 3: SEPARATE ADMIN CODE AUTHORIZATION PAGE ================= */}
        {currentPage === 'admin' && (
          <div className="max-w-md mx-auto space-y-6 animate-fade-in py-6">
            <button
              onClick={() => {
                setCurrentPage('scoreboard');
                playSound('click');
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-2"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>Back to Internal Scoreboard</span>
            </button>

            <div className="glass-card p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-700 relative">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-white">Security Authorization Portal</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the access code to unlock management and deletion controls.
                </p>
              </div>

              {isAdminUnlocked ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Admin Mode is Currently Active</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Code 4505 has been verified. Student delete buttons and the "Clear All" option are now enabled exclusively for your browser session.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => {
                        setCurrentPage('scoreboard');
                        playSound('click');
                      }}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>Go to Scoreboard with Delete Controls</span>
                    </button>

                    <button
                      onClick={handleLockAdmin}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-semibold text-xs transition-colors cursor-pointer border border-slate-700"
                    >
                      Lock Controls (Hide Delete Options Again)
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyAdminCode} className="space-y-4">
                  <div>
                    <label htmlFor="adminCode" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Authorization Code
                    </label>
                    <div className="relative">
                      <input
                        type={showCodePassword ? 'text' : 'password'}
                        id="adminCode"
                        autoFocus
                        required
                        value={adminInputCode}
                        onChange={(e) => {
                          setAdminInputCode(e.target.value);
                          if (adminError) setAdminError(null);
                        }}
                        placeholder="Enter authorization code..."
                        className="w-full pl-4 pr-10 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm tracking-widest font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCodePassword(!showCodePassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                        title={showCodePassword ? 'Hide code' : 'Show code'}
                      >
                        {showCodePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {adminError && (
                      <p className="text-xs text-rose-400 mt-2 font-semibold flex items-center gap-1.5 animate-fade-in">
                        <span>⚠️</span>
                        <span>{adminError}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Verify & Unlock Delete Options</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage('scoreboard');
                        playSound('click');
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal for deletion (Only accessible when authorized) */}
      {confirmModalOpen && isAdminUnlocked && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 sm:p-7 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in relative">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span>Confirm Deletion</span>
              </div>
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {confirmActionType === 'clearAll'
                ? 'Are you sure you want to clear all records from the scoreboard? This action cannot be undone.'
                : 'Are you sure you want to delete this student record? This action cannot be undone.'}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={handleExecuteConfirmedDelete}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-60 text-xs sm:text-sm"
              >
                {confirmLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5 text-center text-xs text-slate-500 bg-slate-950 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>Topper promax &copy; 2026 • Sathyabama Internal Assessment Scoreboard</p>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>CAE 1 (/20) + CAE 2 (/20) = 40 Internals (or CAE 1 Only = 20 Internals)</span>
            <span>•</span>
            <button
              onClick={() => {
                setCurrentPage('admin');
                playSound('click');
              }}
              className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <KeyRound className="w-3 h-3" />
              <span>Security Access Portal</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
