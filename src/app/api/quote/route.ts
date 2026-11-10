import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  NextResponse.json({ quote: "Push yourself today!" });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET() {
  try {
    const prompt = "Generate one short, powerful fitness motivation quote. Output only the quote—no quotes, explanations, or extra text.";

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const quote = result.response.text().trim() || "Push yourself today!";

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json({ quote: "Push yourself today!" });
  }
}