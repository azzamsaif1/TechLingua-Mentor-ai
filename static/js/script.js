// Page elements
const recordBtn = document.getElementById('recordBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const summaryBtn = document.getElementById('summaryBtn');
const langButtons = document.querySelectorAll('.lang-btn');
const transcriptContainer = document.getElementById('transcript');
const translationContainer = document.getElementById('translation');
const termList = document.getElementById('termList');
const questionList = document.getElementById('questionList');
const learningRecs = document.getElementById('learningRecs');
const translationPopup = document.getElementById('translationPopup');
const overlay = document.getElementById('overlay');
const closePopup = document.getElementById('closePopup');
const originalText = document.getElementById('originalText');
const translatedText = document.getElementById('translatedText');
const questionInput = document.getElementById('questionInput');
const generateBtn = document.getElementById('generateBtn');
const languageOptions = document.querySelectorAll('.lang-option');
const audioVisualizer = document.getElementById('audioVisualizer');
const summaryContainer = document.getElementById('summaryContainer');
const summaryContent = document.getElementById('summaryContent');
const apiKeyInput = document.getElementById('apiKeyInput');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const usernameDisplay = document.getElementById('usernameDisplay');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const submitLogin = document.getElementById('submitLogin');
const submitRegister = document.getElementById('submitRegister');
const cancelLogin = document.getElementById('cancelLogin');
const cancelRegister = document.getElementById('cancelRegister');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const registerUsername = document.getElementById('registerUsername');
const registerPassword = document.getElementById('registerPassword');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');
const notificationIcon = document.getElementById('notificationIcon');
const volumeControl = document.getElementById('volumeControl');
const speedControl = document.getElementById('speedControl');
const manualText = document.getElementById('manualText');
const manualTranslateBtn = document.getElementById('manualTranslateBtn');

// System state
const state = {
    isRecording: false,
    isPaused: false,
    currentLang: 'de',
    targetLang: 'ar',
    recordedText: '',
    translatedText: '',
    termsFound: new Set(),
    questionsGenerated: 0,
    sessionStart: null,
    sessionDuration: 0,
    wordsAnalyzed: 0,
    audioContext: null,
    analyser: null,
    microphone: null,
    recognition: null,
    visualizationInterval: null,
    transcriptHistory: [],
    apiKey: '',
    currentSessionId: null,
    timerInterval: null,
    volume: 1,
    speed: 1
};

// Initialize the system
function initSystem() {
    // Update user state
    updateUserState();
    
    // Set up event handlers
    recordBtn.addEventListener('click', toggleRecording);
    pauseBtn.addEventListener('click', togglePause);
    stopBtn.addEventListener('click', stopRecording);
    downloadBtn.addEventListener('click', downloadTranscript);
    summaryBtn.addEventListener('click', toggleSummary);
    
    // Translation buttons handler
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            langButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.targetLang = btn.dataset.target;
            showNotification(`Translation language changed to ${btn.dataset.target === 'ar' ? 'Arabic' : 'English'}`);
        });
    });
    
    // Language options handler
    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            languageOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            state.currentLang = option.dataset.lang;
            
            // Update speech recognition language
            if (state.recognition) {
                state.recognition.lang = `${option.dataset.lang}-${option.dataset.lang.toUpperCase()}`;
            }
            
            showNotification(`Speech recognition language changed to ${
                option.dataset.lang === 'de' ? 'German' : 
                option.dataset.lang === 'en' ? 'English' : 'French'
            }`);
        });
    });
    
    // Translation popup handler
    closePopup.addEventListener('click', closeTranslationPopup);
    overlay.addEventListener('click', closeTranslationPopup);
    
    // Question generation handler
    generateBtn.addEventListener('click', generateQuestion);
    
    // API key handler
    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', (e) => {
            state.apiKey = e.target.value;
        });
    }
    
    // Login handlers
    loginButton.addEventListener('click', () => loginModal.style.display = 'block');
    registerButton.addEventListener('click', () => registerModal.style.display = 'block');
    logoutBtn.addEventListener('click', logoutUser);
    cancelLogin.addEventListener('click', () => loginModal.style.display = 'none');
    cancelRegister.addEventListener('click', () => registerModal.style.display = 'none');
    
    submitLogin.addEventListener('click', loginUser);
    submitRegister.addEventListener('click', registerUser);
    
    // Initialize speech recognition
    initSpeechRecognition();
    
    // Update dashboard
    updateDashboard();
    
    // Display recommendations
    displayRecommendations();
    
    // Volume and speed controls
    volumeControl.addEventListener('input', (e) => {
        state.volume = parseFloat(e.target.value);
        showNotification(`Volume level: ${Math.round(state.volume * 100)}%`);
    });
    
    speedControl.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        showNotification(`Speed: ${state.speed.toFixed(1)}x`);
    });
    
    // Manual translation handler
    manualTranslateBtn.addEventListener('click', () => {
        const text = manualText.value.trim();
        if (text) {
            translateAndShowPopup(text);
            manualText.value = '';
        } else {
            showNotification('Please enter text to translate', false);
        }
    });
    
    manualText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manualTranslateBtn.click();
        }
    });
}

