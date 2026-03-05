export const messages = {
  ko: {
    // App
    appName: 'InterectNote - 무한 캔버스 메모',
    appDescription: '애플 스타일의 무한 캔버스 메모 앱',
    
    // Errors
    storageQuotaExceeded: '저장 공간이 부족합니다. 일부 항목을 삭제하고 다시 시도해주세요.',
    storageQuotaExceededImage: '저장 공간이 부족합니다. 일부 이미지를 삭제하고 다시 시도해주세요.',
    storageQuotaExceededFile: '저장 공간이 부족합니다. 일부 파일을 삭제하고 다시 시도해주세요.',
    imageTooLarge: (fileName: string, size: string) => `이미지 "${fileName}"의 크기가 너무 큽니다 (${size}). 더 작은 이미지를 사용해주세요.`,
    fileTooLarge: (fileName: string, size: string) => `파일 "${fileName}"의 크기가 너무 큽니다 (${size}). 더 작은 파일을 사용해주세요.`,
    imageProcessingError: (fileName: string) => `이미지 처리 중 오류가 발생했습니다: ${fileName}`,
    
    // UI
    colorPicker: '색상 선택',
    currentColor: (color: string) => `현재 색상: ${color}`,
    changeColorTo: (color: string) => `색상 ${color}로 변경`,
    colorName: (color: string) => `색상: ${color}`,
    
    // Actions
    addFile: '파일 추가',
    deleteNote: '메모 삭제',
    delete: '삭제',
    clearAll: '모두 지우기',
    confirmClearAll: '모든 메모를 삭제하시겠습니까?',
    
    // Canvas
    freeTransform: '자유 변형',
    maintainRatio: '비율 유지',
    doubleClickToOpen: '더블클릭으로 열기',
    doubleClickToWrite: '더블 클릭하여 메모 작성',
    
    // Dark mode
    switchToLightMode: '라이트 모드로 전환',
    switchToDarkMode: '다크 모드로 전환',
    
    // Floating button
    addNewNote: '새 메모 추가',
    
    // Help
    gettingStarted: '시작하기',
    addNoteHelp: '더블 클릭 또는 + 버튼으로 메모 추가',
    navigateHelp: '드래그로 캔버스 이동, 휠로 확대/축소',
    moveNoteHelp: '메모 헤더 드래그로 위치 이동',
    editNoteHelp: '더블 클릭으로 내용 편집',
    
    // Storage
    storageUsage: (percent: number) => `저장공간 ${percent}%`,
    
    // Auth
    welcomeToInterectNote: 'InterectNote에 오신 것을 환영합니다',
    loginDescription: '로그인하여 모든 기기에서 메모를 동기화하세요',
    continueWithGoogle: 'Google로 계속하기',
    continueAsGuest: '게스트로 계속하기',
    syncNotice: '게스트 모드는 기본적으로 로컬 저장이지만, "기기 동기화"로 다른 기기와 연결할 수 있습니다',
    loginError: '로그인 중 오류가 발생했습니다',
    logout: '로그아웃',
    syncStatus: '동기화 상태',
    syncing: '동기화 중...',
    synced: '동기화됨',
    offline: '오프라인',
    syncError: '동기화 오류',
    guestUser: '게스트 사용자',
    guestMode: '게스트 모드',

    // Device sync (code)
    deviceSyncTitle: '기기 동기화',
    deviceSyncDescription: '한 기기에서 코드를 생성하고, 다른 기기에 입력하면 같은 캔버스로 실시간 동기화됩니다.',
    deviceSyncClose: '닫기',
    deviceSyncLoading: '로딩 중...',
    deviceSyncFirebaseNotConfigured: 'Firebase 설정이 없어 동기화 기능을 사용할 수 없습니다. (.env 설정 필요)',
    deviceSyncGuestOk: 'Google 로그인 없이도 게스트(익명)로 기기 동기화를 사용할 수 있습니다.',
    deviceSyncCreateTab: '코드 생성',
    deviceSyncJoinTab: '코드 입력',
    deviceSyncCreateHint: '6자리 코드가 생성됩니다. 다른 기기에서 입력하거나 복사/붙여넣기 하세요. (하이픈은 자동)',
    deviceSyncJoinHint: '6자리 코드를 입력하세요. 하이픈(-)은 자동으로 들어가며 없어도 됩니다.',
    deviceSyncCreateButton: '동기화 코드 생성',
    deviceSyncCreating: '생성 중...',
    deviceSyncYourCode: '연결 코드',
    deviceSyncCopy: '복사',
    deviceSyncCodeCopied: '코드를 복사했습니다',
    deviceSyncCodeCopyFailed: '복사에 실패했습니다',
    deviceSyncCodePlaceholder: '예: ABC-DEF',
    deviceSyncJoinButton: '연결하기',
    deviceSyncJoining: '연결 중...',
    deviceSyncLinked: '기기 연결 완료',
    deviceSyncEnterCode: '코드를 입력해주세요',
    deviceSyncCodeNotFound: '코드를 찾을 수 없습니다',
    deviceSyncCodeExpired: '만료된 코드입니다',
    deviceSyncCodeExpiresIn: (m: number, s: string) => `남은 시간 ${m}:${s}`,
    deviceSyncGuestSignInFailed: '게스트 로그인에 실패했습니다. 다시 시도해주세요.',
    deviceSyncOnlyOwnerCanCreate: '캔버스 소유자만 코드를 생성할 수 있습니다.',
    deviceSyncUnknownError: '알 수 없는 오류가 발생했습니다.',
  },
  en: {
    // App
    appName: 'InterectNote - Infinite Canvas Memo',
    appDescription: 'Apple-style infinite canvas memo app',
    
    // Errors
    storageQuotaExceeded: 'Storage space is full. Please delete some items and try again.',
    storageQuotaExceededImage: 'Storage space is full. Please delete some images and try again.',
    storageQuotaExceededFile: 'Storage space is full. Please delete some files and try again.',
    imageTooLarge: (fileName: string, size: string) => `Image "${fileName}" is too large (${size}). Please use a smaller image.`,
    fileTooLarge: (fileName: string, size: string) => `File "${fileName}" is too large (${size}). Please use a smaller file.`,
    imageProcessingError: (fileName: string) => `Error processing image: ${fileName}`,
    
    // UI
    colorPicker: 'Select Color',
    currentColor: (color: string) => `Current color: ${color}`,
    changeColorTo: (color: string) => `Change color to ${color}`,
    colorName: (color: string) => `Color: ${color}`,
    
    // Actions
    addFile: 'Add File',
    deleteNote: 'Delete Note',
    delete: 'Delete',
    clearAll: 'Clear All',
    confirmClearAll: 'Delete all notes?',
    
    // Canvas
    freeTransform: 'Free Transform',
    maintainRatio: 'Maintain Ratio',
    doubleClickToOpen: 'Double-click to open',
    doubleClickToWrite: 'Double-click to write a note',
    
    // Dark mode
    switchToLightMode: 'Switch to Light Mode',
    switchToDarkMode: 'Switch to Dark Mode',
    
    // Floating button
    addNewNote: 'Add New Note',
    
    // Help
    gettingStarted: 'Getting Started',
    addNoteHelp: 'Double-click or press + button to add a note',
    navigateHelp: 'Drag to move canvas, wheel to zoom',
    moveNoteHelp: 'Drag note header to move position',
    editNoteHelp: 'Double-click to edit content',
    
    // Storage
    storageUsage: (percent: number) => `Storage ${percent}%`,
    
    // Auth
    welcomeToInterectNote: 'Welcome to InterectNote',
    loginDescription: 'Sign in to sync your notes across all devices',
    continueWithGoogle: 'Continue with Google',
    continueAsGuest: 'Continue as Guest',
    syncNotice: 'Guest mode is local-only by default, but you can link devices via "Device Sync"',
    loginError: 'Error occurred during login',
    logout: 'Logout',
    syncStatus: 'Sync Status',
    syncing: 'Syncing...',
    synced: 'Synced',
    offline: 'Offline',
    syncError: 'Sync Error',
    guestUser: 'Guest User',
    guestMode: 'Guest Mode',

    // Device sync (code)
    deviceSyncTitle: 'Device Sync',
    deviceSyncDescription: 'Generate a code on one device, then enter it on another device to sync the same canvas in real time.',
    deviceSyncClose: 'Close',
    deviceSyncLoading: 'Loading...',
    deviceSyncFirebaseNotConfigured: 'Device sync is unavailable because Firebase is not configured. (Set .env)',
    deviceSyncGuestOk: 'You can use Device Sync as a guest (anonymous) without Google sign-in.',
    deviceSyncCreateTab: 'Create Code',
    deviceSyncJoinTab: 'Enter Code',
    deviceSyncCreateHint: 'Creates a 6-character code. Enter it on your other device or paste it. (Hyphen auto-formats)',
    deviceSyncJoinHint: 'Enter the 6-character code to link to the same canvas. (Hyphen is optional)',
    deviceSyncCreateButton: 'Create Sync Code',
    deviceSyncCreating: 'Creating...',
    deviceSyncYourCode: 'Link Code',
    deviceSyncCopy: 'Copy',
    deviceSyncCodeCopied: 'Code copied',
    deviceSyncCodeCopyFailed: 'Copy failed',
    deviceSyncCodePlaceholder: 'e.g., ABC-DEF',
    deviceSyncJoinButton: 'Link',
    deviceSyncJoining: 'Linking...',
    deviceSyncLinked: 'Devices linked',
    deviceSyncEnterCode: 'Please enter a code',
    deviceSyncCodeNotFound: 'Code not found',
    deviceSyncCodeExpired: 'Code expired',
    deviceSyncCodeExpiresIn: (m: number, s: string) => `Time left ${m}:${s}`,
    deviceSyncGuestSignInFailed: 'Guest sign-in failed. Please try again.',
    deviceSyncOnlyOwnerCanCreate: 'Only the canvas owner can create a code.',
    deviceSyncUnknownError: 'An unknown error occurred.',
  },
};

export type Language = keyof typeof messages;
export type MessageKey = keyof typeof messages.ko;
