import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.error("🚨 GEMINI_API_KEY missing!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface PlanRequestBody {
  data?: {
    name?: string;
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    goal?: string;
    level?: string;
    location?: string;
    diet?: string;
    medical?: string;
  };
}

interface FitnessPlan {
  workout: Array<{
    day: string;
    exercises: Array<{
      name: string;
      sets: string;
      reps: string;
      rest: string;
    }>;
  }>;
  diet: Array<{
    day: string;
    meals: Array<{
      meal: string;
      items: string[];
    }>;
  }>;
  tips: string[];
  motivation: string;
}

const workoutDayNames = [
  "Day 1: Full Body",
  "Day 2: Lower Body",
  "Day 3: Upper Body",
  "Day 4: Active Recovery / Rest",
  "Day 5: Upper Body",
  "Day 6: Lower Body + Core",
  "Day 7: Recovery / Mobility",
];

const dietDayNames = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Day 6",
  "Day 7",
];

function normalizePlan(raw: Partial<FitnessPlan>): FitnessPlan {
  const workout =
    Array.isArray(raw.workout) && raw.workout.length > 0 ? raw.workout : [];
  const diet =
    Array.isArray(raw.diet) && raw.diet.length > 0 ? raw.diet : [];

  const safeWorkout = workout.map((day, index) => ({
    day: day?.day || workoutDayNames[index] || `Day ${index + 1}`,
    exercises:
      Array.isArray(day?.exercises) && day.exercises.length > 0
        ? day.exercises.map((exercise) => ({
            name: exercise?.name || "Exercise",
            sets: exercise?.sets || "3",
            reps: exercise?.reps || "10-12",
            rest: exercise?.rest || "60s",
          }))
        : [
            {
              name: "Bodyweight circuit",
              sets: "3",
              reps: "10-12",
              rest: "60s",
            },
          ],
  }));

  const safeDiet = diet.map((day, index) => ({
    day: day?.day || dietDayNames[index] || `Day ${index + 1}`,
    meals:
      Array.isArray(day?.meals) && day.meals.length > 0
        ? day.meals.map((meal) => ({
            meal: meal?.meal || "Meal",
            items:
              Array.isArray(meal?.items) && meal.items.length > 0
                ? meal.items.slice(0, 4)
                : ["Balanced nutrition"],
          }))
        : [{ meal: "Meals", items: ["Balanced nutrition plan"] }],
  }));

  return {
    workout:
      safeWorkout.length === 7
        ? safeWorkout
        : [
            ...safeWorkout,
            ...Array.from({ length: Math.max(0, 7 - safeWorkout.length) }, (_, idx) => ({
              day:
                workoutDayNames[safeWorkout.length + idx] ||
                `Day ${safeWorkout.length + idx + 1}`,
              exercises: [
                { name: "Bodyweight circuit", sets: "3", reps: "10-12", rest: "60s" },
              ],
            })),
          ],
    diet:
      safeDiet.length === 7
        ? safeDiet
        : [
            ...safeDiet,
            ...Array.from({ length: Math.max(0, 7 - safeDiet.length) }, (_, idx) => ({
              day:
                dietDayNames[safeDiet.length + idx] ||
                `Day ${safeDiet.length + idx + 1}`,
              meals: [{ meal: "Meals", items: ["Balanced nutrition plan"] }],
            })),
          ],
    tips:
      Array.isArray(raw.tips) && raw.tips.length > 0
        ? raw.tips.slice(0, 5)
        : [
            "Stay hydrated",
            "Warm up before training",
            "Prioritize sleep and recovery",
          ],
    motivation:
      typeof raw.motivation === "string" && raw.motivation.trim()
        ? raw.motivation.trim()
        : "Consistency compounds. Keep going.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: PlanRequestBody = await request.json();
    const dataSafe = body.data ?? {};

    const prompt = `You are a certified fitness coach and dietitian. Create a realistic 7-day plan for this person.

User profile:
- Name: ${dataSafe.name || "Alex"}
- Age: ${dataSafe.age || 30}
- Gender: ${dataSafe.gender || "male"}
- Height: ${dataSafe.height || 175} cm
- Weight: ${dataSafe.weight || 70} kg
- Goal: ${dataSafe.goal || "general-fitness"}
- Fitness level: ${dataSafe.level || "beginner"}
- Workout location: ${dataSafe.location || "home"}
- Dietary preference: ${dataSafe.diet || "balanced"}
- Medical notes: ${dataSafe.medical || "None"}

Task:
- Generate a personalized 7-day workout and diet plan.
- Make the plan realistic for the user's body, goal, and experience.
- Include safe progressions, meaningful rest, and clear exercise names.
- Keep the output valid JSON only.
- Ensure each workout day has 2-4 exercises, and each diet day has 2-4 meals.
- Keep the structure exactly as provided below.

Output format:
{
  "workout": [
    { "day": "Day 1: Full Body", "exercises": [{ "name": "Squats", "sets": "3", "reps": "10-12", "rest": "60s" }] }
  ],
  "diet": [
    { "day": "Day 1", "meals": [{ "meal": "Breakfast", "items": ["Oatmeal", "Banana", "Greek yogurt"] }] }
  ],
  "tips": ["Drink water", "Warm up first"],
  "motivation": "You are capable of more than you think."
}

Important requirements:
1. Return valid JSON only with no markdown fences.
2. Do not use extra keys.
3. Use 7 workout days and 7 diet days.
4. Make the exercise names, sets, reps, and rest times realistic.
5. Keep the diet aligned with the user's preference and goal.";`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result: GenerateContentResult = await model.generateContent(prompt);
    const content: string = result.response.text().trim();
    console.log("🤖 Gemini response preview:", content.substring(0, 200));

    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
    if (!cleaned.startsWith("{")) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(cleaned) as Partial<FitnessPlan>;
    const normalizedPlan = normalizePlan(parsed);

    if (
      !Array.isArray(normalizedPlan.workout) ||
      !Array.isArray(normalizedPlan.diet)
    ) {
      throw new Error("Incomplete plan structure");
    }

    return NextResponse.json({ plan: normalizedPlan });
  } catch (error) {
    const err = error as Error;
    console.error("💥 Plan generation error:", err.message);

    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
