# CLAUDE.md - InterectNote1 프로젝트 컨텍스트

## 📋 프로젝트 개요
- **프로젝트명**: InterectNote1
- **설명**: Apple Freeform 스타일의 무한 캔버스 메모 앱
- **라이브 URL**: https://interectnote1-72u8uqrm2-feras-projects-59a977f0.vercel.app
- **GitHub**: https://github.com/parkjaeuk0210/interectnote1

## 🛠 기술 스택
- React 19 + TypeScript 5
- Konva.js (캔버스 렌더링)
- Zustand (상태 관리)
- Firebase (인증, 실시간 DB, 스토리지)
- Tailwind CSS
- Vite (빌드 도구)
- Vercel (배포)

## 📂 주요 디렉토리 구조
```
src/
├── components/       # UI 컴포넌트
│   ├── Canvas/      # 캔버스 관련
│   ├── Note/        # 노트 컴포넌트
│   ├── Auth/        # 인증
│   ├── Sharing/     # 공유 기능
│   └── UI/          # 공통 UI
├── contexts/        # Context Providers
├── hooks/           # 커스텀 훅
├── store/           # Zustand 스토어
│   ├── canvasStore.ts          # 로컬 저장소
│   ├── firebaseCanvasStore.ts  # Firebase 동기화
│   └── sharedCanvasStore.ts    # 공유 캔버스
└── lib/             # 라이브러리
    ├── firebase.ts  # Firebase 설정
    └── database.ts  # DB 작업
```

## 🔄 최근 작업 내역 (2025-12-02)

### IndexedDB 캐싱 시스템 도입
1. **목적**: Firebase 무료 플랜(월 10GB)으로 100명 사용자 지원
2. **구현 내용**:
   - `src/lib/indexedDBManager.ts`: IndexedDB 캐싱 매니저
   - `src/hooks/useCachedImage.ts`: 이미지 blob 캐싱 훅
   - `src/components/UI/CacheStatus.tsx`: 캐시 상태 표시 컴포넌트
3. **주요 기능**:
   - 노트/이미지/파일 데이터 IndexedDB 캐싱
   - 이미지 Blob 오프라인 캐싱
   - localStorage 폴백 지원
   - 캐시 자동 정리 (30일 이상)
4. **효과**:
   - Firebase 대역폭 70% 절감 예상
   - 오프라인 시에도 캐시된 데이터 표시
   - 용량 제한 해소 (5MB → 수백MB)

### Firebase 로딩 속도 최적화 (이전)
1. **문제**: Firebase에서 데이터 로딩 시 3초 대기
2. **원인**: remoteReady 플래그가 true가 될 때까지 전체 화면 로딩
3. **해결**:
   - App.tsx: remoteReady 게이팅 로직 제거
   - firebaseCanvasStore.ts: IndexedDB → localStorage 순서로 캐시 우선 로딩
   - SyncStatus.tsx: 동기화 진행률 표시 추가 (0/4 → 4/4)
4. **결과**: 앱이 즉시 로드되고 Firebase는 백그라운드 동기화

## 🚀 개발 명령어
```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# TypeScript 체크
npm run lint

# 테스트
npm run test
```

## 🔑 환경 변수 (필요 시)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_STORAGE_BUCKET=
```

## 📝 TODO / 다음 작업
- [x] IndexedDB 도입으로 대용량 데이터 캐싱 개선 (완료 2025-12-02)
- [ ] Service Worker로 오프라인 우선 전략 강화
- [ ] 이미지 lazy loading 최적화 (useCachedImage 훅 활용)
- [ ] 번들 사이즈 최적화 (현재 1MB 초과)
- [ ] Presence 업데이트 빈도 최적화 (협업 시 Firebase 쓰기 절감)
- [ ] 협업 캔버스 참가자 수 제한 (5명 권장)

## 💡 주요 이슈 및 해결 방법

### 1. Firebase 동기화 속도
- **문제**: 초기 로딩 시 모든 데이터 대기
- **해결**: Progressive loading 전략 적용

### 2. TypeScript 빌드 오류
- **문제**: 미사용 변수/import 경고
- **해결**: strict 모드 유지하며 정리

### 3. 모바일 최적화
- **특징**: 터치 제스처, 핀치 줌, PWA 지원
- **hooks**: useCanvasGestures, useMobileOptimizations

## 🔍 디버깅 팁
1. Firebase 동기화 상태: SyncStatus 컴포넌트 확인
2. IndexedDB 캐시: 브라우저 DevTools → Application → IndexedDB → `interectnote-cache`
3. localStorage 폴백: `remoteCache:userId` 키 (최근 50개 노트만)
4. 캐시 상태 확인: CacheStatus 컴포넌트 (개발 환경에서 자동 표시)
5. 개발 서버: http://localhost:3000

## 📌 프로젝트 특징
- 무한 캔버스
- 실시간 동기화
- 다크 모드
- 다국어 지원 (한국어/영어)
- 공유 캔버스
- PWA 지원

## 🗄️ IndexedDB 캐싱 아키텍처

### 데이터베이스 구조 (`interectnote-cache`)
```
stores:
├── notes        # 노트 데이터 (userId 인덱스)
├── images       # 이미지 메타데이터
├── files        # 파일 메타데이터
├── settings     # 사용자 설정
├── imageBlobs   # 이미지 바이너리 (오프라인용)
└── metadata     # 캐시 메타데이터
```

### 캐싱 전략
1. **로드 순서**: IndexedDB → localStorage 폴백 → Firebase
2. **저장**: Firebase 데이터 수신 시 IndexedDB와 localStorage 동시 저장
3. **이미지 Blob**: Firebase Storage URL → IndexedDB Blob 변환 (오프라인 지원)

### Firebase 대역폭 절감 효과
| 시나리오 | 기존 | IndexedDB 적용 후 |
|---------|------|------------------|
| 앱 재방문 | 전체 다운로드 | 캐시 우선, 변경분만 |
| 오프라인 | 표시 불가 | 캐시된 데이터 표시 |
| 이미지 로딩 | 매번 다운로드 | Blob 캐시 재사용 |

---
*이 파일은 Claude가 새 세션에서도 프로젝트 컨텍스트를 유지하기 위해 자동 생성되었습니다.*
*최종 업데이트: 2025-12-02*