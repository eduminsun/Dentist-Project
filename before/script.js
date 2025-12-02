// DentCharley - 환자 커뮤니케이션 시뮬레이션 JavaScript

// 전역 변수
let currentStep = 0;
let userProfile = {
    nickname: '',
    year: '3rd',
    confidence: 'medium',
    goal: 'empathy'
};

let currentCase = null;
let simulationData = {
    messages: [],
    progress: 0,
    confidencePoints: 0,
    scores: {
        rapport: 0,
        empathy: 0,
        clarity: 0,
        questioning: 0
    }
};

let userData = {
    completedCases: 0,
    totalScore: 0,
    totalTime: 0,
    reflections: [],
    feedback: []
};

// 시나리오 데이터
const caseScenarios = {
    'sensitivity-anxious': {
        id: 'sensitivity-anxious',
        title: 'Case #01: Tooth Sensitivity',
        patient: 'Jina Kim (F, 28, anxious type)',
        difficulty: 'Beginner',
        type: 'Anxious',
        messages: [
            {
                type: 'patient',
                content: "It really hurts when I drink cold water...",
                emotion: "😰"
            },
            {
                type: 'patient',
                content: "I'm worried it's getting worse.",
                emotion: "😰"
            }
        ],
        suggestions: [
            "Can you describe the pain?",
            "When did it start?",
            "How often does it happen?"
        ],
        responses: {
            'empathy': [
                "I understand how concerning this must be for you.",
                "That sounds really uncomfortable.",
                "I can see this is worrying you."
            ],
            'questioning': [
                "Can you tell me more about the pain?",
                "What makes it better or worse?",
                "Have you noticed any patterns?"
            ],
            'explanation': [
                "Let me explain what might be causing this.",
                "This is actually quite common.",
                "There are several treatment options we can consider."
            ]
        },
        evaluation: {
            maxScore: 5,
            criteria: {
                'greeting': { weight: 1, description: 'Friendly greeting' },
                'agenda': { weight: 1, description: 'Set agenda' },
                'openQuestions': { weight: 2, description: 'Asked open-ended questions' },
                'empathy': { weight: 2, description: 'Showed empathy' },
                'explanation': { weight: 2, description: 'Clear explanation' },
                'understanding': { weight: 1, description: 'Checked understanding' },
                'nextSteps': { weight: 1, description: 'Confirmed next steps' }
            }
        }
    },
    'wisdom-calm': {
        id: 'wisdom-calm',
        title: 'Case #02: Wisdom Tooth',
        patient: 'David Park (M, 24, calm type)',
        difficulty: 'Intermediate',
        type: 'Calm',
        messages: [
            {
                type: 'patient',
                content: "My dentist said I need to remove my wisdom tooth.",
                emotion: "😌"
            },
            {
                type: 'patient',
                content: "I'm not sure what to expect.",
                emotion: "🤔"
            }
        ],
        suggestions: [
            "What questions do you have?",
            "Have you had surgery before?",
            "Would you like me to explain the procedure?"
        ],
        responses: {
            'information': [
                "Let me explain the procedure step by step.",
                "It's a routine procedure that takes about 30 minutes.",
                "You'll be given local anesthesia."
            ],
            'reassurance': [
                "Most patients recover quickly.",
                "We'll make sure you're comfortable.",
                "You can ask questions anytime."
            ]
        },
        evaluation: {
            maxScore: 5,
            criteria: {
                'greeting': { weight: 1, description: 'Friendly greeting' },
                'information': { weight: 2, description: 'Provided clear information' },
                'reassurance': { weight: 2, description: 'Offered reassurance' },
                'questions': { weight: 1, description: 'Encouraged questions' },
                'followup': { weight: 1, description: 'Discussed follow-up care' }
            }
        }
    }
};

// 메시지 전송 (애니메이션 수정)
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput || !messageInput.value.trim()) return;
    
    const message = messageInput.value.trim();
    messageInput.value = '';
    
    // 사용자 메시지 추가
    simulationData.messages.push({
        type: 'user',
        content: message
    });
    
    // 점수 계산
    calculateScore(message);
    
    // 화면 업데이트
    updateChatMessages();
    
    // 로딩 표시
    showLoadingMessage();
    
    // 환자 응답 생성 (지연)
    setTimeout(() => {
        hideLoadingMessage();
        generatePatientResponse(message);
        updateChatMessages();
        updateProgress();
        updateConfidencePoints();
        
        // 시뮬레이션 완료 체크
        if (simulationData.progress >= 100) {
            setTimeout(() => {
                showEvaluationScreen();
            }, 2000);
        }
    }, 2000 + Math.random() * 1000); // 2-3초 랜덤 지연
}

