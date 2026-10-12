export const chatEmojis = ["😀", "😊", "😂", "🥳", "😍", "😅", "👍", "🙌", "👏", "🙏", "💚", "🎉", "🍽️", "🎂", "☕", "💸", "✅", "🕒", "🤝", "👋"];
/** Same set as the API (comentarios.service REACTIONS). */
export const chatReactions = ["👍", "❤️", "😂", "😮", "🙏", "✅", "🎉"] as const;
export const chatReplies = ["¡Gracias! 🙌", "Lo reviso y te aviso 👀", "Un momento, por favor 🕒", "¡Qué buen plan! 🎉"];
/** Emoji-only messages get a larger bubble; ordinary text remains readable. */
export function isEmojiMessage(text: string) {
  return text.length <= 32 && /\p{Extended_Pictographic}/u.test(text) && /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\u200D\uFE0F\s]+$/u.test(text);
}
/** Inserting an expression cannot truncate a surrogate pair or silently discard a draft. */
export function appendExpression(draft: string, expression: string, limit = 500) {
  const next = draft + (draft && !/\s$/.test(draft) ? " " : "") + expression;
  return next.length <= limit ? next : draft;
}
