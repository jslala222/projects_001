:: 파일 위치: 바탕화면
:: 파일명: 로컬서버_관리기.bat

@echo off
chcp 65001 >nul
title 로컬 서버 통합 컨트롤러

echo ==========================================
echo        로컬 서버 통합 컨트롤러
echo ==========================================
echo.

set /p PORT="1. 정리할 포트 번호를 입력하세요 (그냥 엔터 치면 기본값 3000): "
if "%PORT%"=="" set PORT=3000

echo.
set /p PROJECT_PATH="2. 테스트할 프로젝트 폴더를 마우스로 드래그해서 이 창에 올려놓고 엔터를 치세요: "
set PROJECT_PATH=%PROJECT_PATH:"=%

echo.
echo [%PORT%번 포트 찌꺼기 프로세스 정리 중...]
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo - 포트 정리 완료

echo.
echo [프레임워크 내부 캐시 폴더 지우는 중...]
if exist "%PROJECT_PATH%\.next" rd /s /q "%PROJECT_PATH%\.next"
if exist "%PROJECT_PATH%\node_modules\.vite" rd /s /q "%PROJECT_PATH%\node_modules\.vite"
if exist "%PROJECT_PATH%\node_modules\.cache" rd /s /q "%PROJECT_PATH%\node_modules\.cache"
echo - 캐시 삭제 완료

echo.
echo [깨끗한 상태로 서버 실행 중...]
cd /d "%PROJECT_PATH%"
start cmd /k "npm run dev"

echo.
echo 모든 작업이 완료되었습니다. 새로 뜬 창에서 서버가 켜지는지 확인하세요.
pause