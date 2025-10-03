import { useAppStore } from '../../contexts/StoreProvider';

export const FloatingButton = () => {
  const addNote = useAppStore((state) => state.addNote);
  const viewport = useAppStore((state) => state.viewport);

  const handleAddNote = () => {
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.scale;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.scale;
    addNote(centerX - 130, centerY - 90);
  };

  return (
    <button
      onClick={handleAddNote}
      className="fixed right-6 bottom-24 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
      style={{ 
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(79, 70, 229, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
      aria-label="새 메모 추가"
    >
      {/* Ripple effect background */}
      <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
      
      {/* Icon */}
      <svg className="w-7 h-7 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};
