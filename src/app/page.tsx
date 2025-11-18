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
import { Loader2, Volume2, RefreshCw, DownloadIcon, Sun, Moon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useTheme } from 'next-themes';

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
}).refine(data => data.age > 0 && data.age < 150, { message: "Age must be between 1-149", path: ["age"] })
  .refine(data => data.height > 0 && data.height < 300, { message: "Height must be between 1-299 cm", path: ["height"] })
  .refine(data => data.weight > 0 && data.weight < 1000, { message: "Weight must be between 1-999 kg", path: ["weight"] });

type FormData = z.infer<typeof formSchema>;

interface Plan {
  workout: { day: string; exercises: { name: string; sets: string; reps: string; rest: string }[] }[];
  diet: { day: string; meals: { meal: string; items: string[] }[] }[];
  tips: string[];
  motivation: string;
}

export default function App() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [dailyQuote, setDailyQuote] = useState('');
  const planRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  const { register, handleSubmit, control, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const saved = localStorage.getItem('fitnessPlan');
    if (saved) setPlan(JSON.parse(saved));

    fetch('/api/quote')
      .then(res => {
        if (!res.ok) throw new Error('Quote fetch failed');
        return res.json();
      })
      .then(({ quote }) => setDailyQuote(quote))
      .catch(() => setDailyQuote("Push yourself today!"));
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),  // Send form data
      });

      if (!res.ok) throw new Error('API error');

      const { plan } = await res.json();
      setPlan(plan);
      localStorage.setItem('fitnessPlan', JSON.stringify(plan));
      toast.success("Plan generated successfully! 🚀");
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to generate plan. Try again.';
      toast.error(errorMsg.includes('API') ? 'API issue—check console or retry soon.' : errorMsg);
    }
    setLoading(false);
  };

  const generateImage = async (item: string) => {
    if (images[item]) return images[item];

    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: item }),
    });

    if (!res.ok) throw new Error('Image gen failed');

    const { url } = await res.json();
    setImages(prev => ({ ...prev, [item]: url }));
    return url;
  };

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  };

  const exportPDF = async () => {
    if (!planRef.current) return;
    const canvas = await html2canvas(planRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save(`Fitness_Plan_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <div className="absolute top-4 right-4">
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container mx-auto p-6 max-w-5xl">
          <h1 className="text-4xl font-bold text-center mb-2">AI Fitness Coach</h1>
          <p className="text-center text-muted-foreground mb-8">Your personal AI trainer • Powered by Groq Llama 3.1 70B</p>

          <Card className="p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">Tell me about yourself</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input {...register("name")} placeholder="John Doe" />
                {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Age</Label>
                <Input type="number" {...register("age")} />
                {errors.age && <p className="text-destructive text-sm mt-1">{errors.age.message}</p>}
              </div>
              <div>
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
              <div>
                <Label>Height (cm)</Label>
                <Input type="number" {...register("height")} />
                {errors.height && <p className="text-destructive text-sm mt-1">{errors.height.message}</p>}
              </div>
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" {...register("weight")} />
                {errors.weight && <p className="text-destructive text-sm mt-1">{errors.weight.message}</p>}
              </div>
              <div>
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
              <div>
                <Label>Current Level</Label>
                <Controller
                  name="level"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
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
              <div>
                <Label>Workout Location</Label>
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
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
              <div className="md:col-span-2">
                <Label>Diet Preference</Label>
                <Controller
                  name="diet"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
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
              <div className="md:col-span-2">
                <Label>Medical conditions / injuries (optional)</Label>
                <Input {...register("medical")} placeholder="e.g., knee pain, diabetes..." />
                {errors.medical && <p className="text-destructive text-sm mt-1">{errors.medical.message}</p>}
              </div>

              <Button type="submit" className="md:col-span-2" size="lg" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating Plan...</> : "🚀 Generate My Plan"}
              </Button>
            </form>
          </Card>

          {plan && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} ref={planRef}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Your Personalized 7-Day Plan</h2>
                <div className="flex gap-3">
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
                  <Button size="sm" variant="outline" onClick={() => speak(plan.workout.map(d => `${d.day}\n` + d.exercises.map(e => `${e.name}: ${e.sets} sets of ${e.reps}, rest ${e.rest}`).join('\n')).join('\n'))}>
                    <Volume2 className="mr-2 h-4 w-4" /> Read Workout Aloud
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="font-bold">Diet</h3>
                  <Button size="sm" variant="outline" onClick={() => speak(plan.diet.map(d => `${d.day}\n` + d.meals.map(m => `${m.meal}: ${m.items.join(', ')}`).join('\n')).join('\n'))}>
                    <Volume2 className="mr-2 h-4 w-4" /> Read Diet Aloud
                  </Button>
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
                        {day.exercises.map((ex, j) => (
                          <div key={j} className="flex items-center justify-between py-3 border-b last:border-0">
                            <div>
                              <p className="font-semibold">{ex.name}</p>
                              <p className="text-sm text-muted-foreground">{ex.sets} sets × {ex.reps} • Rest {ex.rest}</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={async () => {
                              const url = await generateImage(ex.name + " exercise proper form");
                              window.open(url, '_blank');
                            }}>
                              👀 See Image
                            </Button>
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
                                <Button size="sm" variant="secondary" onClick={async () => {
                                  const url = await generateImage(item + " food dish appetizing");
                                  window.open(url, '_blank');
                                }}>
                                  🍳 See Image
                                </Button>
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
      </div>
    </>
  );
}