// Update user state
function updateUserState() {
    if (userInfo && loginButton && registerButton) {
        if (currentUser) {
            userInfo.style.display = 'flex';
            loginButton.style.display = 'none';
            registerButton.style.display = 'none';
            usernameDisplay.textContent = currentUser.username;
        } else {
            userInfo.style.display = 'none';
            loginButton.style.display = 'flex';
            registerButton.style.display = 'flex';
        }
    }
}

// Login user
function loginUser() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    
    if (!username || !password) {
        showError(loginError, 'Please fill all fields');
        return;
    }
    
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            username: username, 
            password: password 
        })
    })
    .then(response => {
        // Check response status
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Login failed');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Reload page after login
            location.reload();
        } else {
            showError(loginError, data.error || 'Login failed');
        }
    })
    .catch(error => {
        showError(loginError, error.message || 'Server connection error');
    });
}

// Register user
function registerUser() {
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    
    if (!username || !password) {
        showError(registerError, 'Please fill all fields');
        return;
    }
    
    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            username: username, 
            password: password 
        })
    })
    .then(response => {
        // Check response status
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Registration failed');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            showError(registerError, data.error || 'Registration failed');
        }
    })
    .catch(error => {
        showError(registerError, error.message || 'Server connection error');
    });
}

// Logout user
function logoutUser() {
    fetch('/logout')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload page after logout
            location.reload();
        }
    });
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

// Show notification
function showNotification(message, isSuccess = true) {
    notificationMessage.textContent = message;
    notificationIcon.className = isSuccess ? 
        'fas fa-check-circle' : 'fas fa-exclamation-circle';
    notificationIcon.style.color = isSuccess ? '#64ffda' : '#ff4b2b';
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Initialize speech recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showNotification('Sorry, your browser does not support speech recognition. Please use Chrome or Edge.', false);
        return;
    }
    
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'de-DE';
    
    state.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                addTranscriptLine(transcript, true);
                state.transcriptHistory.push({
                    text: transcript,
                    timestamp: new Date()
                });
                
                // Extract terms
                extractTerms(transcript);
                
                // Generate automatic questions
                if (Math.random() > 0.5 && state.currentSessionId) {
                    generateAutoQuestion(transcript, state.currentSessionId);
                }
            } else {
                interimTranscript += transcript;
                addTranscriptLine(transcript, false);
            }
        }
        
        if (finalTranscript) {
            // Translate text to target language
            translateText(finalTranscript, state.targetLang)
                .then(translated => {
                    addTranslationLine(translated);
                });
            
            // Update dashboard
            updateDashboard();
        }
    };
    
    state.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        showNotification('Speech recognition error occurred', false);
    };
}

// Add transcript line
function addTranscriptLine(text, isFinal = false) {
    if (!text.trim()) return;
    
    // Update recorded text
    if (isFinal) {
        state.recordedText += text + ' ';
        state.wordsAnalyzed += text.split(' ').length;
    }
    
    // Create text element
    const line = document.createElement('div');
    line.className = `transcript-line ${isFinal ? 'final' : 'interim'}`;
    line.textContent = text;
    
    // Add translation click handler
    line.addEventListener('click', () => {
        translateAndShowPopup(text);
    });
    
    transcriptContainer.appendChild(line);
    
    // Scroll to bottom
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    
    // Send text to server for saving
    if (state.currentSessionId) {
        fetch('/api/save_transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.currentSessionId,
                text: text,
                is_final: isFinal
            })
        })
        .catch(error => console.error('Failed to save text:', error));
    }
}

