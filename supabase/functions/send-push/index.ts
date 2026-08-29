// File location in your repo: supabase/functions/send-push/index.ts

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  "mailto:tether-app@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { username } = payload;
    if (!username) {
      return new Response(JSON.stringify({ error: "username required" }), { status: 400 });
    }

    const { data: row, error } = await sb
      .from("push_subscriptions")
      .select("subscription")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    if (!row?.subscription) {
      return new Response(JSON.stringify({ skipped: "no subscription" }), { status: 200 });
    }

    // Send exactly the shape your sw.js `push` handler expects:
    //   ring:    { type: "ring", from: "Satyam" }
    //   message: { title, body, url }
    const pushBody = JSON.stringify(
      payload.type === "ring"
        ? { type: "ring", from: payload.from }
        : { title: payload.title, body: payload.body, url: payload.url }
    );

    try {
      await webpush.sendNotification(row.subscription, pushBody);
    } catch (pushErr: any) {
      if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
        await sb.from("push_subscriptions").delete().eq("username", username);
      }
      throw pushErr;
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
