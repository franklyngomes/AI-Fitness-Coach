'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, Volume2, RefreshCw, DownloadIcon, Sun, Moon, StopCircle } from 'lucide-react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { useTheme } from 'next-themes';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.coerce.number("Age must be a valid number"),
  gender: z.string().min(1, "Please select a gender"),
  height: z.coerce.number("Height must be a valid number"),
  weight: z.coerce.number("Weight must be a valid number"),
  goal: z.string().min(1, "Please select a goal"),
  level: z.string().min(1, "Please select a level"),
  location: z.string().min(1, "Please select a location"),
  diet: z.string().min(1, "Please select a diet"),
  medical: z.string().optional(),
}).refine(data => data.age > 0 && data.age < 150, { message: "Age must be between 1-70", path: ["age"] })
  .refine(data => data.height > 0 && data.height < 300, { message: "Height must be between 1-299 cm", path: ["height"] })
  .refine(data => data.weight > 0 && data.weight < 1000, { message: "Weight must be between 1-130 kg", path: ["weight"] });

type FormData = z.infer<typeof formSchema>;

interface Plan {
  workout: { day: string; exercises: { name: string; sets: string; reps: string; rest: string }[] }[];
  diet: { day: string; meals: { meal: string; items: string[] }[] }[];
  tips: string[];
  motivation: string;
}

const SESSION_INDEX_KEY = 'fitness_session_index';
const SESSION_PREFIX = 'fitness_session_';

const getSessionKey = (sessionId: string) => `${SESSION_PREFIX}${sessionId}`;
const createSessionId = () => {
  const now = new Date();
  const formatValue = (n: number) => String(n).padStart(2, '0');
  const label = `${now.getFullYear()}-${formatValue(now.getMonth() + 1)}-${formatValue(now.getDate())}_${formatValue(now.getHours())}-${formatValue(now.getMinutes())}-${formatValue(now.getSeconds())}`;
  return `session_${label}`;
};

const readSessionIds = () => {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.sessionStorage.getItem(SESSION_INDEX_KEY);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [] as string[];
  } catch {
    return [] as string[];
  }
};

const clearSessionStorage = () => {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key && (key === SESSION_INDEX_KEY || key.startsWith(SESSION_PREFIX))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify([]));
};

const pruneEmptySessions = (preserveSessionId?: string) => {
  if (typeof window === 'undefined') return [] as string[];

  const previous = readSessionIds();
  const next: string[] = [];

  for (const sessionId of previous) {
    const key = getSessionKey(sessionId);
    const raw = window.sessionStorage.getItem(key);

    if (!raw) {
      window.sessionStorage.removeItem(key);
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
        window.sessionStorage.removeItem(key);
        continue;
      }
    } catch {
      window.sessionStorage.removeItem(key);
      continue;
    }

    next.push(sessionId);
  }

  if (preserveSessionId && !next.includes(preserveSessionId)) {
    next.push(preserveSessionId);
  }

  window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(next));
  return next;
};

