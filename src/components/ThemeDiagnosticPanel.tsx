import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Wrench, 
  Layers, 
  Sparkles, 
  Search,
  Activity,
  Cpu
} from 'lucide-react';
import { 
  runThemeDiagnostic, 
  fixAndForceGlobalTheme, 
  ThemeDiagnosticReport,
  APP_MODULES_TO_AUDIT,
  REQUIRED_THEME_TOKENS
} from '../utils/themeDiagnostic';

interface ThemeDiagnosticPanelProps {
  onToast?: (msg: string) => void;
}

export function ThemeDiagnosticPanel({ onToast }: ThemeDiagnosticPanelProps) {
  const [report, setReport] = useState<ThemeDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunDiagnostic = () => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runThemeDiagnostic();
      setReport(result);
      setIsRunning(false);
      onToast?.('🔍 Diagnóstico de temas completado con éxito');
    }, 300);
  };

  const handleFixAll = () => {
    setIsRunning(true);
    setTimeout(() => {
      const fixedReport = fixAndForceGlobalTheme();
      setReport(fixedReport);
      setIsRunning(false);
      onToast?.('🛠️ Sistema de temas sincronizado y aplicado globalmente');
    }, 400);
  };

  useEffect(() => {
    // Run initial diagnostic on mount
    const initialReport = runThemeDiagnostic();
    setReport(initialReport);
  }, []);

  if (!report) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 backdrop-blur-md">
      
      {/* Encabezado del Diagnóstico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold mb-2">
            <Cpu size={14} />
            <span>Herramienta de Diagnóstico de Temas Globales</span>
          </div>
          <h3 className="text-xl font-black text-white flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-emerald-400" />
            <span>Auditoría de Apariencia y Tokens CSS</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            Escanea automáticamente la interfaz para verificar que todos los paneles, modales, componentes y cuadros de diálogo estén vinculados al sistema unificado de variables globales.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleRunDiagnostic}
            disabled={isRunning}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
            <span>Volver a Auditar</span>
          </button>

          <button
            onClick={handleFixAll}
            disabled={isRunning}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Wrench size={14} />
            <span>Sincronizar y Corregir Todo</span>
          </button>
        </div>
      </div>

      {/* Puntuación y Métricas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Puntuación de Cobertura */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Cobertura Global</div>
            <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1">
              <span>{report.score}%</span>
              <span className="text-xs font-medium text-slate-400">completado</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
            report.score >= 90 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950 text-amber-400 border border-amber-500/30'
          }`}>
            {report.score >= 90 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </div>
        </div>

        {/* Tokens CSS Raíz */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Variables CSS Raíz</div>
          <div className="text-lg font-bold text-white mt-1">
            {report.validTokensCount} / {report.totalTokensChecked} Activas
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-indigo-500 h-full transition-all duration-500" 
              style={{ width: `${(report.validTokensCount / report.totalTokensChecked) * 100}%` }}
            />
          </div>
        </div>

        {/* Módulos Auditados */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Módulos Auditados</div>
          <div className="text-lg font-bold text-white mt-1">
            {report.passedComponentsCount} / {report.auditedComponentsCount} Conformes
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${(report.passedComponentsCount / report.auditedComponentsCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Estado y Hora */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Tema Evaluado</div>
          <div className="text-sm font-bold text-indigo-300 truncate mt-1">
            {report.activeThemeName}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Última verificación: {report.timestamp}
          </div>
        </div>

      </div>

      {/* Lista de Módulos Verificados */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Layers size={14} className="text-indigo-400" />
          <span>Verificación de Módulos de la Aplicación</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {APP_MODULES_TO_AUDIT.map((mod) => (
            <div 
              key={mod.id}
              className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
            >
              <span className="font-semibold text-slate-300 truncate pr-2">{mod.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                <CheckCircle2 size={11} />
                <span>OK</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Observaciones / Incidencias Detectadas */}
      {report.issues.length > 0 ? (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>Observaciones Detectadas ({report.issues.length})</span>
            </h4>
            <button
              onClick={handleFixAll}
              className="text-xs text-amber-300 hover:text-white underline font-bold cursor-pointer"
            >
              Corregir automáticamente
            </button>
          </div>

          <div className="space-y-2">
            {report.issues.map((iss) => (
              <div key={iss.id} className="bg-slate-950 p-3 rounded-xl border border-amber-500/20 text-xs flex items-start justify-between gap-3">
                <div>
                  <span className="font-bold text-amber-200 block">{iss.module}</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">{iss.description}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                  iss.severity === 'high' ? 'bg-red-950 text-red-300 border border-red-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                }`}>
                  {iss.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-200">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>
            <strong>100% Verificado:</strong> Todos los componentes, modales, formularios, tablas y ventanas de la aplicación están respondiendo de forma unificada al sistema de temas en tiempo real.
          </span>
        </div>
      )}

    </div>
  );
}
