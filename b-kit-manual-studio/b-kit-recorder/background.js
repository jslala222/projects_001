// 확장 프로그램 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isRecording: false, recordedActions: [] });
    console.log("B-Kit Recorder installed and initialized.");
});

// 메시지 리스너 (content -> background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CAPTURE_SCREENSHOT") {
        const actionData = request.data;
        
        // 현재 활성화된 탭의 화면 캡처
        chrome.tabs.captureVisibleTab(null, {format: 'png', quality: 50}, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("캡처 실패:", chrome.runtime.lastError);
                return;
            }
            
            actionData.screenshotUrl = dataUrl; // Base64 이미지 추가
            
            // 저장소에 액션 추가
            chrome.storage.local.get(['recordedActions'], (result) => {
                const actions = result.recordedActions || [];
                actions.push(actionData);
                
                chrome.storage.local.set({ recordedActions: actions }, () => {
                    // 저장 완료 후 팝업에 알림
                    chrome.runtime.sendMessage({ action: "ACTION_RECORDED" });
                });
            });
        });
        
        return true; // 비동기 응답을 위해 true 반환
    }
});