const safeParseStoredPlan = (value: string | null): Plan | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Plan;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.workout) || !Array.isArray(parsed.diet)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export default function App() {
  // --- mount guard to avoid hydration mismatches ---
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [sessionId, setSessionId] = useState<string>('');
  const [sessionHistory, setSessionHistory] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [dailyQuote, setDailyQuote] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  const { theme, setTheme } = useTheme();
  const { register, handleSubmit, control, getValues, reset, formState: { errors } } = useForm<z.input<typeof formSchema>, FormData>({
    resolver: zodResolver(formSchema),
  });

  const applySession = (nextSessionId: string) => {
    if (typeof window === 'undefined') return;

    const nextPlan = safeParseStoredPlan(window.sessionStorage.getItem(getSessionKey(nextSessionId)));
    setSessionId(nextSessionId);
    setPlan(nextPlan);

    const currentHistory = pruneEmptySessions();
    const nextHistory = currentHistory.includes(nextSessionId)
      ? currentHistory
      : [nextSessionId, ...currentHistory];

    setSessionHistory(nextHistory);
    window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextHistory));
  };

  const startNewSession = () => {
    if (typeof window === 'undefined') return;

    const currentSessionId = createSessionId();
    const previousHistory = pruneEmptySessions();
    const nextHistory = [currentSessionId, ...previousHistory.filter(id => id !== currentSessionId)];
    window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextHistory));

    setSessionId(currentSessionId);
    setSessionHistory(nextHistory);
    setPlan(null);
    reset();
  };

  // Load saved plan and quote only on client
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const previousSessions = pruneEmptySessions();
    const currentSessionId = createSessionId();
    const nextHistory = [currentSessionId, ...previousSessions.filter(id => id !== currentSessionId)];

    window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextHistory));
    setSessionId(currentSessionId);
    setSessionHistory(nextHistory);
    setPlan(null);

    if (window.localStorage.getItem('fitnessPlan')) {
      window.localStorage.removeItem('fitnessPlan');
    }

    fetch('/api/quote')
      .then(res => {
        if (!res.ok) throw new Error('Quote fetch failed');
        return res.json();
      })
      .then(({ quote }) => setDailyQuote(quote))
      .catch(() => setDailyQuote("Push yourself today!"));
  }, []);

  const savePlanForSession = (nextPlan: Plan) => {
    if (typeof window === 'undefined' || !sessionId) return;

    const sessionKey = getSessionKey(sessionId);
    const nextHistory = pruneEmptySessions();
    const existingHistory = nextHistory.includes(sessionId) ? nextHistory : [sessionId, ...nextHistory];

    window.sessionStorage.setItem(sessionKey, JSON.stringify(nextPlan));
    window.sessionStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(existingHistory));
    setPlan(nextPlan);
    setSessionHistory(existingHistory);
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'API error');
        throw new Error(text || 'API error');
      }

      const json = await res.json();
      const planFromServer = json.plan as Plan;
      savePlanForSession(planFromServer);
      toast.success("Plan generated successfully! 🚀");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || 'Failed to generate plan. Try again.');
      } else {
        toast.error('Failed to generate plan. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Speech synthesis not supported in this environment.');
      return;
    }

    const synth = window.speechSynthesis;
    const message = (text || 'Your plan is ready.').trim();

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = synth.getVoices();
    const preferred = voices.find((voice) => /en-us|english/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error('Unable to read the plan aloud.');
    };

    synth.cancel();
    synth.speak(utterance);
  };

  const exportPDF = async () => {
    if (typeof window === 'undefined' || !planRef.current) {
      toast.error("Plan not loaded—generate first!");
      return;
    }

    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '100%';
      tempDiv.innerHTML = planRef.current.innerHTML;

      // Expand ScrollAreas (naive approach: find by typical utility class used)
      tempDiv.querySelectorAll('.h-\\[600px\\]').forEach(area => {
        (area as HTMLElement).classList.remove('h-[600px]');
        (area as HTMLElement).style.height = 'auto';
        (area as HTMLElement).style.overflow = 'visible';
      });

      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: tempDiv.scrollHeight,
      });

      document.body.removeChild(tempDiv);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`Fitness_Plan_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("PDF exported successfully! 📄");
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error("Export failed—check console.");
    }
  };

  // Render
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card/80 p-4 lg:flex lg:flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <Button variant="outline" size="sm" onClick={startNewSession}>New Session</Button>
          </div>

          <div className="space-y-2 overflow-y-auto">
            {sessionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved sessions yet.</p>
            ) : (
              sessionHistory.map((id) => {
                const isActive = id === sessionId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applySession(id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                      isActive ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background/40 text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {id.replace(/^session_/, '').replace(/_/g, ' ').replace(/T/g, ' ')}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1">
          <div className="absolute top-4 right-4 z-20">
            {mounted && (
              <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            )}
          </div>

          {/* Framer Motion wrapper only when mounted to avoid animation-related mismatches */}
          {mounted ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container mx-auto max-w-5xl p-6">
              <h1 className="text-4xl font-bold text-center mb-2">AI Fitness Coach</h1>

              <Card className="p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4">Tell me about yourself</h2>
                {/* @ts-expect-error ignore*/}
                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Name</Label>
                    <Input {...register("name")} placeholder="John Doe" />
                    {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Age</Label>
                    <Input type="number" {...register("age")} />
                    {errors.age && <p className="text-destructive text-sm mt-1">{errors.age.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Gender</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && <p className="text-destructive text-sm mt-1">{errors.gender.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Height (cm)</Label>
                    <Input type="number" {...register("height")} />
                    {errors.height && <p className="text-destructive text-sm mt-1">{errors.height.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Weight (kg)</Label>
                    <Input type="number" {...register("weight")} placeholder="Enter Weight" />
                    {errors.weight && <p className="text-destructive text-sm mt-1">{errors.weight.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Fitness Goal</Label>
                    <Controller
                      name="goal"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select goal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weight-loss">Weight Loss</SelectItem>
                            <SelectItem value="muscle-gain">Muscle Gain</SelectItem>
                            <SelectItem value="general-fitness">General Fitness</SelectItem>
                            <SelectItem value="strength">Strength</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.goal && <p className="text-destructive text-sm mt-1">{errors.goal.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Current Level</Label>
                    <Controller
                      name="level"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.level && <p className="text-destructive text-sm mt-1">{errors.level.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Workout Location</Label>
                    <Controller
                      name="location"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="gym">Gym</SelectItem>
                            <SelectItem value="outdoor">Outdoor</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.location && <p className="text-destructive text-sm mt-1">{errors.location.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Diet Preference</Label>
                    <Controller
                      name="diet"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vegetarian">Vegetarian</SelectItem>
                            <SelectItem value="non-vegetarian">Non-Vegetarian</SelectItem>
                            <SelectItem value="vegan">Vegan</SelectItem>
                            <SelectItem value="keto">Keto</SelectItem>
                            <SelectItem value="anything">Anything</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.diet && <p className="text-destructive text-sm mt-1">{errors.diet.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>Medical conditions / injuries (optional)</Label>
                    <Input {...register("medical")} placeholder="e.g., knee pain, diabetes..." />
                    {errors.medical && <p className="text-destructive text-sm mt-1">{errors.medical.message}</p>}
                  </div>

                  <Button type="submit" className="md:col-span-2" size="lg" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating Plan...</> : "Generate My Plan"}
                  </Button>
                </form>
              </Card>

              {plan && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} ref={planRef}>
                  <div className="flex justify-between items-center mb-6 flex-col gap-3 md:flex-row">
                    <h2 className="text-3xl font-bold">Your Personalized 7-Day Plan</h2>
                    <div className="flex gap-3">
                      {/* @ts-expect-error ignore*/}
                      <Button onClick={() => onSubmit(getValues())} variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Regenerate</Button>
                      <Button onClick={exportPDF}><DownloadIcon className="mr-2 h-4 w-4" /> Export PDF</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="p-4">
                      <h3 className="font-bold text-lg">Daily Motivation</h3>
                      <p className="text-2xl font-semibold text-primary mt-3">&apos;{dailyQuote}&apos;</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-bold">Workout</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSpeak(plan.workout.map(d => `${d.day}\n` + d.exercises.map(e => `${e.name}: ${e.sets} sets of ${e.reps}, rest ${e.rest}`).join('\n')).join('\n'))}
                          disabled={isSpeaking}
                        >
                          <Volume2 className="mr-2 h-4 w-4" /> Read Workout Aloud
                        </Button>
                        {isSpeaking && (
                          <Button size="sm" variant="destructive" onClick={() => toggleSpeak('')}>
                            <StopCircle className="mr-2 h-4 w-4" /> Stop
                          </Button>
                        )}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-bold">Diet</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSpeak(plan.diet.map(d => `${d.day}\n` + d.meals.map(m => `${m.meal}: ${m.items.join(', ')}`).join('\n')).join('\n'))}
                          disabled={isSpeaking}
                        >
                          <Volume2 className="mr-2 h-4 w-4" /> Read Diet Aloud
                        </Button>
                        {isSpeaking && (
                          <Button size="sm" variant="destructive" onClick={() => toggleSpeak('')}>
                            <StopCircle className="mr-2 h-4 w-4" /> Stop
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>

                  <Tabs defaultValue="workout" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="workout">Workout Plan</TabsTrigger>
                      <TabsTrigger value="diet">Diet Plan</TabsTrigger>
                    </TabsList>

                    <TabsContent value="workout">
                      <ScrollArea className="h-[600px]">
                        {plan.workout.map((day, i) => (
                          <Card key={i} className="mb-4 p-6">
                            <h3 className="text-xl font-bold mb-4">{day.day}</h3>
                            {day.exercises.map((ex, index) => (
                              <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                                <div>
                                  <p className="font-semibold">{ex.name}</p>
                                  <p className="text-sm text-muted-foreground">{ex.sets} sets × {ex.reps} • Rest {ex.rest}</p>
                                </div>
                              </div>
                            ))}
                          </Card>
                        ))}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="diet">
                      <ScrollArea className="h-[600px]">
                        {plan.diet.map((day, i) => (
                          <Card key={i} className="mb-4 p-6">
                            <h3 className="text-xl font-bold mb-4">{day.day}</h3>
                            {day.meals.map((meal, j) => (
                              <div key={j} className="mb-6">
                                <h4 className="font-semibold text-lg mb-2">{meal.meal}</h4>
                                {meal.items.map((item, k) => (
                                  <div key={k} className="flex items-center justify-between py-2">
                                    <p>{item}</p>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </Card>
                        ))}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>

                  {plan.tips.length > 0 && (
                    <Card className="mt-8 p-6">
                      <h3 className="text-2xl font-bold mb-4">Pro Tips & Motivation</h3>
                      <ul className="space-y-3">
                        {plan.tips.map((tip, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-primary mr-2">•</span> {tip}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-6 text-lg italic">{plan.motivation}</p>
                    </Card>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="container mx-auto p-6 max-w-5xl">
              <h1 className="text-4xl font-bold text-center mb-2">AI Fitness Coach</h1>
              <p className="text-center text-muted-foreground mb-8">Loading…</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
