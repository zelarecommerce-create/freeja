function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN env vars are required");
  }
  return { phoneNumberId, token };
}

export async function sendTextMessage(toPhone: string, message: string): Promise<void> {
  const { phoneNumberId, token } = getConfig();
  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: message },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed: ${response.status}`);
}
