let recording = false;

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_RECORDING") {
        recording = true;
        console.log("B-Kit Recorder: 녹화가 시작되었습니다.");
    } else if (request.action === "STOP_RECORDING") {
        recording = false;
        console.log("B-Kit Recorder: 녹화가 중지되었습니다.");
    }
});

// 클릭 이벤트 감지
document.addEventListener('click', async (e) => {
    if (!recording) return;

    const target = e.target;
    
    // 무시할 요소 (확장 프로그램 자체 등)
    if (target.id === 'b-kit-recorder-overlay') return;

    // 잠시 이벤트 버블링 지연 (캡처를 위해)
    const tagName = target.tagName.toLowerCase();
    const targetText = target.innerText ? target.innerText.substring(0, 30).trim() : '';
    const id = target.id;
    const className = target.className;
    
    // 단순한 텍스트 노드 등인지 확인하여 의미있는 엘리먼트만 캡처
    let actionType = 'click';
    if (tagName === 'input' || tagName === 'textarea') {
        actionType = 'input_focus'; // 입력은 별도 처리
    }

    const actionData = {
        type: actionType,
        tagName,
        targetText,
        id,
        className,
        timestamp: Date.now(),
        url: window.location.href
    };

    // 스크린샷 요청 (background에 요청)
    chrome.runtime.sendMessage({ 
        action: "CAPTURE_SCREENSHOT", 
        data: actionData 
    });
}, true); // 캡처 단계에서 감지

// 텍스트 입력 감지 (change 또는 blur 이벤트 활용)
document.addEventListener('change', (e) => {
    if (!recording) return;
    const target = e.target;
    
    if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') {
        const actionData = {
            type: 'input_text',
            tagName: target.tagName.toLowerCase(),
            targetText: target.value,
            id: target.id,
            timestamp: Date.now(),
            url: window.location.href
        };
        
        chrome.runtime.sendMessage({ 
            action: "CAPTURE_SCREENSHOT", 
            data: actionData 
        });
    }
}, true);