// 로딩 메시지 표시
function showLoadingMessage() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message patient-message';
    loadingDiv.id = 'loading-message';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-dots';
    contentDiv.textContent = 'Patient is thinking';
    
    loadingDiv.appendChild(contentDiv);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 로딩 메시지 숨기기
function hideLoadingMessage() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// 화면 전환 함수 (애니메이션 추가)
function showScreen(screenId) {
    // 현재 활성 화면에 페이드 아웃 효과
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.style.animation = 'fadeOut 0.3s ease-out';
    }
    
    // 모든 화면 숨기기
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // 선택된 화면 보이기
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // 화면별 초기화
        switch(screenId) {
            case 'main-screen':
                updateMainScreen();
                break;
            case 'dashboard-screen':
                updateDashboard();
                break;
            case 'case-library-screen':
                updateCaseLibrary();
                break;
        }
    }
}

// 성공 애니메이션 추가
function showSuccessAnimation(element) {
    if (element) {
        element.classList.add('success-animation');
        setTimeout(() => {
            element.classList.remove('success-animation');
        }, 600);
    }
}

// 경고 애니메이션 추가
function showWarningAnimation(element) {
    if (element) {
        element.classList.add('warning-animation');
        setTimeout(() => {
            element.classList.remove('warning-animation');
        }, 1000);
    }
}

// 온보딩 단계 진행
function nextStep() {
    currentStep++;
    
    switch(currentStep) {
        case 1:
            showScreen('profile-screen');
            break;
        case 2:
            showScreen('goals-screen');
            break;
        case 3:
            showScreen('case-prep-screen');
            break;
        case 4:
            // 온보딩 완료, 메인 화면으로
            saveUserProfile();
            showScreen('main-screen');
            break;
    }
}

// 사용자 프로필 저장
function saveUserProfile() {
    const nickname = document.getElementById('nickname')?.value || 'User';
    const year = document.querySelector('input[name="year"]:checked')?.value || '3rd';
    const confidence = document.querySelector('.confidence-btn.active')?.dataset.level || 'medium';
    const goal = document.querySelector('.goal-card.active')?.dataset.goal || 'empathy';
    
    userProfile = {
        nickname,
        year,
        confidence,
        goal
    };
    
    // LocalStorage에 저장
    localStorage.setItem('dentCharley_profile', JSON.stringify(userProfile));
    
    // 메인 화면 업데이트
    updateMainScreen();
}

// 메인 화면 업데이트
function updateMainScreen() {
    const nicknameElement = document.getElementById('user-nickname');
    const completedCasesElement = document.getElementById('completed-cases');
    
    if (nicknameElement) {
        nicknameElement.textContent = userProfile.nickname || 'User';
    }
    
    if (completedCasesElement) {
        completedCasesElement.textContent = userData.completedCases || 0;
    }
}

// 케이스 시작
function startCase(caseId) {
    currentCase = caseScenarios[caseId];
    if (!currentCase) return;
    
    // 시뮬레이션 데이터 초기화
    simulationData = {
        messages: [...currentCase.messages],
        progress: 0,
        confidencePoints: 0,
        scores: {
            rapport: 0,
            empathy: 0,
            clarity: 0,
            questioning: 0
        }
    };
    
    // 시뮬레이션 화면 업데이트
    updateSimulationScreen();
    showScreen('simulation-screen');
}

// 시뮬레이션 화면 업데이트
function updateSimulationScreen() {
    if (!currentCase) return;
    
    // 헤더 업데이트
    const caseTitle = document.getElementById('case-title');
    const patientInfo = document.getElementById('patient-info');
    
    if (caseTitle) caseTitle.textContent = currentCase.title;
    if (patientInfo) patientInfo.textContent = currentCase.patient;
    
    // 채팅 메시지 업데이트
    updateChatMessages();
    
    // 추천 질문 업데이트
    updateSuggestedQuestions();
    
    // 진행률 업데이트
    updateProgress();
}

// 채팅 메시지 업데이트 (스크롤만 유지)
function updateChatMessages() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    simulationData.messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.content;
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
    });
    
    // 스크롤을 맨 아래로 (부드럽게)
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// 추천 질문 업데이트
function updateSuggestedQuestions() {
    const suggestionsContainer = document.querySelector('.suggested-questions');
    if (!suggestionsContainer || !currentCase) return;
    
    suggestionsContainer.innerHTML = '';
    
    currentCase.suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion-btn';
        button.textContent = suggestion;
        button.onclick = () => sendSuggestion(suggestion);
        suggestionsContainer.appendChild(button);
    });
}

