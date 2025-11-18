import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.error('🚨 GEMINI_API_KEY missing!');
  NextResponse.json({ error: 'API key config error' }, { status: 500 });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();
    const dataSafe = data || {};  // Fallback defaults

    const prompt = `Generate a complete 7-day personalized fitness plan in STRICT JSON format only—no extra text or explanations.
User: ${dataSafe.name || 'Alex'}, ${dataSafe.age || 30} years old, ${dataSafe.gender || 'male'}, ${dataSafe.height || 175}cm tall, ${dataSafe.weight || 70}kg.
Goal: ${dataSafe.goal || 'general-fitness'}. Fitness level: ${dataSafe.level || 'beginner'}. Workout location: ${dataSafe.location || 'home'}. Dietary preference: ${dataSafe.diet || 'balanced'}.
Medical history: ${dataSafe.medical || 'None'}.

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    console.log('🤖 Gemini response preview:', content.substring(0, 200));

    // Clean and parse JSON
    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      if (cleanContent.startsWith('{')) {
        parsed = JSON.parse(cleanContent);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      throw new Error('Invalid JSON response—try regenerating');
    }

    // Basic validation
    if (!parsed.workout || !parsed.diet || !parsed.tips || !parsed.motivation) {
      throw new Error('Incomplete plan structure');
    }

    return NextResponse.json({ plan: parsed });
  } catch (error: any) {
    console.error('💥 Plan generation error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}