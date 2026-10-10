import {
  DEMO_USER,
  INITIAL_EXAMS,
  INITIAL_HABITS,
  INITIAL_TASKS,
  INITIAL_WARDROBE,
  TODAY_SCHEDULE,
} from "@/lib/mock-data";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, apiKey: clientApiKey } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "NO_API_KEY",
          message: "No Gemini API key provided. Please provide a key in Sage.",
        },
        { status: 400 },
      );
    }

    // Grounding Context from College Ess student modules
    const systemInstruction = `You are Sage, an intelligent AI college advisor integrated directly into the "College Ess" campus app.
You have real-time access to the student's personal campus modules:

Student: ${DEMO_USER.name} (${DEMO_USER.rollNo}), ${DEMO_USER.college}, ${DEMO_USER.branch}, ${DEMO_USER.semester}

Today's Rhythm (Schedule):
${TODAY_SCHEDULE.map(
  (s) => `- ${s.startTime}-${s.endTime}: ${s.courseName} (${s.courseCode}) at ${s.hall} [${s.status}]`,
).join("\n")}

Upcoming Crunch (Exams):
${INITIAL_EXAMS.map(
  (e) => `- ${e.courseName} (${e.courseCode}): ${e.date} at ${e.time}, Hall: ${e.hall}, Seat: ${e.seatNo} (in ${e.daysRemaining} days)`,
).join("\n")}

Drip (Wardrobe):
${INITIAL_WARDROBE.map(
  (w) => `- ${w.name} (${w.type}): ${w.wearsLeft}/${w.maxWears} wears left, Laundry: ${w.inLaundry}`,
).join("\n")}

Loop (Tasks):
${INITIAL_TASKS.map((t) => `- [${t.completed ? "X" : " "}] ${t.title} (${t.category}, ${t.priority})`).join("\n")}

Groove (Habits):
${INITIAL_HABITS.map((h) => `- ${h.title}: ${h.streak} day streak (Done today: ${h.completedToday})`).join("\n")}

Tone & Style:
- Be concise, practical, and helpful like a sharp college advisor.
- Directly reference their timetable, halls, seat numbers, or wardrobe whenever asked.
- Keep answers under 3 short paragraphs.`;

    // Direct Google Gemini API endpoint (zero external dependencies required)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const apiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.json().catch(() => ({}));
      const msg = errBody.error?.message || `Gemini API returned status ${apiRes.status}`;
      return NextResponse.json({ error: msg }, { status: apiRes.status });
    }

    const data = await apiRes.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const reply = candidate || "I analyzed your question, but could not produce a response.";

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error querying Gemini API";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
