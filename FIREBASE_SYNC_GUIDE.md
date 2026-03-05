# Firebase 동기화 구현 가이드

## 📅 구현 날짜: 2025-01-19

## 🔥 Firebase 설정

### 1. Firebase Console 설정
- **프로젝트명**: freecanvas-9eac7
- **인증**: Google Sign-In 활성화
- **Realtime Database**: asia-southeast1 (싱가포르)
- **보안 규칙**:
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 2. 환경 변수 (.env)
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Vercel 배포 설정
- 환경 변수를 Vercel Dashboard에 추가 (Production, Preview, Development 모두 체크)
- Authorized domains에 메인 도메인 추가: `your-app.vercel.app`

## 🏗️ 주요 구조 변경

### 1. 스토어 아키텍처
```
이전: 컴포넌트 → useCanvasStore → localStorage
이후: 컴포넌트 → useAppStore → StoreProvider → useCanvasStore 또는 useFirebaseCanvasStore
```

### 2. 새로운 파일들
- `/src/lib/firebase.ts` - Firebase 초기화
- `/src/lib/database.ts` - Realtime Database 함수들
- `/src/store/firebaseCanvasStore.ts` - Firebase 동기화 스토어
- `/src/contexts/AuthContext.tsx` - 인증 상태 관리
- `/src/contexts/StoreProvider.tsx` - 스토어 선택 로직
- `/src/contexts/SyncContext.tsx` - 동기화 상태 관리
- `/src/types/firebase.ts` - Firebase 데이터 타입

### 3. 수정된 파일들
- `/src/App.tsx` - AuthProvider, SyncProvider, StoreProvider 추가
- `/src/main.tsx` - Provider 계층 구조 설정
- 모든 컴포넌트 - `useCanvasStore` → `useAppStore` 변경

## 🔄 동작 방식

### 1. 인증 플로우
```
사용자 접속 → 로그인 모달 표시 → Google 로그인 또는 Skip
└─ Google 로그인: Firebase 동기화 활성화
└─ Skip (익명): 로컬 저장소만 사용
```

### 2. 스토어 선택 로직
```typescript
// StoreProvider.tsx
const isFirebaseMode = !loading && !!user && !user.isAnonymous;
// Firebase 모드: 로그인했고, 익명이 아닌 경우
```

### 3. 데이터 동기화
- 실시간 양방향 동기화
- 노트, 이미지, 파일, 설정 모두 동기화
- 각 기기는 고유 deviceId 보유

## ⚠️ 주의사항

### 1. 환경 변수
- Vercel에 배포 시 반드시 환경 변수 설정
- 공백이나 특수문자 주의 (특히 DATABASE_URL)

### 2. 도메인 설정
- Firebase Authorized domains에 배포 도메인 추가 필수
- Preview URL이 아닌 메인 도메인 사용

### 3. 타입 안전성
- Firebase는 Date를 timestamp(number)로 저장
- 로컬과 Firebase 간 타입 변환 필요

### 4. 컴포넌트 수정
- 반드시 `useAppStore` 사용 (직접 `useCanvasStore` 사용 금지)
- Selector 패턴 사용: `useAppStore((state) => state.property)`

## 🐛 문제 해결

### 로그인 오류
1. Firebase Console에서 Google Sign-In 활성화 확인
2. Authorized domains 확인
3. 환경 변수 정확성 확인

### 동기화 안 됨
1. Realtime Database 규칙 확인
2. 네트워크 연결 확인
3. 브라우저 콘솔에서 에러 확인

### 노트가 안 보임
1. 뷰포트 위치 확인 (화면 밖에 생성되었을 수 있음)
2. Firebase에 실제로 저장되었는지 Console에서 확인

## 📋 향후 과제
- [ ] 오프라인 지원 개선
- [ ] 충돌 해결 로직
- [ ] Firebase Storage로 이미지/파일 마이그레이션
- [ ] 기존 로컬 데이터 → Firebase 마이그레이션 기능

---

## 🔑 기기 동기화 코드 (2026-03-05 추가)

Google 로그인이 불편한 사용자를 위해 **게스트(Anonymous) 로그인 + 코드 입력** 방식으로 같은 캔버스를 연결할 수 있습니다.

### 필요 조건
- Firebase Authentication에서 **Anonymous** 제공자 활성화
- Realtime Database 규칙에 `device_sync_codes` 추가

예시 규칙:
```json
{
  "rules": {
    "device_sync_codes": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('createdBy').val() === auth.uid)"
      }
    }
  }
}
```
