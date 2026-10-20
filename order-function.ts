// Edge Function «order»: принимает заявку с сайта, сохраняет в таблицу orders
// и отправляет сообщение в Telegram-группу (бот + бухгалтер).
// Секреты: TG_BOT_TOKEN, TG_CHAT_ID. SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED.includes("*") ? "*" : (origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]),
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const clip = (v: unknown, n = 500) => String(v ?? "").slice(0, n).trim();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: h });

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return new Response("bad json", { status: 400, headers: h }); }
  if (clip(p.hp)) return new Response("ok", { status: 200, headers: h }); // ловушка для ботов

  const phone = clip(p.phone, 40);
  if (phone.replace(/\D/g, "").length < 10) return new Response("phone required", { status: 400, headers: h });

  const row = {
    name: clip(p.name, 120), phone, tons: Number(String(p.tons).replace(",", ".")) || null,
    need_by: clip(p.when, 120), delivery: p.delivery === "deliv" ? "доставка" : "самовывоз",
    zone: clip(p.zone, 120), address: clip(p.address, 250), docs: clip(p.docs, 120), message: clip(p.text, 1500),
  };

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.from("orders").insert(row).select("id").single();
  if (error) return new Response("db error", { status: 500, headers: h });

  const sum = row.tons ? Math.round(row.tons * 220).toLocaleString("ru-RU") + " ₽" : "—";
  const text =
    `<b>Новая заявка № ${data.id}</b>\n` +
    `Клиент: ${esc(row.name || "—")}\nТелефон: ${esc(row.phone)}\n` +
    `Тоннаж: ${row.tons ?? "—"} т (≈ ${sum} при самовывозе)\nКогда: ${esc(row.need_by || "—")}\n` +
    `${row.delivery}${row.address || row.zone ? ": " + esc(row.address || row.zone) : ""}\n` +
    `Документы: ${esc(row.docs || "не нужны")}`;
  await fetch(`https://api.telegram.org/bot${Deno.env.get("TG_BOT_TOKEN")}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: Deno.env.get("TG_CHAT_ID"), text, parse_mode: "HTML" }),
  }).catch(() => {});
  return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 200, headers: { ...h, "content-type": "application/json" } });
});
