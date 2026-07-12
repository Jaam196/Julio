import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, Hash, Sparkles } from 'lucide-react';

interface ManualInputProps {
  onAddTicket: (num: string) => void;
  disabled?: boolean;
}

export default function ManualInput({ onAddTicket, disabled = false }: ManualInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus active
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Periodic focus lock for fast keyboard entry
  useEffect(() => {
    if (disabled) return;
    
    const handleGlobalClick = (e: MouseEvent) => {
      // If user clicked another interactive element like buttons, settings inputs, select fields, etc.
      // don't steal focus. Otherwise, bring focus back to the ticket input.
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'SELECT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('a') ||
        target.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // numbers only
    
    // Limit to 3 digits (or we can let it be larger if needed, but spec says "En el momento en que se introduce el tercer dígito el ticket se añade automáticamente")
    if (val.length > 3) {
      val = val.slice(0, 3);
    }

    setValue(val);

    if (val.length === 3) {
      // Add instantly!
      onAddTicket(val);
      setValue('');
      // Force refocus just in case
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Esc → Limpiar la Entrada Rápida
    if (e.key === 'Escape') {
      setValue('');
      e.preventDefault();
      return;
    }

    const isDigit = /^[0-9]$/.test(e.key);
    
    // Allow modifier keys (Ctrl+A, etc.)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // List of keys allowed to perform their native editing behaviors inside the input
    const isAllowedEditingKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
    ].includes(e.key);

    if (isDigit || isAllowedEditingKey) {
      // Allow these native input keys
      return;
    }

    // For any other key (like Enter, Space, ArrowUp, ArrowDown, Tab, letters),
    // we prevent default so they do NOT affect the text value of the input or lose focus.
    // However, they will still bubble up so the global shortcut handlers in App.tsx can capture and execute them!
    e.preventDefault();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
      {/* Background glow decorator */}
      <div className="absolute -right-20 -top-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/15 transition-all duration-500"></div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Hash size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg">Entrada Rápida</h3>
            <p className="text-xs text-slate-400">Sin Enter. Al 3er dígito se añade solo.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 border border-slate-700/50 rounded-full text-[10px] text-slate-400 font-mono">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
          Cursor Activo
        </div>
      </div>

      <div className="relative">
        <input
          id="fast-ticket-input"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Escribe 3 números..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full text-center bg-slate-950 text-slate-100 text-5xl font-mono tracking-widest font-bold py-6 px-4 rounded-xl border-2 border-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all placeholder:text-slate-700 placeholder:text-2xl"
          autoFocus
        />
        
        {value.length > 0 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 text-xs text-emerald-400 font-mono">
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  i < value.length ? 'bg-emerald-400 scale-110 shadow-sm' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Keyboard size={14} className="text-slate-400" />
          <span>Escribe p.ej. <span className="font-mono text-slate-300">183</span> para añadir instantáneo</span>
        </div>
        {value.length > 0 && (
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
            {value.length}/3 dígitos
          </span>
        )}
      </div>
    </div>
  );
}
