import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Inicializa as notificações push após a confirmação do login do administrador.
 * 1. Solicita permissão nativa via popup (PushNotifications.requestPermissions())
 * 2. Se concedida, registra o dispositivo (PushNotifications.register())
 * 3. Escuta o evento 'registration', recebe o token e faz upsert na tabela device_tokens do Supabase vinculado ao user_id
 * 4. Escuta 'registrationError' e loga o erro no console
 */
export async function initPushNotificationsAfterLogin(userId?: string): Promise<void> {
  // Executa exclusivamente em ambientes nativos (Android / iOS)
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Se o user_id não for fornecido diretamente, obtém da sessão atual
    let activeUserId = userId;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }

    if (!activeUserId) {
      console.warn("[PushNotifications] Login não confirmado ou user_id ausente. Notificações não registradas.");
      return;
    }

    // 1. Limpa listeners anteriores para evitar duplicações de handlers
    await PushNotifications.removeAllListeners();

    // 2. Listener para o evento 'registration': recebe o token e faz upsert na tabela device_tokens
    await PushNotifications.addListener("registration", async (token: Token) => {
      console.log("[PushNotifications] Token recebido com sucesso:", token.value);

      try {
        const platform = Capacitor.getPlatform() || "android";
        const { error } = await supabase
          .from("device_tokens")
          .upsert(
            {
              user_id: activeUserId,
              token: token.value,
              platform: platform,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,token",
            }
          );

        if (error) {
          console.error("[PushNotifications] Erro ao salvar token na tabela device_tokens:", error);
        } else {
          console.log("[PushNotifications] Token registrado com sucesso no Supabase para o usuário:", activeUserId);
        }
      } catch (upsertError) {
        console.error("[PushNotifications] Exceção ao executar upsert de device_tokens:", upsertError);
      }
    });

    // 3. Listener para o evento 'registrationError': apenas loga no console
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("[PushNotifications] Erro no registro de notificações push:", error);
    });

    // 4. Solicita permissão para exibir o popup nativo
    const permStatus = await PushNotifications.requestPermissions();

    // 5. Se a permissão for concedida, chama PushNotifications.register()
    if (permStatus.receive === "granted") {
      console.log("[PushNotifications] Permissão concedida pelo usuário. Registrando dispositivo...");
      await PushNotifications.register();
    } else {
      console.warn("[PushNotifications] Permissão de notificações negada pelo usuário:", permStatus.receive);
    }
  } catch (error) {
    console.error("[PushNotifications] Erro ao inicializar notificações após login:", error);
  }
}

// Manter alias retrocompatível caso seja invocado em outro ponto
export const initPushNotifications = initPushNotificationsAfterLogin;
