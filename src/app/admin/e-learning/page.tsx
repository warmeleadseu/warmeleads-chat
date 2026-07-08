'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  Bars3BottomLeftIcon,
  XMarkIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  TrophyIcon,
  StarIcon,
  HandRaisedIcon,
  CubeIcon,
  ComputerDesktopIcon,
  MegaphoneIcon,
  UserGroupIcon,
  ScaleIcon,
  HeartIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { useAdmin } from '../adminContext';
import { adminFetch } from '@/lib/adminAuth';
import { MODULES, type Module, type Lesson, type QuizQuestion, type ContentSection } from '@/lib/elearning-content';

const MODULE_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  HandRaisedIcon,
  CubeIcon,
  ComputerDesktopIcon,
  MegaphoneIcon,
  UserGroupIcon,
  ScaleIcon,
  HeartIcon,
  RocketLaunchIcon,
};

interface ProgressRecord {
  module_id: string;
  lesson_id: string;
  completed: boolean;
  quiz_score: number | null;
  quiz_answers: Record<string, number>;
  completed_at: string | null;
}

type View = 'hub' | 'lesson' | 'quiz' | 'quiz-result' | 'completed';

// ─── Section Renderer ───
function SectionBlock({ section }: { section: ContentSection }) {
  const iconMap = {
    tip: <LightBulbIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />,
    warning: <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />,
    scenario: <ChatBubbleLeftRightIcon className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />,
    keypoints: <ListBulletIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
    text: null,
  };

  const bgMap: Record<string, string> = {
    tip: 'bg-amber-50 border-amber-200',
    warning: 'bg-red-50 border-red-200',
    scenario: 'bg-purple-50 border-purple-200',
    keypoints: 'bg-emerald-50 border-emerald-200',
    text: '',
  };

  if (section.type === 'text') {
    return (
      <div className="mb-6">
        {section.title && <h3 className="text-base font-semibold text-slate-900 mb-2">{section.title}</h3>}
        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{
          __html: section.body
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-800 font-semibold">$1</strong>')
            .replace(/\n/g, '<br/>')
        }} />
      </div>
    );
  }

  return (
    <div className={`mb-6 rounded-xl border p-4 ${bgMap[section.type]}`}>
      <div className="flex items-start gap-3">
        {iconMap[section.type]}
        <div className="min-w-0 flex-1">
          {section.title && (
            <h4 className="text-sm font-semibold text-slate-800 mb-1.5">{section.title}</h4>
          )}
          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{
            __html: section.body
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-800 font-semibold">$1</strong>')
              .replace(/\n/g, '<br/>')
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Component ───
function QuizView({
  questions,
  onFinish,
}: {
  questions: QuizQuestion[];
  onFinish: (score: number, answers: Record<string, number>) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [correct, setCorrect] = useState(0);

  const q = questions[currentQ];
  const isCorrect = selected === q.correctIndex;
  const isLast = currentQ === questions.length - 1;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const newAnswers = { ...answers, [q.id]: idx };
    setAnswers(newAnswers);
    if (idx === q.correctIndex) setCorrect(c => c + 1);
  };

  const handleNext = () => {
    if (isLast) {
      const finalCorrect = selected === q.correctIndex ? correct : correct;
      const score = Math.round((finalCorrect / questions.length) * 100);
      onFinish(score, answers);
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kennistoets</span>
        <span className="text-sm font-medium text-slate-500">Vraag {currentQ + 1} van {questions.length}</span>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-8">
        <motion.div
          className="h-1.5 rounded-full bg-brand-purple"
          initial={{ width: 0 }}
          animate={{ width: `${((currentQ + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-6">{q.question}</h3>

          <div className="space-y-3 mb-6">
            {q.options.map((opt, idx) => {
              let style = 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer';
              if (answered) {
                if (idx === q.correctIndex) style = 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400';
                else if (idx === selected && !isCorrect) style = 'border-red-400 bg-red-50 ring-1 ring-red-400';
                else style = 'border-slate-100 bg-slate-50 opacity-60';
              } else if (selected === idx) {
                style = 'border-brand-purple bg-brand-purple/5 ring-1 ring-brand-purple';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${style}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      answered && idx === q.correctIndex ? 'bg-emerald-500 text-white' :
                      answered && idx === selected && !isCorrect ? 'bg-red-500 text-white' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border p-4 mb-6 ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
            >
              <p className={`text-sm font-semibold mb-1 ${isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isCorrect ? '✓ Correct!' : '✗ Helaas, niet correct'}
              </p>
              <p className="text-sm text-slate-600">{q.explanation}</p>
            </motion.div>
          )}

          {answered && (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md"
            >
              {isLast ? 'Bekijk resultaat' : 'Volgende vraag'}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ───
export default function ELearningPage() {
  const { user } = useAdmin();
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('hub');
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [lastQuizScore, setLastQuizScore] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/elearning');
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const isLessonCompleted = useCallback((moduleId: string, lessonId: string) => {
    return progress.some(p => p.module_id === moduleId && p.lesson_id === lessonId && p.completed);
  }, [progress]);

  const getModuleQuizScore = useCallback((moduleId: string) => {
    const quizRecord = progress.find(p => p.module_id === moduleId && p.lesson_id === '__quiz' && p.completed);
    return quizRecord?.quiz_score ?? null;
  }, [progress]);

  const isModuleCompleted = useCallback((moduleId: string) => {
    const mod = MODULES.find(m => m.id === moduleId);
    if (!mod) return false;
    const allLessons = mod.lessons.every(l => isLessonCompleted(moduleId, l.id));
    const quizPassed = (getModuleQuizScore(moduleId) ?? 0) >= 70;
    return allLessons && quizPassed;
  }, [isLessonCompleted, getModuleQuizScore]);

  const isModuleUnlocked = useCallback((moduleIndex: number) => {
    if (moduleIndex === 0) return true;
    return isModuleCompleted(MODULES[moduleIndex - 1].id);
  }, [isModuleCompleted]);

  const completedModuleCount = useMemo(() =>
    MODULES.filter(m => isModuleCompleted(m.id)).length,
  [isModuleCompleted]);

  const totalLessonsCompleted = useMemo(() =>
    progress.filter(p => p.completed && p.lesson_id !== '__quiz').length,
  [progress]);

  const totalLessons = useMemo(() =>
    MODULES.reduce((sum, m) => sum + m.lessons.length, 0),
  []);

  const overallProgress = totalLessons > 0 ? Math.round((totalLessonsCompleted / totalLessons) * 100) : 0;

  const activeModule = MODULES.find(m => m.id === activeModuleId) ?? null;
  const activeLesson = activeModule?.lessons[activeLessonIdx] ?? null;

  const moduleLessonsCompleted = useCallback((moduleId: string) => {
    const mod = MODULES.find(m => m.id === moduleId);
    if (!mod) return 0;
    return mod.lessons.filter(l => isLessonCompleted(moduleId, l.id)).length;
  }, [isLessonCompleted]);

  const markLessonComplete = useCallback(async (moduleId: string, lessonId: string) => {
    if (isLessonCompleted(moduleId, lessonId)) return;
    setSaving(true);
    try {
      await adminFetch('/api/admin/elearning', {
        method: 'POST',
        body: JSON.stringify({ module_id: moduleId, lesson_id: lessonId, completed: true }),
      });
      await fetchProgress();
    } catch { /* ignore */ }
    setSaving(false);
  }, [isLessonCompleted, fetchProgress]);

  const saveQuizResult = useCallback(async (moduleId: string, score: number, answers: Record<string, number>) => {
    setSaving(true);
    try {
      await adminFetch('/api/admin/elearning', {
        method: 'POST',
        body: JSON.stringify({ module_id: moduleId, lesson_id: '__quiz', completed: score >= 70, quiz_score: score, quiz_answers: answers }),
      });
      await fetchProgress();
    } catch { /* ignore */ }
    setSaving(false);
  }, [fetchProgress]);

  const openModule = (mod: Module) => {
    setActiveModuleId(mod.id);
    setActiveLessonIdx(0);
    setView('lesson');
    setSidebarOpen(false);
  };

  const goToLesson = (idx: number) => {
    setActiveLessonIdx(idx);
    setView('lesson');
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextLesson = async () => {
    if (!activeModule || !activeLesson) return;
    await markLessonComplete(activeModule.id, activeLesson.id);

    if (activeLessonIdx < activeModule.lessons.length - 1) {
      goToLesson(activeLessonIdx + 1);
    } else {
      setView('quiz');
    }
  };

  const handleQuizFinish = async (score: number, answers: Record<string, number>) => {
    if (!activeModule) return;
    setLastQuizScore(score);
    await saveQuizResult(activeModule.id, score, answers);
    setView('quiz-result');
  };

  const allCompleted = completedModuleCount === MODULES.length;

  useEffect(() => {
    if (allCompleted && view === 'hub') setView('completed');
  }, [allCompleted, view]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" />
      </div>
    );
  }

  // ─── Hub View ───
  if (view === 'hub' || view === 'completed') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <AcademicCapIcon className="h-7 w-7 text-brand-purple" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">E-Learning</h1>
            </div>
            <p className="text-sm text-slate-500">
              Welkom{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Doorloop alle modules om volledig voorbereid het veld in te gaan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <motion.circle
                  cx="28" cy="28" r="24" fill="none" stroke="#3B2F75" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={150.8}
                  initial={{ strokeDashoffset: 150.8 }}
                  animate={{ strokeDashoffset: 150.8 - (150.8 * overallProgress / 100) }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{overallProgress}%</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">{completedModuleCount}/{MODULES.length} modules</p>
              <p className="text-xs text-slate-400">{totalLessonsCompleted}/{totalLessons} lessen</p>
            </div>
          </div>
        </div>

        {/* Completion banner */}
        {allCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange p-[2px]"
          >
            <div className="rounded-[10px] bg-white p-6 text-center">
              <div className="flex justify-center mb-3">
                <TrophyIcon className="h-12 w-12 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Gefeliciteerd! 🎉</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Je hebt alle modules succesvol afgerond. Je bent nu volledig voorbereid om als account manager aan de slag te gaan voor WarmeLeads!
              </p>
            </div>
          </motion.div>
        )}

        {/* Module grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MODULES.map((mod, idx) => {
            const unlocked = isModuleUnlocked(idx);
            const completed = isModuleCompleted(mod.id);
            const lessonsComplete = moduleLessonsCompleted(mod.id);
            const quizScore = getModuleQuizScore(mod.id);
            const lessonPct = mod.lessons.length > 0 ? Math.round((lessonsComplete / mod.lessons.length) * 100) : 0;
            const inProgress = lessonsComplete > 0 && !completed;

            return (
              <motion.button
                key={mod.id}
                onClick={() => unlocked && openModule(mod)}
                disabled={!unlocked}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`group relative flex flex-col rounded-xl border p-5 text-left transition-all ${
                  completed
                    ? 'border-emerald-300 bg-white shadow-sm hover:shadow-md'
                    : unlocked
                    ? 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer'
                    : 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'
                }`}
              >
                {completed && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircleSolid className="h-6 w-6 text-emerald-500" />
                  </div>
                )}
                {!unlocked && (
                  <div className="absolute -top-2 -right-2">
                    <LockClosedIcon className="h-5 w-5 text-slate-300" />
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  {(() => { const Icon = MODULE_ICONS[mod.icon]; return Icon ? <Icon className="h-6 w-6 text-brand-purple" /> : null; })()}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Module {idx + 1}</span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 mb-1.5 line-clamp-2">{mod.title}</h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">{mod.description}</p>

                {/* Progress */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>{lessonsComplete}/{mod.lessons.length} lessen</span>
                    {quizScore !== null && <span className="font-medium text-brand-purple">{quizScore}%</span>}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <motion.div
                      className={`h-1.5 rounded-full ${completed ? 'bg-emerald-500' : 'bg-brand-purple'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${completed ? 100 : lessonPct}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                    />
                  </div>
                  <div className="mt-2">
                    {completed && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Voltooid</span>}
                    {inProgress && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple">Bezig</span>}
                    {!completed && !inProgress && unlocked && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Niet gestart</span>}
                    {!unlocked && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Vergrendeld</span>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Lesson / Quiz View ───
  if (!activeModule) return null;

  const moduleIdx = MODULES.indexOf(activeModule);

  return (
    <div className="relative min-h-[60vh]">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setView('hub'); setActiveModuleId(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Overzicht</span>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {(() => { const Icon = MODULE_ICONS[activeModule.icon]; return Icon ? <Icon className="h-6 w-6 text-brand-purple" /> : null; })()}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Module {moduleIdx + 1}</p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{activeModule.title}</h2>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto shrink-0 lg:hidden flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-600 shadow-sm"
        >
          {sidebarOpen ? <XMarkIcon className="h-4 w-4" /> : <Bars3BottomLeftIcon className="h-4 w-4" />}
          Lessen
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <AnimatePresence>
          {(sidebarOpen || true) && (
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`shrink-0 ${sidebarOpen ? 'fixed inset-0 z-50 bg-black/30 lg:static lg:bg-transparent' : 'hidden lg:block'}`}
              onClick={(e) => { if (e.target === e.currentTarget) setSidebarOpen(false); }}
            >
              <div className={`w-64 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${sidebarOpen ? 'fixed left-4 top-16 bottom-4 z-50 overflow-y-auto lg:static' : ''}`}>
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lessen</p>
                </div>
                <nav className="p-2 space-y-0.5">
                  {activeModule.lessons.map((lesson, idx) => {
                    const completed = isLessonCompleted(activeModule.id, lesson.id);
                    const isActive = view === 'lesson' && activeLessonIdx === idx;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => goToLesson(idx)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          isActive
                            ? 'bg-brand-purple/10 text-brand-purple font-semibold border-l-2 border-brand-purple'
                            : completed
                            ? 'text-slate-500 hover:bg-slate-50'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {completed ? (
                          <CheckCircleSolid className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-400'
                          }`}>{idx + 1}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      </button>
                    );
                  })}

                  <div className="border-t border-slate-100 mt-2 pt-2">
                    <button
                      onClick={() => {
                        if (activeModule.lessons.every(l => isLessonCompleted(activeModule.id, l.id))) {
                          setView('quiz');
                          setSidebarOpen(false);
                        }
                      }}
                      disabled={!activeModule.lessons.every(l => isLessonCompleted(activeModule.id, l.id))}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        view === 'quiz' || view === 'quiz-result'
                          ? 'bg-brand-purple/10 text-brand-purple font-semibold'
                          : getModuleQuizScore(activeModule.id) !== null
                          ? 'text-emerald-600'
                          : !activeModule.lessons.every(l => isLessonCompleted(activeModule.id, l.id))
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {(getModuleQuizScore(activeModule.id) ?? 0) >= 70 ? (
                        <StarSolid className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <StarIcon className="h-4 w-4 shrink-0" />
                      )}
                      <span>Kennistoets</span>
                    </button>
                  </div>
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {/* Lesson content */}
            {view === 'lesson' && activeLesson && (
              <motion.div
                key={`lesson-${activeLessonIdx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 p-5">
                  <h2 className="text-lg font-bold text-slate-900">{activeLesson.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{activeLesson.objective}</p>
                </div>
                <div className="p-5 sm:p-6">
                  {activeLesson.sections.map((section, i) => (
                    <SectionBlock key={i} section={section} />
                  ))}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 p-5">
                  <button
                    onClick={() => activeLessonIdx > 0 && goToLesson(activeLessonIdx - 1)}
                    disabled={activeLessonIdx === 0}
                    className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-4 w-4" /> Vorige
                  </button>
                  <button
                    onClick={handleNextLesson}
                    disabled={saving}
                    className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
                  >
                    {activeLessonIdx < activeModule.lessons.length - 1 ? (
                      <>Volgende les <ChevronRightIcon className="h-4 w-4" /></>
                    ) : (
                      <>Naar kennistoets <StarIcon className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Quiz */}
            {view === 'quiz' && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm"
              >
                <QuizView questions={activeModule.quiz} onFinish={handleQuizFinish} />
              </motion.div>
            )}

            {/* Quiz result */}
            {view === 'quiz-result' && (
              <motion.div
                key="quiz-result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm text-center"
              >
                {lastQuizScore >= 70 ? (
                  <>
                    <div className="flex justify-center mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                      >
                        <CheckCircleSolid className="h-16 w-16 text-emerald-500" />
                      </motion.div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Module voltooid!</h2>
                    <p className="text-slate-500 mb-2">Je hebt de kennistoets gehaald met een score van</p>
                    <p className="text-4xl font-bold text-brand-purple mb-6">{lastQuizScore}%</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      {moduleIdx < MODULES.length - 1 && isModuleUnlocked(moduleIdx + 1) && (
                        <button
                          onClick={() => openModule(MODULES[moduleIdx + 1])}
                          className="inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md"
                        >
                          Volgende module <ChevronRightIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { setView('hub'); setActiveModuleId(null); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        Terug naar overzicht
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center mb-4">
                      <ExclamationTriangleIcon className="h-16 w-16 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Helaas, niet gehaald</h2>
                    <p className="text-slate-500 mb-2">Je score: <strong className="text-slate-900">{lastQuizScore}%</strong> (minimaal 70% nodig)</p>
                    <p className="text-sm text-slate-400 mb-6">Bekijk de lesstof nog eens en probeer het opnieuw.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        onClick={() => { setActiveLessonIdx(0); setView('lesson'); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        <ArrowLeftIcon className="h-4 w-4" /> Terug naar lessen
                      </button>
                      <button
                        onClick={() => setView('quiz')}
                        className="inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md"
                      >
                        Opnieuw proberen
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
