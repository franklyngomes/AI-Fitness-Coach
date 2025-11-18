import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: { 
        prompt: `highly realistic photo of ${prompt}, professional fitness/food photography, sharp, detailed`, 
        num_outputs: 1, 
        aspect_ratio: "1:1" 
      }
    }) as string[];

    return NextResponse.json({ url: output[0] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}