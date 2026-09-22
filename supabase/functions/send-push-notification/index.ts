import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Headers CORS para permitir requisições seguras
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Cache do token OAuth2 em memória
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Converte chave privada PEM para ArrayBuffer DER (PKCS8)
 */
function pemToBinary(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converte string ou buffer para Base64Url
 */
function toBase64Url(input: string | Uint8Array): string {
  let b64: string;
  if (typeof input === "string") {
    b64 = btoa(input);
  } else {
    let binary = "";
    const len = input.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(input[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Gera token OAuth2 Google via Service Account usando Web Crypto nativo
 */
async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const binaryDer = pemToBinary(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signedJwt = `${unsignedJwt}.${toBase64Url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha na autenticação OAuth2 Google: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);
  return data.access_token;
}

Deno.serve(async (req) => {
  // Tratamento de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!rawServiceAccount) {
      console.error("[send-push-notification] Secret FIREBASE_SERVICE_ACCOUNT não encontrada!");
      return new Response(
        JSON.stringify({
          error: "Configuração ausente",
          details: "Defina a secret FIREBASE_SERVICE_ACCOUNT no Supabase com o JSON da Conta de Serviço do Firebase.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      // Suporte tanto para JSON direto quanto codificado em Base64
      const parsed = rawServiceAccount.trim().startsWith("{")
        ? JSON.parse(rawServiceAccount)
        : JSON.parse(atob(rawServiceAccount));
      serviceAccount = {
        project_id: parsed.project_id,
        private_key: parsed.private_key,
        client_email: parsed.client_email,
      };
    } catch (e: any) {
      throw new Error(`Erro ao fazer parse de FIREBASE_SERVICE_ACCOUNT: ${e.message}`);
    }

    const payload: PushPayload = await req.json();
    if (!payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes: title e body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializa Supabase Client com Service Role para acessar device_tokens com segurança
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca todos os tokens cadastrados
    const { data: devices, error: dbError } = await supabase
      .from("device_tokens")
      .select("id, token, user_id, platform");

    if (dbError) {
      throw new Error(`Erro ao consultar device_tokens: ${dbError.message}`);
    }

    if (!devices || devices.length === 0) {
      console.log("[send-push-notification] Nenhum token registrado em device_tokens.");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum aparelho registrado", sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtém token de acesso para a API HTTP v1 do Firebase
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    let sentCount = 0;
    let failedCount = 0;
    const tokensToDelete: string[] = [];

    // Envia para cada token registrado
    const sendPromises = devices.map(async (device) => {
      const messageBody = {
        message: {
          token: device.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
          android: {
            priority: "high",
            notification: {
              sound: "default",
              default_sound: true,
              default_vibrate_timings: true,
              channel_id: "default",
              icon: "ic_launcher",
            },
          },
        },
      };

      try {
        const response = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; UTF-8",
          },
          body: JSON.stringify(messageBody),
        });

        if (response.ok) {
          sentCount++;
        } else {
          failedCount++;
          const errData = await response.json().catch(() => ({}));
          console.warn(`[send-push-notification] Falha ao enviar para token ${device.token.slice(0, 10)}...:`, errData);

          // Se o token for inválido ou não registrado mais, marca para remoção
          const errorCode = errData?.error?.details?.[0]?.errorCode || errData?.error?.status;
          if (
            response.status === 404 ||
            errorCode === "UNREGISTERED" ||
            errorCode === "NOT_FOUND" ||
            errorCode === "INVALID_ARGUMENT"
          ) {
            tokensToDelete.push(device.id);
          }
        }
      } catch (err) {
        failedCount++;
        console.error(`[send-push-notification] Exceção ao enviar para token:`, err);
      }
    });

    await Promise.all(sendPromises);

    // Limpa tokens obsoletos/desinstalados do banco
    if (tokensToDelete.length > 0) {
      await supabase.from("device_tokens").delete().in("id", tokensToDelete);
      console.log(`[send-push-notification] ${tokensToDelete.length} tokens inválidos removidos de device_tokens.`);
    }

    console.log(`[send-push-notification] Concluído: ${sentCount} enviados, ${failedCount} falhas.`);
    return new Response(
      JSON.stringify({
        success: true,
        totalDevices: devices.length,
        sent: sentCount,
        failed: failedCount,
        cleanedTokens: tokensToDelete.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-push-notification] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
