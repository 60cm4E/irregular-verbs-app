// TODO: Replace with your actual Firebase config
const firebaseConfig = {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_PROJECT_ID.appspot.com",
    // messagingSenderId: "YOUR_SENDER_ID",
    // appId: "YOUR_APP_ID"
};

// Initialize Firebase (wrapped in try-catch in case config is empty)
let app, auth, db;
let isFirebaseConfigured = false;

try {
    if (Object.keys(firebaseConfig).length > 0) {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        isFirebaseConfigured = true;
    } else {
        console.warn("Firebase is not configured. Google Login and Cloud Saving will be disabled.");
    }
} catch (error) {
    console.error("Firebase initialization error", error);
}

// Application State
let currentUser = null;
let currentTestQueue = [];
let currentTestIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let isAnswerChecked = false;
let userWrongAnswers = {}; // { verbId: count }

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section');

// Navigation Logic
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        views.forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        
        const targetView = document.getElementById(targetId);
        targetView.classList.remove('hidden');
        targetView.classList.add('active');

        if (targetId === 'review-view') {
            renderReviewTable('all');
        } else if (targetId === 'test-view' && currentTestQueue.length === 0) {
            initTest();
        }
    });
});

// Render Memorize Table
function renderMemorizeTable() {
    const tbody = document.getElementById('verbs-table-body');
    tbody.innerHTML = '';
    
    // verbsData is loaded globally from data.js
    verbsData.forEach(verb => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${verb.id}</td>
            <td><strong>${verb.present}</strong></td>
            <td>${verb.past}</td>
            <td>${verb.participle}</td>
            <td>${verb.meaning}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Test Logic
function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function initTest() {
    currentTestQueue = shuffleArray(verbsData);
    currentTestIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    
    document.getElementById('test-result-screen').classList.add('hidden');
    document.querySelector('.test-container').classList.remove('hidden');
    
    updateTestStats();
    renderTestCard();
}

function updateTestStats() {
    document.getElementById('test-count').textContent = `${currentTestIndex + 1} / ${verbsData.length}`;
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('wrong-count').textContent = wrongCount;
    
    const progressPercent = ((currentTestIndex) / verbsData.length) * 100;
    document.getElementById('test-progress').style.width = `${progressPercent}%`;
}

function renderTestCard() {
    if (currentTestIndex >= currentTestQueue.length) {
        showTestResult();
        return;
    }
    
    isAnswerChecked = false;
    const verb = currentTestQueue[currentTestIndex];
    document.getElementById('test-meaning').textContent = verb.meaning;
    
    const inputs = ['input-present', 'input-past', 'input-participle'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.className = '';
        el.disabled = false;
    });
    
    document.getElementById('input-present').focus();
    document.getElementById('submit-test-btn').classList.remove('hidden');
    document.getElementById('next-test-btn').classList.add('hidden');
    document.getElementById('feedback-message').classList.add('hidden');
}

function cleanString(str) {
    return str.toLowerCase().replace(/\s+/g, '').replace(/\//g, '');
}

function isCorrect(input, expected) {
    if (!input) return false;
    const expectedParts = expected.toLowerCase().split('/');
    const cleanedInput = cleanString(input);
    
    if (expectedParts.length > 1) {
        return expectedParts.some(part => cleanString(part) === cleanedInput) || cleanString(expected) === cleanedInput;
    }
    
    if (expected.includes('(')) {
        const primary = cleanString(expected.split('(')[0]);
        const secondary = cleanString(expected.match(/\(([^)]+)\)/)[1]);
        return cleanedInput === primary || cleanedInput === secondary;
    }
    
    return cleanString(input) === cleanString(expected);
}

document.getElementById('test-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isAnswerChecked) return;
    
    const verb = currentTestQueue[currentTestIndex];
    const valPresent = document.getElementById('input-present').value;
    const valPast = document.getElementById('input-past').value;
    const valPart = document.getElementById('input-participle').value;
    
    const isPresCorrect = isCorrect(valPresent, verb.present);
    const isPastCorrect = isCorrect(valPast, verb.past);
    const isPartCorrect = isCorrect(valPart, verb.participle);
    
    const inputs = [
        { id: 'input-present', correct: isPresCorrect, expected: verb.present },
        { id: 'input-past', correct: isPastCorrect, expected: verb.past },
        { id: 'input-participle', correct: isPartCorrect, expected: verb.participle }
    ];
    
    inputs.forEach(item => {
        const el = document.getElementById(item.id);
        el.disabled = true;
        el.classList.add(item.correct ? 'correct-input' : 'wrong-input');
        if (!item.correct) {
            el.value = `${el.value} (정답: ${item.expected})`;
        }
    });
    
    const allCorrect = isPresCorrect && isPastCorrect && isPartCorrect;
    
    const feedbackEl = document.getElementById('feedback-message');
    feedbackEl.classList.remove('hidden', 'feedback-success', 'feedback-error');
    
    if (allCorrect) {
        correctCount++;
        feedbackEl.textContent = '정답입니다! 완벽해요.';
        feedbackEl.classList.add('feedback-success');
    } else {
        wrongCount++;
        feedbackEl.textContent = '틀린 부분이 있습니다. 정답을 확인하세요.';
        feedbackEl.classList.add('feedback-error');
        await recordWrongAnswer(verb.id);
    }
    
    updateTestStats();
    isAnswerChecked = true;
    
    document.getElementById('submit-test-btn').classList.add('hidden');
    document.getElementById('next-test-btn').classList.remove('hidden');
    document.getElementById('next-test-btn').focus();
});

