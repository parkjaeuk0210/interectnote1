import { useState, useEffect } from 'react';

export const HelpTooltip = () => {
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    // Check if user has seen the help before
    const hasSeenHelp = localStorage.getItem('interectnote-help-seen');
    if (hasSeenHelp) {
      setShowHelp(false);
    }
  }, []);

  const handleClose = () => {
    setShowHelp(false);
    localStorage.setItem('interectnote-help-seen', 'true');
  };

  if (!showHelp) return null;

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 max-w-sm z-[9999] animate-in fade-in slide-in-from-top-2 duration-500" style={{ pointerEvents: 'auto' }}>
      <div className="enterprise-note enterprise-note-blue rounded-2xl p-6 shadow-xl relative" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 note-action-button z-10 cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 glass-button rounded-xl flex items-center justify-center">
            <span className="text-lg">✨</span>
          </div>
          <h3 className="font-semibold text-gray-800 text-lg">시작하기</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">1</span>
            </div>
            <p className="text-sm text-gray-700">더블 클릭 또는 + 버튼으로 새 메모 추가</p>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">2</span>
            </div>
            <p className="text-sm text-gray-700">빈 공간 드래그로 캔버스 이동, 휠로 확대/축소</p>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">3</span>
            </div>
            <p className="text-sm text-gray-700">오브젝트는 드래그로 이동 (우측 손/커서 버튼으로 이동 방식 전환)</p>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">4</span>
            </div>
            <p className="text-sm text-gray-700">더블 클릭으로 내용 편집</p>
          </div>
        </div>
      </div>
    </div>
  );
};
