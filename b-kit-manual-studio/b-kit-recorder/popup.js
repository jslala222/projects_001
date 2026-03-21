let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusText = document.getElementById('status-text');
    const indicator = document.getElementById('status-indicator');
    const actionsList = document.getElementById('actions-list');
    const finishBtn = document.getElementById('finish-btn');

    // UI 업데이트 함수
    function updateUI(recording) {
        if (recording) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            statusText.textContent = '녹화 중 (행동 수집 중...)';
            indicator.className = 'indicator recording';
            finishBtn.style.display = 'none';
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            statusText.textContent = '녹화 대기 중';
            indicator.className = 'indicator inactive';
        }
    }

    // 초기 상태 불러오기
    chrome.storage.local.get(['isRecording', 'recordedActions'], (result) => {
        isRecording = result.isRecording || false;
        updateUI(isRecording);
        renderActions(result.recordedActions || []);
    });

    startBtn.addEventListener('click', async () => {
        isRecording = true;
        chrome.storage.local.set({ isRecording: true });
        updateUI(true);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Content Script에 녹화 시작 메시지 전송
        chrome.tabs.sendMessage(tab.id, { action: "START_RECORDING" });
    });

    stopBtn.addEventListener('click', async () => {
        isRecording = false;
        chrome.storage.local.set({ isRecording: false });
        updateUI(false);
        finishBtn.style.display = 'block';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Content Script에 녹화 중지 메시지 전송
        chrome.tabs.sendMessage(tab.id, { action: "STOP_RECORDING" });
    });

    // 스튜디오로 전송 (추후 API 연동)
    finishBtn.addEventListener('click', () => {
        chrome.storage.local.get(['recordedActions'], (result) => {
            const data = result.recordedActions || [];
            
            // 데이터를 JSON 파일로 다운로드 (임시 구현)
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: "manual_actions.json"
            });
            
            // 데이터 초기화
            chrome.storage.local.set({ recordedActions: [] });
            renderActions([]);
            finishBtn.style.display = 'none';
            alert('데이터가 추출되었습니다! 스튜디오에서 불러와주세요.');
        });
    });

    // 액션 목록 렌더링
    function renderActions(actions) {
        actionsList.innerHTML = '';
        actions.forEach((act, index) => {
            const div = document.createElement('div');
            div.className = 'action-item';
            div.textContent = `${index + 1}. [${act.type}] ${act.targetText || act.tagName}`;
            actionsList.appendChild(div);
        });
    }

    // 배경 스크립트로부터 액션 수신
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "ACTION_RECORDED") {
            chrome.storage.local.get(['recordedActions'], (result) => {
                const actions = result.recordedActions || [];
                renderActions(actions);
            });
        }
    });
});
