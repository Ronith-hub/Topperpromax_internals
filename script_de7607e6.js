// Topper promax - Firebase Realtime Engine & Leaderboard Synchronizer
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// IMPORTANT: Replace this Firebase configuration object with your own Firebase Project details!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresRef = collection(db, "scores");

// State Variables
let audioEnabled = true;
let audioCtx = null;
let pendingAction = null; // { type: 'clearAll' | 'deleteRecord', docId?: string }
let liveRecords = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

window.toggleAudio = function() {
    audioEnabled = !audioEnabled;
    const icon = document.getElementById('soundIcon');
    const text = document.getElementById('soundText');
    if (audioEnabled) {
        icon.className = 'fa-solid fa-volume-high text-yellow-400';
        text.innerText = 'SFX On';
    } else {
        icon.className = 'fa-solid fa-volume-xmark text-slate-500';
        text.innerText = 'SFX Off';
    }
};

function playVictorySound() {
    if (!audioEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.35);
        });
    } catch (e) {}
}

function computeSubjectScore(rawMark) {
    const val = parseFloat(rawMark) || 0;
    return parseFloat(((val * 2) * 0.2).toFixed(2));
}

window.calculateLiveMarks = function() {
    const m = computeSubjectScore(document.getElementById('maths').value);
    const e = computeSubjectScore(document.getElementById('eee').value);
    const p = computeSubjectScore(document.getElementById('phy').value);
    const c = computeSubjectScore(document.getElementById('clang').value);
    const eng = computeSubjectScore(document.getElementById('eng').value);

    document.getElementById('prevMath').innerText = m;
    document.getElementById('prevEEE').innerText = e;
    document.getElementById('prevPhy').innerText = p;
    document.getElementById('prevClang').innerText = c;
    document.getElementById('prevEng').innerText = eng;

    const total = parseFloat((m + e + p + c + eng).toFixed(2));
    document.getElementById('prevTotal').innerText = total;

    const status = document.getElementById('previewStatus');
    if (total >= 80) {
        status.className = "text-xs px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-bold border border-yellow-400/30";
        status.innerText = "Topper promax Tier 🔥";
    } else if (total >= 60) {
        status.className = "text-xs px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30";
        status.innerText = "First Class Merit ✨";
    } else {
        status.className = "text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400";
        status.innerText = "Calculating...";
    }
};

window.handleFormSubmit = async function(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Syncing to Cloud...';

    const name = document.getElementById('studentName').value.trim();
    const cma = computeSubjectScore(document.getElementById('maths').value);
    const ee = computeSubjectScore(document.getElementById('eee').value);
    const ph = computeSubjectScore(document.getElementById('phy').value);
    const cl = computeSubjectScore(document.getElementById('clang').value);
    const en = computeSubjectScore(document.getElementById('eng').value);

    const total = parseFloat((cma + ee + ph + cl + en).toFixed(2));

    const newRecord = {
        name,
        scores: { cma, ee, ph, cl, en },
        total,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: Date.now()
    };

    try {
        await addDoc(scoresRef, newRecord);
        if (total >= 80) {
            playVictorySound();
            if (typeof confetti === 'function') {
                confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            }
        }
        window.resetForm();
    } catch (err) {
        alert("Cloud Sync Error: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Submit to Live Leaderboard</span><i class="fa-solid fa-paper-plane text-sm"></i>`;
    }
};

window.resetForm = function() {
    document.getElementById('marksForm').reset();
    window.calculateLiveMarks();
};

// Real-Time Listener to broadcast score additions across all website visitors
const q = query(scoresRef, orderBy("total", "desc"));
onSnapshot(q, (snapshot) => {
    liveRecords = [];
    snapshot.forEach((docSnap) => {
        liveRecords.push({ docId: docSnap.id, ...docSnap.data() });
    });
    renderScoreboard();
});

function renderScoreboard() {
    const listEl = document.getElementById('scoreboardList');
    const emptyEl = document.getElementById('emptyState');
    const spotlightEl = document.getElementById('topScorerSpotlight');

    listEl.innerHTML = '';

    if (liveRecords.length === 0) {
        emptyEl.classList.remove('hidden');
        spotlightEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');

    // Topper Spotlight (#1 High Scorer)
    const topper = liveRecords[0];
    if (topper && topper.total >= 75) {
        spotlightEl.classList.remove('hidden');
        document.getElementById('spotlightName').innerText = topper.name;
        document.getElementById('spotlightScore').innerText = `Total Score: ${topper.total} / 100 (CAE I Internal Marks)`;
    } else {
        spotlightEl.classList.add('hidden');
    }

    liveRecords.forEach((rec, idx) => {
        const rank = idx + 1;
        const isHigh = rec.total >= 80;
        const row = document.createElement('div');
        row.className = `p-4 rounded-xl border ${isHigh ? 'bg-slate-900/90 border-yellow-500/40' : 'bg-slate-900/50 border-slate-800'} transition-all`;

        row.innerHTML = `
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-slate-800 font-bold flex items-center justify-center text-xs text-amber-400">#${rank}</span>
                    <div>
                        <h4 class="font-bold text-slate-100 text-sm">${rec.name}</h4>
                        <span class="text-[11px] text-slate-400">Recorded: ${rec.timestamp}</span>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="text-lg font-black ${isHigh ? 'text-yellow-400' : 'text-emerald-400'}">${rec.total} / 100</span>
                    <button onclick="requestHostAction('deleteRecord', '${rec.docId}')" class="text-slate-500 hover:text-rose-400 transition-colors" title="Host authorization required">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(row);
    });
}

// Host Authorization Guard (Password: Roni@15)
window.requestHostAction = function(actionType, docId = null) {
    pendingAction = { type: actionType, docId };
    document.getElementById('hostPassword').value = '';
    document.getElementById('modalError').classList.add('hidden');
    document.getElementById('hostModal').classList.remove('hidden');
};

window.closeHostModal = function() {
    pendingAction = null;
    document.getElementById('hostModal').classList.add('hidden');
};

window.verifyHostPassword = async function(e) {
    e.preventDefault();
    const enteredPass = document.getElementById('hostPassword').value;
    const errorEl = document.getElementById('modalError');

    if (enteredPass === 'Roni@15') {
        try {
            if (pendingAction.type === 'clearAll') {
                const querySnapshot = await getDocs(scoresRef);
                const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "scores", docSnap.id)));
                await Promise.all(deletePromises);
            } else if (pendingAction.type === 'deleteRecord' && pendingAction.docId) {
                await deleteDoc(doc(db, "scores", pendingAction.docId));
            }
            window.closeHostModal();
        } catch (err) {
            errorEl.innerText = "Error deleting record: " + err.message;
            errorEl.classList.remove('hidden');
        }
    } else {
        errorEl.innerText = "Access Denied: Invalid Host Password!";
        errorEl.classList.remove('hidden');
    }
};

window.onload = function() {
    window.calculateLiveMarks();
};