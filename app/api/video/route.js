import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { google } from "googleapis";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return new NextResponse("Missing fileId", { status: 400 });

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  const headers = new Headers();
  headers.set("Content-Type", response.headers["content-type"] || "video/mp4");
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(response.data, { headers });
}
