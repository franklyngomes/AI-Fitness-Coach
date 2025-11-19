import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.error("🚨 GEMINI_API_KEY missing!");
  // Don't return a response here — Next.js ignores it at module level anyway
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Expected incoming request structure
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

// Expected JSON output structure
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

export async function POST(request: NextRequest) {
  try {
    const body: PlanRequestBody = await request.json();
    const dataSafe = body.data ?? {};

    const prompt = `Generate a complete 7-day personalized fitness plan in STRICT JSON format only—no extra text or explanations.
User: ${dataSafe.name || "Alex"}, ${dataSafe.age || 30} years old, ${
      dataSafe.gender || "male"
    }, ${dataSafe.height || 175}cm tall, ${dataSafe.weight || 70}kg.
Goal: ${dataSafe.goal || "general-fitness"}. Fitness level: ${
      dataSafe.level || "beginner"
    }. Workout location: ${dataSafe.location || "home"}. Dietary preference: ${
      dataSafe.diet || "balanced"
    }.
Medical history: ${dataSafe.medical || "None"}.

Output EXACTLY this JSON structure (make it realistic and personalized):
{
  "workout": [
    {"day": "Day 1: Full Body", "exercises": [{"name": "Squats", "sets": "3", "reps": "10-12", "rest": "60s"}]}
  ],
  "diet": [
    {"day": "Day 1", "meals": [{"meal": "Breakfast", "items": ["Oatmeal", "Banana"]}]}
  ],
  "tips": ["Drink water", "Warm up first"],
  "motivation": "You're stronger than you think—keep pushing!"
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result: GenerateContentResult = await model.generateContent(prompt);
    const content: string = result.response.text().trim();

    console.log("🤖 Gemini response preview:", content.substring(0, 200));

    // Clean + Parse JSON safely
    const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();

    if (!cleanContent.startsWith("{")) {
      throw new Error("No JSON found in response");
    }

    const parsed: FitnessPlan = JSON.parse(cleanContent);

    // Structural validation
    if (
      !parsed.workout ||
      !parsed.diet ||
      !parsed.tips ||
      !parsed.motivation
    ) {
      throw new Error("Incomplete plan structure");
    }

    return NextResponse.json({ plan: parsed });
  } catch (error) {
    const err = error as Error;
    console.error("💥 Plan generation error:", err.message);

    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
