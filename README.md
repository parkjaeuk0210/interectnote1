# InterectNote - 무한 캔버스 메모 앱

애플의 Freeform에서 영감을 받은 모바일 친화적인 무한 캔버스 메모 애플리케이션입니다.

## 🌐 Live Demo
https://interectnote1.vercel.app

## 🚀 주요 기능

- 📝 **무한 캔버스**: 제한 없는 작업 공간
- 🎨 **글래스모피즘 디자인**: 애플 스타일의 세련된 UI
- 📱 **모바일 최적화**: 터치 제스처 완벽 지원
- 💾 **자동 저장**: 로컬 스토리지에 자동 저장
- 🎯 **직관적인 인터페이스**: 더블 클릭으로 메모 추가
- 🔄 **실시간 동기화**: Google 로그인으로 여러 기기 간 동기화
- 🌐 **다국어 지원**: 한국어/영어 지원
- 🌙 **다크 모드**: 라이트/다크 테마 전환
- 🖼️ **미디어 지원**: 이미지 및 파일 드래그 앤 드롭

## 🛠 기술 스택

- React 19 + TypeScript
- Konva.js (캔버스 렌더링)
- Zustand (상태 관리)
- Tailwind CSS (스타일링)
- Vite (빌드 도구)
- Firebase (인증 & 실시간 데이터베이스)
- Vercel (배포)

## 📱 사용 방법

### 메모 추가
- 캔버스 더블 클릭
- 우측 하단 + 버튼 클릭

### 캔버스 탐색
- **드래그**: 캔버스 이동
- **마우스 휠**: 확대/축소
- **핀치**: 모바일에서 확대/축소

### 메모 편집
- 메모 더블 클릭하여 편집
- 드래그로 위치 이동
- 하단 툴바에서 색상 변경

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (Firebase 사용 시)
cp .env.example .env
# .env 파일에 Firebase 설정 추가

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 🔥 Firebase 설정 (선택사항)

동기화 기능을 사용하려면:
1. Firebase 프로젝트 생성
2. Google Authentication 활성화
3. Realtime Database 생성
4. `.env` 파일에 Firebase 설정 추가

자세한 내용은 [FIREBASE_SYNC_GUIDE.md](./FIREBASE_SYNC_GUIDE.md) 참조

## 📱 PWA 지원

이 앱은 PWA로 설치 가능합니다. 모바일 브라우저에서 "홈 화면에 추가"를 통해 네이티브 앱처럼 사용할 수 있습니다. 
<!-- Trigger rebuild -->

## 🍎 iPhone에 앱으로 설치 (Capacitor)

PWA 대신 iOS 앱(WKWebView)으로 감싸서 내 폰에 설치해볼 수 있습니다.

### 준비물
- macOS + Xcode 설치
- (필요 시) CocoaPods 설치: `sudo gem install cocoapods`

### 설치/실행 (처음 1회)
```bash
npm install
npm run ios:add
npm run ios:open
```

Xcode에서:
1) 좌측 상단 실행 타겟을 내 iPhone으로 선택
2) Signing & Capabilities에서 Team 선택(Apple ID)
3) Run(▶) 하면 폰에 설치됩니다
 