// Add translation line
function addTranslationLine(text) {
    if (!text.trim()) return;
    
    const line = document.createElement('div');
    line.className = 'transcript-line final';
    line.textContent = text;
    
    translationContainer.appendChild(line);
    
    // Scroll to bottom
    translationContainer.scrollTop = translationContainer.scrollHeight;
}

// Translate and show popup
function translateAndShowPopup(text) {
    translateText(text, state.targetLang)
        .then(translated => {
            originalText.textContent = text;
            translatedText.textContent = translated;
            showTranslationPopup();
        })
        .catch(error => {
            console.error('Translation failed:', error);
            originalText.textContent = text;
            translatedText.textContent = 'Translation failed. Please try again.';
            showTranslationPopup();
        });
}

// Translate text using server
async function translateText(text, targetLang) {
    if (!text.trim()) return '';
    
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                target_lang: targetLang
            })
        });
        
        const data = await response.json();
        
        if (response.status !== 200) {
            throw new Error(data.error || 'Translation failed');
        }
        
        return data.translated_text;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

// Extract terms from text
function extractTerms(text) {
    if (!text.trim()) return;
    
    // Use NLP library to extract terms
    if (window.nlp) {
        const doc = window.nlp(text);
        const nouns = doc.nouns().out('array');
        const verbs = doc.verbs().out('array');
        
        // Combine and filter unique terms
        const potentialTerms = [...new Set([...nouns, ...verbs])];
        
        potentialTerms.forEach(term => {
            if (term.length > 3 && !state.termsFound.has(term)) {
                state.termsFound.add(term);
                addTermToSidebar(term);
                state.newTerms = state.termsFound.size;
                
                // Send term to server for saving
                if (state.currentSessionId) {
                    fetch('/api/save_term', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            session_id: state.currentSessionId,
                            term: term
                        })
                    })
                    .catch(error => console.error('Failed to save term:', error));
                }
            }
        });
    } else {
        // Simple alternative if library not available
        const words = text.split(' ');
        const potentialTerms = words.filter(word => 
            word.length > 5 && /[A-Z]/.test(word[0])
        );
        
        potentialTerms.forEach(term => {
            if (!state.termsFound.has(term)) {
                state.termsFound.add(term);
                addTermToSidebar(term);
                state.newTerms = state.termsFound.size;
                
                // Send term to server for saving
                if (state.currentSessionId) {
                    fetch('/api/save_term', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            session_id: state.currentSessionId,
                            term: term
                        })
                    })
                    .catch(error => console.error('Failed to save term:', error));
                }
            }
        });
    }
}

// Add term to sidebar
function addTermToSidebar(term) {
    const termCard = document.createElement('div');
    termCard.className = 'term-card';
    termCard.textContent = term;
    
    termCard.addEventListener('click', () => {
        showTermDefinition(term);
    });
    
    termList.appendChild(termCard);
}

// Show term definition
async function showTermDefinition(term) {
    try {
        // Get translation and definition
        const translatedTerm = await translateText(term, state.targetLang);
        
        originalText.innerHTML = `
            <strong>${term}</strong>
            <div class="term-definition">Technical term in IT field</div>
        `;
        
        translatedText.innerHTML = `
            <strong>${translatedTerm}</strong>
            <div class="term-definition">Technical term in IT field</div>
        `;
        
        showTranslationPopup();
    } catch (error) {
        console.error('Failed to get term definition:', error);
        originalText.innerHTML = `
            <strong>${term}</strong>
            <div class="term-definition">Definition not available</div>
        `;
        translatedText.innerHTML = `
            <strong>${term}</strong>
            <div class="term-definition">Definition not available</div>
        `;
        showTranslationPopup();
    }
}

// Show translation popup
function showTranslationPopup() {
    translationPopup.style.display = 'block';
    overlay.style.display = 'block';
}

// Close translation popup
function closeTranslationPopup() {
    translationPopup.style.display = 'none';
    overlay.style.display = 'none';
}

