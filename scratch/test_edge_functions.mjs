const SUPABASE_URL = "https://ebooolaabwsuwmqhcqkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L";

async function main() {
  console.log("Testing Edge Function 1: send-push-notification...");
  try {
    const res1 = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ title: "Teste", body: "Mensagem de teste" })
    });
    console.log("send-push-notification status:", res1.status);
    console.log("send-push-notification response:", await res1.text());
  } catch (e) {
    console.log("send-push-notification error:", e.message);
  }

  console.log("\nTesting Edge Function 2: check-overdue-fiados...");
  try {
    const res2 = await fetch(`${SUPABASE_URL}/functions/v1/check-overdue-fiados`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({})
    });
    console.log("check-overdue-fiados status:", res2.status);
    console.log("check-overdue-fiados response:", await res2.text());
  } catch (e) {
    console.log("check-overdue-fiados error:", e.message);
  }
}

main().catch(console.error);
