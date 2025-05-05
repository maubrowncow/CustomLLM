import { NextResponse } from "next/server";
import { saveInstructions, getLatestInstructions } from "@/app/lib/file-storage";

export async function POST(req: Request) {
  try {
    const { instructions } = await req.json();

    if (!instructions || typeof instructions !== "string") {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 }
      );
    }

    await saveInstructions(instructions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving instructions:", error);
    return NextResponse.json(
      { error: "Failed to save instructions" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const instructions = await getLatestInstructions();
    return NextResponse.json({ instructions });
  } catch (error) {
    console.error("Error retrieving instructions:", error);
    return NextResponse.json(
      { error: "Failed to retrieve instructions" },
      { status: 500 }
    );
  }
} 