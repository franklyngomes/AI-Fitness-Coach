import { NextRequest, NextResponse } from "next/server";

interface ImageRequestBody {
  prompt?: string;
}

function slugify(value: string) {
  return (value || "fitness illustration")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildIllustrationSvg(prompt: string) {
  const label = slugify(prompt);
  const lower = label.toLowerCase();
  const isFood = lower.includes("food") || lower.includes("meal") || lower.includes("dish") || lower.includes("salad") || lower.includes("protein") || lower.includes("breakfast") || lower.includes("lunch") || lower.includes("dinner");
  const isExercise = lower.includes("exercise") || lower.includes("workout") || lower.includes("fitness") || lower.includes("bench") || lower.includes("rows") || lower.includes("squat") || lower.includes("curl") || lower.includes("press") || lower.includes("lift");

  const backgroundA = isFood ? "#1f7a5f" : "#1d4ed8";
  const backgroundB = isFood ? "#0f172a" : "#111827";
  const accent = isFood ? "#fbbf24" : "#f97316";
  const accentSoft = isFood ? "#a7f3d0" : "#fdba74";

  const subjectTitle = isFood ? "Healthy Meal" : "Workout Focus";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${backgroundA}"/>
          <stop offset="100%" stop-color="${backgroundB}"/>
        </linearGradient>
        <linearGradient id="panel" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
        </linearGradient>
      </defs>

      <rect width="1200" height="1200" fill="url(#bg)"/>
      <rect x="90" y="90" width="1020" height="1020" rx="44" fill="url(#panel)" stroke="rgba(255,255,255,0.2)"/>

      <circle cx="600" cy="390" r="200" fill="rgba(255,255,255,0.08)"/>

      ${isFood ? `
        <ellipse cx="600" cy="540" rx="260" ry="160" fill="#f0fdf4" opacity="0.95"/>
        <path d="M410 540c32-90 140-150 260-150s216 52 254 150c28 70-26 154-134 170H548c-120-16-168-104-138-170z" fill="#f8fafc" opacity="0.92"/>
        <ellipse cx="500" cy="470" rx="80" ry="70" fill="#fbbf24"/>
        <ellipse cx="610" cy="448" rx="90" ry="74" fill="#f59e0b"/>
        <ellipse cx="720" cy="485" rx="86" ry="68" fill="#fbbf24"/>
        <circle cx="540" cy="405" r="18" fill="#fef3c7"/>
        <circle cx="690" cy="430" r="16" fill="#fef3c7"/>
        <path d="M370 600c60 70 126 76 182 70s148-12 228 18" fill="none" stroke="#86efac" stroke-width="12" stroke-linecap="round"/>
        <path d="M430 720h340" stroke="#d1fae5" stroke-width="16" stroke-linecap="round"/>
      ` : `
        <circle cx="600" cy="430" r="170" fill="rgba(255,255,255,0.12)"/>
        <path d="M540 285h120l48 168H492l48-168z" fill="#f8fafc" opacity="0.92"/>
        <path d="M580 450h40v150h-40z" fill="#f8fafc"/>
        <path d="M470 515l-120 80" stroke="#f8fafc" stroke-width="26" stroke-linecap="round"/>
        <path d="M730 515l120 80" stroke="#f8fafc" stroke-width="26" stroke-linecap="round"/>
        <path d="M520 585l-110 130" stroke="#f8fafc" stroke-width="24" stroke-linecap="round"/>
        <path d="M680 585l110 130" stroke="#f8fafc" stroke-width="24" stroke-linecap="round"/>
        <rect x="400" y="586" width="90" height="26" rx="8" fill="${accent}"/>
        <rect x="710" y="586" width="90" height="26" rx="8" fill="${accent}"/>
        <rect x="325" y="700" width="550" height="26" rx="13" fill="rgba(255,255,255,0.12)"/>
      `}

      <rect x="180" y="760" width="840" height="220" rx="24" fill="rgba(15, 23, 42, 0.45)" stroke="rgba(255,255,255,0.12)"/>
      <text x="600" y="825" text-anchor="middle" fill="#f8fafc" font-size="42" font-family="Arial, sans-serif" font-weight="700">${subjectTitle}</text>
      <text x="600" y="900" text-anchor="middle" fill="${accentSoft}" font-size="56" font-family="Arial, sans-serif" font-weight="700">${escapeXml(label)}</text>
      <text x="600" y="955" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="28" font-family="Arial, sans-serif">clean • focused • effective</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageRequestBody = await request.json();
    const prompt = body.prompt;

    if (!prompt) {
      throw new Error("Missing prompt");
    }

    const svgDataUrl = buildIllustrationSvg(prompt);

    return NextResponse.json({ url: svgDataUrl });
  } catch (err) {
    const error = err as Error;
    console.error("Image illustration error:", error.message);

    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
