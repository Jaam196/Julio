import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, Hash, CheckCircle, Smartphone } from 'lucide-react';

interface ManualInputProps {
  onAddTicket: (num: string) => void;
  onAddDirectTicket?: (num: string) => void;
  disabled?: boolean;
}

export default function ManualInput({ onAddTicket, onAddDirectTicket, disabled = false }: ManualInputProps) {
  const [value, setValue] = useState('');
  const [targetDestination, setTargetDestination] = useState<'active' | 'waiting'>('active');
  const [justAdded, setJustAdded] = useState<{ number: string; destination: 'active' | 'waiting' } | null>(null);
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

  const submitValue = (val: string, destination: 'active' | 'waiting' = targetDestination) => {
    if (!val.trim()) return;
    if (destination === 'waiting' && onAddDirectTicket) {
      onAddDirectTicket(val.trim());
    } else {
      onAddTicket(val.trim());
    }
    setJustAdded({ number: val.trim(), destination });
    setValue('');
    setTimeout(() => {
      setJustAdded(null);
    }, 700);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // numbers only
    
    if (val.length > 3) {
      val = val.slice(0, 3);
    }

    setValue(val);

    if (val.length === 3) {
      // Add instantly according to targetDestination!
      submitValue(val, targetDestination);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setValue('');
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      if (value.trim()) {
        submitValue(value, targetDestination);
      }
      e.preventDefault();
      return;
    }

    const isDigit = /^[0-9]$/.test(e.key);
    
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    const isAllowedEditingKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
    ].includes(e.key);

    if (isDigit || isAllowedEditingKey) {
      return;
    }

    e.preventDefault();
  };

  // Quick helper to fill the ATM-style visual slots
  const visualSlots = ['', '', ''];
  for (let i = 0; i < 3; i++) {
    if (i < value.length) {
      visualSlots[i] = value[i];
    } else {
      visualSlots[i] = '_';
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-md p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/60">
      {/* Background glow effects to represent premium KDS screen */}
      <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl"></div>
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl"></div>
      
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20 shadow-inner">
            <Hash size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-100 text-lg leading-tight">Caja de Entrada Rápida</h3>
            <p className="text-xs text-slate-400 font-medium">Detector instantáneo al teclear 3 dígitos</p>
          </div>
        </div>

        {/* Target Destination Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setTargetDestination('active')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              targetDestination === 'active'
                ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>A Listos (Llamar)</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetDestination('waiting')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              targetDestination === 'waiting'
                ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>A Espera</span>
          </button>
        </div>
      </div>

      {/* Main interactive slot input area */}
      <div className="relative">
        <input
          id="fast-ticket-input"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder=""
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-default"
          autoFocus
        />

        {/* Overlay showing "Just Added" status */}
        {justAdded ? (
          <div className={`w-full flex items-center justify-center border-2 rounded-2xl py-6 animate-[scaleUp_0.15s_ease-out] shadow-lg ${
            justAdded.destination === 'waiting'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}>
            <div className="flex items-center gap-3">
              <CheckCircle className="animate-[bounce_0.6s_infinite]" size={32} />
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-3xl tracking-tight">#{justAdded.number}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  {justAdded.destination === 'waiting' ? 'Añadido a Lista de Espera' : 'Añadido a Listos (Llamando)'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* High-fidelity ATMs / POS slots */
          <div 
            onClick={() => inputRef.current?.focus()}
            className="w-full grid grid-cols-3 gap-3.5 py-3 cursor-text select-none"
          >
            {visualSlots.map((char, index) => {
              const isActive = index === value.length;
              return (
                <div
                  key={index}
                  className={`relative flex items-center justify-center rounded-2xl py-4 h-24 border transition-all duration-200 ${
                    char !== '_'
                      ? 'bg-slate-950 border-violet-500/40 text-slate-100 shadow-lg shadow-violet-500/5'
                      : isActive
                      ? 'bg-slate-950/80 border-violet-500 text-violet-400 ring-2 ring-violet-500/20 scale-102'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-700'
                  }`}
                >
                  <span className="font-mono font-black text-4xl tracking-tighter">
                    {char}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-3 w-5 h-1 bg-violet-400 rounded-full animate-pulse"></span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Keyboard size={13} className="text-slate-400 shrink-0" />
          <span>Escribe 3 números y se publicará en pantallas de inmediato</span>
        </div>
        {value.length > 0 && !justAdded && (
          <span className="bg-violet-950/40 border border-violet-500/20 text-violet-300 font-mono font-bold px-2.5 py-0.5 rounded-full">
            {value.length} / 3 dígitos
          </span>
        )}
      </div>
    </div>
  );
}

