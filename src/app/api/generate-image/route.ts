import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

// Request body type
interface ImageRequestBody {
  prompt?: string;
}

// Types returned by HuggingFace SDK
type HFImageResponse =
  | string
  | ArrayBuffer
  | Blob
  | Buffer
  | { arrayBuffer: () => Promise<ArrayBuffer> };

// Init client
const client = new InferenceClient(process.env.HUGGINGFACE_API_TOKEN || "");

export async function POST(request: NextRequest) {
  try {
    const body: ImageRequestBody = await request.json();
    const prompt = body.prompt;

    if (!prompt) throw new Error("Missing prompt");

    console.log("🖼️ Generating image for:", prompt);

    const fullPrompt = `highly realistic photo of ${prompt}, sharp, high resolution`;

    const imageBlob: HFImageResponse = await client.textToImage({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      inputs: fullPrompt,
      parameters: {
        num_inference_steps: 28,
        guidance_scale: 7.5,
        width: 512,
        height: 512,
      },
    });

    if (!imageBlob) {
      throw new Error("No image generated");
    }

    let url: string;

    // String response (could be base64 or data URL)
    if (typeof imageBlob === "string") {
      url = imageBlob.startsWith("data:")
        ? imageBlob
        : `data:image/png;base64,${imageBlob}`;
    }
    // Raw ArrayBuffer
    else if (Object.prototype.toString.call(imageBlob) === "[object ArrayBuffer]") {
      const buffer = Buffer.from(imageBlob as ArrayBuffer);
      url = `data:image/png;base64,${buffer.toString("base64")}`;
    }
    // Blob-like or Response-like with arrayBuffer()
    else if (
      typeof (imageBlob as { arrayBuffer?: () => Promise<ArrayBuffer> })
        .arrayBuffer === "function"
    ) {
      const buffer = Buffer.from(
        await (imageBlob as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
      );
      url = `data:image/png;base64,${buffer.toString("base64")}`;
    }
    // Node.js Buffer
    else if (Buffer.isBuffer(imageBlob)) {
      url = `data:image/png;base64,${(imageBlob as Buffer).toString("base64")}`;
    }
    // Unknown fallback
    else {
      url = String(imageBlob);
    }

    console.log("✅ Image generated (base64 URL ready)");

    return NextResponse.json({ url });
  } catch (err) {
    const error = err as Error;
    console.error("Image generation error:", error.message);

    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
