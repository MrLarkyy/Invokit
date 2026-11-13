import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Eyes } from './Eyes';

type ToastMood = 'watch' | 'happy';

interface ToastItem {
  id: number;
  text: string;
  mood: ToastMood;
}

type PushToast = (text: string, mood?: ToastMood) => void;

const ToastContext = createContext<PushToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback<PushToast>((text, mood = 'watch') => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-2), { id, text, mood }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <Eyes size={18} mood={toast.mood} />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  return useContext(ToastContext);
}