// 메시지 전송
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput || !messageInput.value.trim()) return;
    
    const message = messageInput.value.trim();
    messageInput.value = '';
    
    // 사용자 메시지 추가
    simulationData.messages.push({
        type: 'user',
        content: message
    });
    
    // 점수 계산
    calculateScore(message);
    
    // 환자 응답 생성
    generatePatientResponse(message);
    
    // 화면 업데이트
    updateChatMessages();
    updateProgress();
    updateConfidencePoints();
    
    // 시뮬레이션 완료 체크
    if (simulationData.progress >= 100) {
        setTimeout(() => {
            showEvaluationScreen();
        }, 2000);
    }
}

// 추천 질문 전송
function sendSuggestion(suggestion) {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.value = suggestion;
        sendMessage();
    }
}

// 점수 계산
function calculateScore(message) {
    const lowerMessage = message.toLowerCase();
    
    // 공감 표현 체크
    if (lowerMessage.includes('understand') || lowerMessage.includes('feel') || lowerMessage.includes('sorry')) {
        simulationData.scores.empathy += 1;
    }
    
    // 개방형 질문 체크
    if (lowerMessage.includes('?') && (lowerMessage.includes('how') || lowerMessage.includes('what') || lowerMessage.includes('when'))) {
        simulationData.scores.questioning += 1;
    }
    
    // 명확한 설명 체크
    if (lowerMessage.includes('explain') || lowerMessage.includes('procedure') || lowerMessage.includes('treatment')) {
        simulationData.scores.clarity += 1;
    }
    
    // 라포 형성 체크
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('welcome')) {
        simulationData.scores.rapport += 1;
    }
}