document.getElementById('next-test-btn').addEventListener('click', () => {
    currentTestIndex++;
    renderTestCard();
});

document.getElementById('restart-test-btn').addEventListener('click', () => {
    initTest();
});

function showTestResult() {
    document.querySelector('.test-container').classList.add('hidden');
    document.getElementById('test-result-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = `${correctCount} / ${verbsData.length}`;
}

// Database & Firebase Logic
async function recordWrongAnswer(verbId) {
    userWrongAnswers[verbId] = (userWrongAnswers[verbId] || 0) + 1;
    
    if (isFirebaseConfigured && currentUser) {
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            await userRef.set({
                wrongAnswers: {
                    [verbId]: firebase.firestore.FieldValue.increment(1)
                }
            }, { merge: true });
        } catch (e) {
            console.error("Error updating Firestore:", e);
        }
    }
}

async function loadUserData() {
    if (isFirebaseConfigured && currentUser) {
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            const docSnap = await userRef.get();
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data.wrongAnswers) {
                    userWrongAnswers = data.wrongAnswers;
                }
            }
        } catch (e) {
            console.error("Error loading user data:", e);
        }
    }
}

// Review Logic
const filterChips = document.querySelectorAll('.chip');
let currentFilter = 'all';

filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.getAttribute('data-filter');
        renderReviewTable(currentFilter);
    });
});

function renderReviewTable(filter) {
    if (!currentUser && isFirebaseConfigured) {
        document.getElementById('review-login-prompt').classList.remove('hidden');
        document.getElementById('review-content-area').classList.add('hidden');
        return;
    }
    
    document.getElementById('review-login-prompt').classList.add('hidden');
    document.getElementById('review-content-area').classList.remove('hidden');
    
    const tbody = document.getElementById('review-table-body');
    tbody.innerHTML = '';
    
    let wrongVerbs = verbsData.map(v => ({
        ...v,
        wrongCount: userWrongAnswers[v.id] || 0
    })).filter(v => v.wrongCount > 0);
    
    if (filter !== 'all') {
        const minCount = parseInt(filter);
        wrongVerbs = wrongVerbs.filter(v => v.wrongCount >= minCount);
    }
    
    wrongVerbs.sort((a, b) => b.wrongCount - a.wrongCount); // Sort by most wrong
    
    if (wrongVerbs.length === 0) {
        document.getElementById('no-wrong-answers').classList.remove('hidden');
        document.querySelector('.mt-4').classList.add('hidden'); // Hide table
    } else {
        document.getElementById('no-wrong-answers').classList.add('hidden');
        document.querySelector('.mt-4').classList.remove('hidden'); // Show table
        
        wrongVerbs.forEach(verb => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${verb.present}</strong></td>
                <td>${verb.past}</td>
                <td>${verb.participle}</td>
                <td>${verb.meaning}</td>
                <td><span class="wrong-count-badge">${verb.wrongCount}번 오답</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Authentication Logic
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');

loginBtn.addEventListener('click', async () => {
    if (!isFirebaseConfigured) {
        alert("Firebase가 설정되지 않아 로컬 모드로 작동합니다.\n(실제 배포 시 Firebase Config를 추가해주세요.)");
        // Mock Login for demonstration if firebase isn't set
        currentUser = { uid: "mock_user", displayName: "Test User", photoURL: "https://ui-avatars.com/api/?name=User" };
        updateAuthUI(currentUser);
        renderReviewTable(currentFilter);
        return;
    }
    
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Login failed", error);
        alert("로그인에 실패했습니다.");
    }
});

logoutBtn.addEventListener('click', async () => {
    if (isFirebaseConfigured) {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Logout failed", error);
        }
    } else {
        currentUser = null;
        updateAuthUI(null);
        renderReviewTable(currentFilter);
    }
});

function updateAuthUI(user) {
    if (user) {
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        document.getElementById('user-name').textContent = user.displayName;
        if (user.photoURL) {
            document.getElementById('user-avatar').src = user.photoURL;
        }
    } else {
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
        userWrongAnswers = {}; // clear local state
    }
}

if (isFirebaseConfigured) {
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        updateAuthUI(user);
        if (user) {
            await loadUserData();
            if (document.getElementById('review-view').classList.contains('active')) {
                renderReviewTable(currentFilter);
            }
        }
    });
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    renderMemorizeTable();
});