// Toggle recording state
function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// Start recording
async function startRecording() {
    // Check login status
    if (!currentUser) {
        loginModal.style.display = 'block';
        showNotification('Please login to start a new session', false);
        return;
    }
    
    if (!state.recognition) {
        showNotification('Speech recognition not initialized properly', false);
        return;
    }
    
    try {
        // Start new session on server
        const response = await fetch('/api/start_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Check response status
        if (!response.ok) {
            // If unauthorized, prompt login
            if (response.status === 401) {
                showNotification('Please login to start a new session', false);
                loginModal.style.display = 'block';
                return;
            }
            
            const errorData = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorData}`);
        }
        
        const data = await response.json();
        state.currentSessionId = data.session_id;
        
        state.isRecording = true;
        state.isPaused = false;
        state.sessionStart = new Date();
        recordBtn.classList.add('recording');
        pauseBtn.querySelector('i').className = 'fas fa-pause';
        
        // Start timer
        startTimer();
        
        // Clear previous content
        transcriptContainer.innerHTML = '';
        translationContainer.innerHTML = '';
        termList.innerHTML = '';
        questionList.innerHTML = '';
        state.termsFound.clear();
        state.recordedText = '';
        state.translatedText = '';
        state.wordsAnalyzed = 0;
        state.questionsGenerated = 0;
        state.transcriptHistory = [];
        
        // Start speech recognition
        state.recognition.start();
        
        // Start audio visualization
        initAudioVisualization();
        
        // Update dashboard
        updateDashboard();
        
        showNotification('Recording session started successfully');
    } catch (error) {
        console.error('Failed to start session:', error);
        showNotification(`Failed to start session: ${error.message}`, false);
    }
}

// Initialize audio visualization
function initAudioVisualization() {
    // Clear existing elements
    audioVisualizer.innerHTML = '';
    
    // Create bar elements
    for (let i = 0; i < 60; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        bar.style.left = `${i * 5}px`;
        bar.style.height = '2px';
        audioVisualizer.appendChild(bar);
    }
    
    // Start visualization animation
    if (state.visualizationInterval) {
        clearInterval(state.visualizationInterval);
    }
    
    state.visualizationInterval = setInterval(() => {
        const bars = audioVisualizer.querySelectorAll('.audio-bar');
        bars.forEach(bar => {
            const randomHeight = Math.floor(Math.random() * 60) + 2;
            bar.style.height = `${randomHeight}px`;
            bar.style.backgroundColor = `hsl(${200 + randomHeight}, 100%, 65%)`;
        });
    }, 100);
}

// Toggle pause state
function togglePause() {
    if (!state.isRecording) return;
    
    state.isPaused = !state.isPaused;
    pauseBtn.querySelector('i').className = state.isPaused ? 'fas fa-play' : 'fas fa-pause';
    
    if (state.isPaused) {
        state.recognition.stop();
        clearInterval(state.visualizationInterval);
        showNotification('Recording paused');
    } else {
        state.recognition.start();
        initAudioVisualization();
        showNotification('Recording resumed');
    }
}

// Stop recording
async function stopRecording() {
    if (!state.isRecording) return;
    
    state.isRecording = false;
    recordBtn.classList.remove('recording');
    clearInterval(state.timerInterval);
    
    if (state.recognition) {
        state.recognition.stop();
    }
    
    if (state.visualizationInterval) {
        clearInterval(state.visualizationInterval);
    }
    
    // Stop session on server
    if (state.currentSessionId) {
        try {
            await fetch(`/api/stop_session/${state.currentSessionId}`, {
                method: 'POST'
            });
            showNotification('Recording stopped and session saved');
        } catch (error) {
            console.error('Failed to stop session:', error);
            showNotification('Error occurred while stopping session', false);
        }
    }
    
    // Update dashboard
    updateDashboard();
    
    // Generate lecture summary
    generateSummary();
}

// Start timer
function startTimer() {
    state.sessionDuration = 0;
    clearInterval(state.timerInterval);
    
    state.timerInterval = setInterval(() => {
        if (!state.isPaused && state.isRecording) {
            // Calculate duration from start time
            const now = new Date();
            state.sessionDuration = Math.floor((now - state.sessionStart) / 1000);
            
            updateTimeDisplay();
            
            // Update session stats from server
            if (state.currentSessionId) {
                fetch(`/api/session_stats/${state.currentSessionId}`)
                    .then(response => response.json())
                    .then(data => {
                        // Update session duration from server
                        document.getElementById('sessionDuration').textContent = 
                            formatTime(data.duration);
                    })
                    .catch(error => console.error('Failed to update session stats:', error));
            }
        }
    }, 1000);
}

// Helper function to format time
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update time display
function updateTimeDisplay() {
    document.getElementById('lectureDuration').textContent = 
        formatTime(state.sessionDuration);
    document.getElementById('sessionDuration').textContent = 
        formatTime(state.sessionDuration);
}

// Download transcript
function downloadTranscript() {
    if (!state.recordedText.trim()) {
        showNotification('No text to download', false);
        return;
    }
    
    // Create file content
    const content = `TechLingua Mentor - Transcript\n\n` +
                   `Date: ${new Date().toLocaleDateString()}\n` +
                   `Duration: ${Math.floor(state.sessionDuration/60)}m ${state.sessionDuration%60}s\n\n` +
                   state.recordedText;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Transcript downloaded successfully');
}

// Toggle summary display
function toggleSummary() {
    if (state.transcriptHistory.length === 0) {
        showNotification('No content to generate summary', false);
        return;
    }
    
    summaryContainer.style.display = summaryContainer.style.display === 'block' ? 'none' : 'block';
}

// Generate lecture summary
async function generateSummary() {
    if (!state.currentSessionId) return;
    
    try {
        const response = await fetch(`/api/generate_summary/${state.currentSessionId}`);
        const data = await response.json();
        
        if (response.status === 200) {
            summaryContent.innerHTML = data.summary;
            summaryContainer.style.display = 'block';
            showNotification('Session summary generated successfully');
        } else {
            summaryContent.textContent = 'Error occurred while generating summary';
            summaryContainer.style.display = 'block';
            showNotification('Error occurred while generating summary', false);
        }
    } catch (error) {
        console.error('Failed to generate summary:', error);
        summaryContent.textContent = 'Error occurred while generating summary';
        summaryContainer.style.display = 'block';
        showNotification('Error occurred while generating summary', false);
    }
}

// Generate automatic question
async function generateAutoQuestion(text, sessionId) {
    if (state.termsFound.size > 0 && state.questionsGenerated < 5) {
        try {
            const question = `What is the concept of ${Array.from(state.termsFound)[0]} mentioned in the text?`;
            addQuestionToSidebar(question);
            state.questionsGenerated++;
            
            // Send question to server for saving
            if (state.currentSessionId) {
                fetch('/api/save_question', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        session_id: state.currentSessionId,
                        question_text: question
                    })
                })
                .catch(error => console.error('Failed to save question:', error));
            }
        } catch (error) {
            console.error('Failed to generate question:', error);
        }
    }
}

// Generate question from input
function generateQuestion() {
    const questionText = questionInput.value.trim();
    if (questionText && state.currentSessionId) {
        addQuestionToSidebar(questionText);
        state.questionsGenerated++;
        questionInput.value = '';
        updateDashboard();
        
        // Send question to server for saving
        fetch('/api/save_question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.currentSessionId,
                question_text: questionText
            })
        })
        .then(() => showNotification('Question saved successfully'))
        .catch(error => {
            console.error('Failed to save question:', error);
            showNotification('Error occurred while saving question', false);
        });
    }
}

// Add question to sidebar
function addQuestionToSidebar(question) {
    const questionCard = document.createElement('div');
    questionCard.className = 'question-card';
    questionCard.innerHTML = `
        <div class="question-text">${question}</div>
        <div class="question-actions">
            <button class="action-btn"><i class="fas fa-comment"></i> Send to Professor</button>
            <button class="action-btn"><i class="fas fa-book"></i> Show Answer</button>
        </div>
    `;
    
    questionList.appendChild(questionCard);
}

// Display learning recommendations
function displayRecommendations() {
    const recommendations = [
        "Review concepts recorded during the session",
        "Practice new technical terms",
        "Use suggested questions to test your understanding",
        "Listen to the recording again to reinforce understanding",
        "Look for additional resources on difficult topics"
    ];
    
    learningRecs.innerHTML = '';
    recommendations.forEach(rec => {
        const recItem = document.createElement('div');
        recItem.className = 'rec-item';
        recItem.innerHTML = `<i class="fas fa-check-circle"></i> ${rec}`;
        learningRecs.appendChild(recItem);
    });
}

// Update dashboard
function updateDashboard() {
    document.getElementById('wordsAnalyzed').textContent = state.wordsAnalyzed;
    document.getElementById('newTerms').textContent = state.termsFound.size;
    document.getElementById('questionsGenerated').textContent = state.questionsGenerated;
}

// Start system when page loads
document.addEventListener('DOMContentLoaded', initSystem);