// 환자 응답 생성
function generatePatientResponse(userMessage) {
    const responses = [
        "That makes sense. Can you tell me more?",
        "I see. What should I expect?",
        "Thank you for explaining that.",
        "I feel more comfortable now.",
        "That's helpful to know.",
        "I have another question...",
        "What about the recovery time?",
        "Will it be painful?"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    simulationData.messages.push({
        type: 'patient',
        content: randomResponse,
        emotion: "😌"
    });
    
    // 진행률 증가
    simulationData.progress = Math.min(simulationData.progress + 15, 100);
}

// 진행률 업데이트
function updateProgress() {
    const progressPercentage = document.getElementById('progress-percentage');
    const progressFill = document.querySelector('.progress-fill');
    
    if (progressPercentage) {
        progressPercentage.textContent = simulationData.progress;
    }
    
    if (progressFill) {
        progressFill.style.width = `${simulationData.progress}%`;
    }
}

// 자신감 포인트 업데이트
function updateConfidencePoints() {
    const confidencePoints = document.getElementById('confidence-points');
    
    if (confidencePoints) {
        simulationData.confidencePoints += Math.floor(Math.random() * 3) + 1;
        confidencePoints.textContent = simulationData.confidencePoints;
    }
}

// 평가 화면 표시
function showEvaluationScreen() {
    if (!currentCase) return;
    
    // 전체 점수 계산
    const totalScore = calculateOverallScore();
    
    // 평가 화면 업데이트
    updateEvaluationScreen(totalScore);
    
    // 사용자 데이터 업데이트
    updateUserData(totalScore);
    
    showScreen('evaluation-screen');
}

// 전체 점수 계산
function calculateOverallScore() {
    const scores = simulationData.scores;
    const totalPossible = Object.keys(scores).length * 2; // 각 스킬당 최대 2점
    const totalEarned = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    return Math.round((totalEarned / totalPossible) * 5 * 10) / 10; // 5점 만점으로 변환
}

// 평가 화면 업데이트
function updateEvaluationScreen(overallScore) {
    const overallScoreElement = document.getElementById('overall-score');
    const rapportPercentage = document.getElementById('rapport-percentage');
    
    if (overallScoreElement) {
        overallScoreElement.textContent = overallScore;
    }
    
    if (rapportPercentage) {
        rapportPercentage.textContent = Math.round(simulationData.scores.rapport * 20);
    }
}

// 사용자 데이터 업데이트
function updateUserData(score) {
    userData.completedCases++;
    userData.totalScore = (userData.totalScore * (userData.completedCases - 1) + score) / userData.completedCases;
    userData.totalTime += 15; // 예상 시간 15분
    
    // LocalStorage에 저장
    localStorage.setItem('dentCharley_userData', JSON.stringify(userData));
}

// 성찰 저널 저장
function saveReflection() {
    const reflectionText = document.getElementById('reflection-text');
    const saveStatus = document.getElementById('save-status');
    
    if (!reflectionText || !reflectionText.value.trim()) {
        showSaveStatus('Please write something first!', 'error');
        return;
    }
    
    // 성찰 저널 데이터 생성
    const reflection = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ko-KR'),
        caseId: currentCase ? currentCase.id : 'unknown',
        caseTitle: currentCase ? currentCase.title : 'Unknown Case',
        score: calculateOverallScore(),
        content: reflectionText.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    // 사용자 데이터에 추가
    if (!userData.reflections) {
        userData.reflections = [];
    }
    
    userData.reflections.unshift(reflection); // 최신 항목을 맨 앞에 추가
    
    // 최대 50개까지만 저장
    if (userData.reflections.length > 50) {
        userData.reflections = userData.reflections.slice(0, 50);
    }
    
    // LocalStorage에 저장
    localStorage.setItem('dentCharley_userData', JSON.stringify(userData));
    
    // 성공 메시지 표시
    showSaveStatus('Reflection saved successfully!', 'success');
    
    // 텍스트 영역 비우기
    reflectionText.value = '';
    
    // 대시보드 업데이트 (만약 열려있다면)
    if (document.getElementById('dashboard-screen').classList.contains('active')) {
        updateJournalList();
    }
}

// 저장 상태 메시지 표시
function showSaveStatus(message, type) {
    const saveStatus = document.getElementById('save-status');
    if (!saveStatus) return;
    
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type}`;
    
    // 3초 후 메시지 숨기기
    setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'save-status';
    }, 3000);
}

// 대시보드 업데이트
function updateDashboard() {
    // 통계 카드 업데이트
    const casesCompleted = document.getElementById('cases-completed');
    const feedbackScore = document.getElementById('feedback-score');
    const confidenceGrowth = document.getElementById('confidence-growth');
    const totalTime = document.getElementById('total-time');
    
    if (casesCompleted) casesCompleted.textContent = userData.completedCases;
    if (feedbackScore) feedbackScore.textContent = userData.totalScore.toFixed(1);
    if (confidenceGrowth) confidenceGrowth.textContent = `+${Math.floor(Math.random() * 20) + 10}%`;
    if (totalTime) totalTime.textContent = formatTime(userData.totalTime);
    
    // 차트 업데이트
    updateActivityChart();
    updateSkillsRadar();
    updateCaseMap();
    updateFeedbackList();
    updateJournalList();
}

// 시간 포맷팅
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

// 활동 차트 업데이트
function updateActivityChart() {
    const chart = document.getElementById('activity-chart');
    if (!chart) return;
    
    // 주간 활동 데이터 생성
    const weekData = [20, 20, 20, 30, 20, 25, 20];
    const maxValue = Math.max(...weekData);
    
    chart.innerHTML = `
        <div class="activity-chart-container">
            <div class="chart-bars">
                ${weekData.map((value, index) => `
                    <div class="chart-bar" style="height: ${(value / maxValue) * 100}%">
                        <div class="bar-value">${value}</div>
                    </div>
                `).join('')}
            </div>
            <div class="chart-labels">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
        </div>
    `;
}

// 스킬 레이더 업데이트
function updateSkillsRadar() {
    const radar = document.getElementById('skills-radar');
    if (!radar) return;
    
    const skills = [
        { name: 'Skill 1', value: Math.floor(Math.random() * 100) },
        { name: 'Skill 2', value: Math.floor(Math.random() * 100) },
        { name: 'Skill 3', value: Math.floor(Math.random() * 100) },
        { name: 'Skill 4', value: Math.floor(Math.random() * 100) },
        { name: 'Skill 5', value: Math.floor(Math.random() * 100) },
        { name: 'Skill 6', value: Math.floor(Math.random() * 100) }
    ];
    
    // 레이더 차트 생성
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    
    // 배경 그리드
    ctx.strokeStyle = 'var(--border-color)';
    ctx.lineWidth = 1;
    
    // 동심원 그리기
    for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (radius * i) / 5, 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    // 축 그리기
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // 스킬 이름 표시
        const labelX = centerX + (radius + 20) * Math.cos(angle);
        const labelY = centerY + (radius + 20) * Math.sin(angle);
        
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '8px Press Start 2P';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(skills[i].name, labelX, labelY);
    }
    
    // 데이터 영역 그리기
    ctx.fillStyle = 'rgba(92, 225, 230, 0.3)';
    ctx.strokeStyle = 'var(--accent-cyan)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        const value = skills[i].value / 100;
        const x = centerX + radius * value * Math.cos(angle);
        const y = centerY + radius * value * Math.sin(angle);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // 데이터 포인트 표시
    ctx.fillStyle = 'var(--accent-cyan)';
    for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        const value = skills[i].value / 100;
        const x = centerX + radius * value * Math.cos(angle);
        const y = centerY + radius * value * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // 값 표시
        ctx.fillStyle = 'var(--text-primary)';
        ctx.font = '6px Press Start 2P';
        ctx.fillText(skills[i].value + '%', x, y - 10);
        ctx.fillStyle = 'var(--accent-cyan)';
    }
    
    radar.innerHTML = '';
    radar.appendChild(canvas);
}

// 케이스 맵 업데이트 (픽셀 아트 캐릭터 그리드)
function updateCaseMap() {
    const map = document.getElementById('case-map');
    if (!map) return;
    
    // 케이스 데이터 정의 (그리드 위치 기반)
    const cases = [
        { 
            id: 'sensitivity-calm', 
            name: 'Tooth Sensitivity (Calm)', 
            status: 'completed', 
            row: 1, col: 3,
            avatar: { hair: 'brown', skin: 'light', shirt: 'brown' }
        },
        { 
            id: 'cush', 
            name: 'Cush', 
            status: 'available', 
            row: 1, col: 5,
            avatar: { hair: 'blonde', skin: 'light', shirt: 'pink' }
        },
        { 
            id: 'carly', 
            name: 'Carly', 
            status: 'available', 
            row: 1, col: 8,
            avatar: { hair: 'brown', skin: 'light', shirt: 'orange', glasses: true }
        },
        { 
            id: 'case-2-1', 
            name: '', 
            status: 'locked', 
            row: 2, col: 1,
            avatar: { hair: 'dark', skin: 'light', shirt: 'purple' }
        },
        { 
            id: 'case-2-4', 
            name: '', 
            status: 'locked', 
            row: 2, col: 4,
            avatar: { hair: 'brown', skin: 'light', shirt: 'red' }
        },
        { 
            id: 'case-2-6', 
            name: '', 
            status: 'locked', 
            row: 2, col: 6,
            avatar: { hair: 'brown', skin: 'light', shirt: 'dark-grey', beard: true }
        },
        { 
            id: 'case-3-1', 
            name: '', 
            status: 'locked', 
            row: 3, col: 1,
            avatar: { hair: 'dark', skin: 'light', shirt: 'light-green' }
        },
        { 
            id: 'case-3-5', 
            name: '', 
            status: 'locked', 
            row: 3, col: 5,
            avatar: { hair: 'dark', skin: 'light', shirt: 'blue' }
        },
        { 
            id: 'case-3-7', 
            name: '', 
            status: 'locked', 
            row: 3, col: 7,
            avatar: { hair: 'brown', skin: 'light', shirt: 'white', overalls: 'blue' }
        },
        { 
            id: 'sensitivity-anxious', 
            name: 'Tooth Sensitivity (Anxious)', 
            status: 'completed', 
            row: 4, col: 2,
            avatar: { hair: 'brown', skin: 'light', shirt: 'brown' }
        },
        { 
            id: 'case-4-6', 
            name: '', 
            status: 'locked', 
            row: 4, col: 6,
            avatar: { hair: 'dark', skin: 'light', shirt: 'pink' }
        },
        { 
            id: 'folt', 
            name: 'Folt', 
            status: 'available', 
            row: 4, col: 8,
            avatar: { hair: 'brown', skin: 'light', shirt: 'pink' }
        },
        { 
            id: 'wisdom-calm', 
            name: 'Wisdom Tooth (Calm)', 
            status: 'completed', 
            row: 5, col: 4,
            avatar: { hair: 'grey', skin: 'light', shirt: 'white', tie: 'blue' }
        },
        { 
            id: 'tooth-case', 
            name: 'Tooth (Tooth)', 
            status: 'available', 
            row: 5, col: 7,
            avatar: { hair: 'dark', skin: 'light', shirt: 'green' }
        }
    ];
    
    // 그리드 컨테이너 생성
    const gridContainer = document.createElement('div');
    gridContainer.className = 'case-map-grid';
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(8, 1fr)';
    gridContainer.style.gridTemplateRows = 'repeat(5, 1fr)';
    gridContainer.style.gap = '8px';
    gridContainer.style.padding = '20px';
    gridContainer.style.height = '100%';
    gridContainer.style.backgroundColor = 'var(--bg-primary)';
    gridContainer.style.borderRadius = '8px';
    gridContainer.style.border = '2px solid var(--border-color)';
    
    // 빈 셀들 생성 (8x5 그리드)
    for (let row = 1; row <= 5; row++) {
        for (let col = 1; col <= 8; col++) {
            const cell = document.createElement('div');
            cell.className = 'case-map-cell';
            cell.style.gridRow = row;
            cell.style.gridColumn = col;
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
            cell.style.minHeight = '60px';
            cell.style.position = 'relative';
            
            // 해당 위치에 케이스가 있는지 확인
            const caseItem = cases.find(c => c.row === row && c.col === col);
            
            if (caseItem) {
                // 픽셀 아트 캐릭터 생성
                const avatar = createPixelAvatar(caseItem.avatar, caseItem.status);
                cell.appendChild(avatar);
                
                // 케이스 이름 표시 (있는 경우만)
                if (caseItem.name) {
                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'case-name-label';
                    nameLabel.textContent = caseItem.name;
                    nameLabel.style.fontSize = '6px';
                    nameLabel.style.color = 'var(--text-primary)';
                    nameLabel.style.textAlign = 'center';
                    nameLabel.style.marginTop = '4px';
                    nameLabel.style.maxWidth = '80px';
                    nameLabel.style.wordWrap = 'break-word';
                    cell.appendChild(nameLabel);
                }
                
                // 클릭 이벤트 (사용 가능한 케이스만)
                if (caseItem.status === 'available' || caseItem.status === 'completed') {
                    cell.style.cursor = 'pointer';
                    cell.addEventListener('click', () => {
                        if (caseItem.id && caseItem.id !== 'case-2-1' && caseItem.id !== 'case-2-4' && caseItem.id !== 'case-2-6' && caseItem.id !== 'case-3-1' && caseItem.id !== 'case-3-5' && caseItem.id !== 'case-3-7' && caseItem.id !== 'case-4-6') {
                            startCase(caseItem.id);
                        }
                    });
                }
            }
            
            gridContainer.appendChild(cell);
        }
    }
    
    map.innerHTML = '';
    map.appendChild(gridContainer);
}

// 픽셀 아트 캐릭터 생성 함수
function createPixelAvatar(avatarData, status) {
    const avatar = document.createElement('div');
    avatar.className = 'pixel-avatar';
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.position = 'relative';
    avatar.style.imageRendering = 'pixelated';
    avatar.style.imageRendering = '-moz-crisp-edges';
    avatar.style.imageRendering = 'crisp-edges';
    
    // 상태에 따른 투명도
    if (status === 'locked') {
        avatar.style.opacity = '0.5';
    }
    
    // 피부색
    const skinColor = avatarData.skin === 'light' ? '#f4a261' : '#d4a574';
    
    // 머리카락 색상
    const hairColor = avatarData.hair === 'brown' ? '#8b4513' : 
                     avatarData.hair === 'blonde' ? '#f4d03f' : 
                     avatarData.hair === 'dark' ? '#2c1810' : '#a0a0a0';
    
    // 셔츠 색상
    const shirtColor = avatarData.shirt === 'brown' ? '#8b4513' :
                      avatarData.shirt === 'pink' ? '#ff69b4' :
                      avatarData.shirt === 'orange' ? '#ff8c00' :
                      avatarData.shirt === 'purple' ? '#8a2be2' :
                      avatarData.shirt === 'red' ? '#dc143c' :
                      avatarData.shirt === 'dark-grey' ? '#696969' :
                      avatarData.shirt === 'light-green' ? '#90ee90' :
                      avatarData.shirt === 'blue' ? '#4169e1' :
                      avatarData.shirt === 'white' ? '#ffffff' :
                      avatarData.shirt === 'green' ? '#228b22' : '#87ceeb';
    
    // 캐릭터 구성 요소들
    const elements = [];
    
    // 머리카락
    elements.push({
        type: 'div',
        style: {
            position: 'absolute',
            top: '2px',
            left: '4px',
            width: '24px',
            height: '12px',
            backgroundColor: hairColor,
            borderRadius: '6px 6px 0 0'
        }
    });
    
    // 얼굴
    elements.push({
        type: 'div',
        style: {
            position: 'absolute',
            top: '8px',
            left: '6px',
            width: '20px',
            height: '16px',
            backgroundColor: skinColor,
            borderRadius: '2px'
        }
    });
    
    // 눈
    elements.push({
        type: 'div',
        style: {
            position: 'absolute',
            top: '12px',
            left: '8px',
            width: '2px',
            height: '2px',
            backgroundColor: '#000',
            borderRadius: '1px',
            boxShadow: '6px 0 0 #000'
        }
    });
    
    // 입
    elements.push({
        type: 'div',
        style: {
            position: 'absolute',
            top: '18px',
            left: '12px',
            width: '4px',
            height: '1px',
            backgroundColor: '#000',
            borderRadius: '1px'
        }
    });
    
    // 셔츠/상의
    elements.push({
        type: 'div',
        style: {
            position: 'absolute',
            top: '20px',
            left: '4px',
            width: '24px',
            height: '12px',
            backgroundColor: shirtColor,
            borderRadius: '0 0 2px 2px'
        }
    });
    
    // 특수 요소들
    if (avatarData.glasses) {
        elements.push({
            type: 'div',
            style: {
                position: 'absolute',
                top: '10px',
                left: '6px',
                width: '20px',
                height: '6px',
                border: '1px solid #000',
                borderRadius: '3px',
                backgroundColor: 'transparent'
            }
        });
    }
    
    if (avatarData.beard) {
        elements.push({
            type: 'div',
            style: {
                position: 'absolute',
                top: '16px',
                left: '10px',
                width: '8px',
                height: '4px',
                backgroundColor: hairColor,
                borderRadius: '0 0 4px 4px'
            }
        });
    }
    
    if (avatarData.overalls) {
        elements.push({
            type: 'div',
            style: {
                position: 'absolute',
                top: '24px',
                left: '2px',
                width: '28px',
                height: '8px',
                backgroundColor: avatarData.overalls === 'blue' ? '#4169e1' : '#000',
                borderRadius: '0 0 4px 4px'
            }
        });
    }
    
    if (avatarData.tie) {
        elements.push({
            type: 'div',
            style: {
                position: 'absolute',
                top: '22px',
                left: '14px',
                width: '4px',
                height: '8px',
                backgroundColor: avatarData.tie === 'blue' ? '#4169e1' : '#000',
                borderRadius: '0 0 2px 2px'
            }
        });
    }
    
    // 요소들을 DOM에 추가
    elements.forEach(elementData => {
        const element = document.createElement(elementData.type);
        Object.assign(element.style, elementData.style);
        avatar.appendChild(element);
    });
    
    return avatar;
}

// 피드백 목록 업데이트
function updateFeedbackList() {
    const list = document.getElementById('feedback-list');
    if (!list) return;
    
    const feedbacks = [
        "Empathy improved in Case #10",
        "Remember to use fewer medical terms",
        "Good job explaining treatment options"
    ];
    
    list.innerHTML = '';
    feedbacks.forEach(feedback => {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.innerHTML = `<div class="feedback-text">${feedback}</div>`;
        list.appendChild(item);
    });
}

// 저널 목록 업데이트
function updateJournalList() {
    const list = document.getElementById('journal-list');
    if (!list) return;
    
    // 저장된 성찰 저널이 없으면 기본 메시지 표시
    if (!userData.reflections || userData.reflections.length === 0) {
        list.innerHTML = `
            <div class="journal-item">
                <div class="journal-date">No reflections yet</div>
                <div class="journal-text">Complete simulations and save your reflections!</div>
            </div>
        `;
        return;
    }
    
    // 최근 10개 항목만 표시
    const recentReflections = userData.reflections.slice(0, 10);
    
    list.innerHTML = '';
    recentReflections.forEach(reflection => {
        const item = document.createElement('div');
        item.className = 'journal-item';
        
        // 날짜 포맷팅
        const date = new Date(reflection.timestamp);
        const formattedDate = date.toLocaleDateString('ko-KR', { 
            month: 'short', 
            day: 'numeric' 
        });
        
        // 케이스 제목과 점수 표시
        const caseInfo = `${reflection.caseTitle} (${reflection.score}/5)`;
        
        item.innerHTML = `
            <div class="journal-date">${formattedDate}</div>
            <div class="journal-case">${caseInfo}</div>
            <div class="journal-text">${reflection.content}</div>
        `;
        list.appendChild(item);
    });
}

// 케이스 라이브러리 업데이트
function updateCaseLibrary() {
    // 케이스 카드들은 이미 HTML에 정의되어 있음
    // 필요시 동적으로 업데이트
}

// 케이스 다시 플레이
function replayCase() {
    if (currentCase) {
        startCase(currentCase.id);
    }
}

// 대시보드로 이동
function goToDashboard() {
    showScreen('dashboard-screen');
}

// 데이터 내보내기
function exportData() {
    const data = {
        profile: userProfile,
        userData: userData,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dentcharley-data.json';
    a.click();
    URL.revokeObjectURL(url);
}

// 데이터 초기화
function resetData() {
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
        localStorage.removeItem('dentCharley_profile');
        localStorage.removeItem('dentCharley_userData');
        location.reload();
    }
}

// 데이터 로드
function loadUserData() {
    const savedProfile = localStorage.getItem('dentCharley_profile');
    const savedUserData = localStorage.getItem('dentCharley_userData');
    
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
    }
    
    if (savedUserData) {
        userData = JSON.parse(savedUserData);
    }
}

// 캐릭터 반응 메시지 데이터
const characterResponses = {
    // 프로필 설정 화면 반응
    profile: {
        nickname: {
            default: "Nice to meet you!",
            responses: {
                "": "Nice to meet you!",
                "doctor": "Hello Dr. Doctor! 😄",
                "student": "Great to meet a fellow student!",
                "future": "I love your positive attitude!",
                "dental": "Perfect name for a dental student!"
            }
        },
        year: {
            "3rd": "Third year - you're getting there!",
            "4th": "Fourth year - almost ready for practice!",
            "graduate": "Graduate - ready to make a difference!"
        },
        confidence: {
            "low": "Don't worry, we'll build your confidence together!",
            "medium": "That's a great starting point!",
            "high": "Excellent! Let's refine those skills!"
        }
    },
    // 학습 목표 화면 반응
    goals: {
        "explaining": "Clear explanations are so important!",
        "calming": "Calming anxious patients is a valuable skill!",
        "dealing": "Handling anxious patients takes practice!",
        "empathy": "Empathy is the heart of good care!",
        "questioning": "Asking the right questions is an art!"
    }
};

// 캐릭터 말풍선 업데이트 함수
function updateCharacterSpeech(screen, context, value) {
    let speechBubble;
    let message = "";
    
    if (screen === 'profile') {
        speechBubble = document.getElementById('profile-speech-bubble');
        
        if (context === 'nickname') {
            // 닉네임에 따른 반응
            const responses = characterResponses.profile.nickname.responses;
            for (const [key, response] of Object.entries(responses)) {
                if (value.toLowerCase().includes(key.toLowerCase())) {
                    message = response;
                    break;
                }
            }
            if (!message) message = `Nice to meet you, ${value}!`;
        } else if (context === 'year') {
            message = characterResponses.profile.year[value] || "Great choice!";
        } else if (context === 'confidence') {
            message = characterResponses.profile.confidence[value] || "Perfect!";
        }
    } else if (screen === 'goals') {
        speechBubble = document.getElementById('goals-speech-bubble');
        message = characterResponses.goals[value] || "That's a great goal!";
    }
    
    if (speechBubble && message) {
        // 페이드 아웃 효과
        speechBubble.style.opacity = '0';
        speechBubble.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            speechBubble.textContent = message;
            speechBubble.style.opacity = '1';
            speechBubble.style.transform = 'translateY(0)';
        }, 200);
    }
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    // 데이터 로드
    loadUserData();
    
    // 닉네임 입력 반응
    const nicknameInput = document.getElementById('nickname');
    if (nicknameInput) {
        nicknameInput.addEventListener('input', function() {
            updateCharacterSpeech('profile', 'nickname', this.value);
        });
    }
    
    // 학년 선택 반응
    const yearRadios = document.querySelectorAll('input[name="year"]');
    yearRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            updateCharacterSpeech('profile', 'year', this.value);
        });
    });
    
    // 자신감 레벨 선택
    const confidenceBtns = document.querySelectorAll('.confidence-btn');
    confidenceBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            confidenceBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 캐릭터 반응
            updateCharacterSpeech('profile', 'confidence', this.dataset.level);
        });
    });
    
    // 학습 목표 선택
    const goalCards = document.querySelectorAll('.goal-card');
    goalCards.forEach(card => {
        card.addEventListener('click', function() {
            goalCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // 캐릭터 반응
            updateCharacterSpeech('goals', 'goal', this.dataset.goal);
        });
    });
    
    // 메시지 입력 엔터키 처리
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // 설정 저장
    const settingsNickname = document.getElementById('settings-nickname');
    const settingsYear = document.getElementById('settings-year');
    
    if (settingsNickname) {
        settingsNickname.value = userProfile.nickname || '';
        settingsNickname.addEventListener('change', function() {
            userProfile.nickname = this.value;
            localStorage.setItem('dentCharley_profile', JSON.stringify(userProfile));
        });
    }
    
    if (settingsYear) {
        settingsYear.value = userProfile.year || '3rd';
        settingsYear.addEventListener('change', function() {
            userProfile.year = this.value;
            localStorage.setItem('dentCharley_profile', JSON.stringify(userProfile));
        });
    }
    
    // 첫 방문인지 확인
    if (!localStorage.getItem('dentCharley_profile')) {
        showScreen('welcome-screen');
    } else {
        showScreen('main-screen');
    }
});

// 시뮬레이션 시작 (케이스 준비 화면에서)
function startSimulation() {
    startCase('sensitivity-anxious');
}
