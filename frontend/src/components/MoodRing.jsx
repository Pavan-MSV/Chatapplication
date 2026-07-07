import React, { useMemo } from "react";

const POSITIVE_WORDS = new Set([
  "great", "awesome", "love", "happy", "thanks", "thank", "good", "nice",
  "amazing", "wonderful", "excellent", "perfect", "beautiful", "fantastic",
  "brilliant", "cool", "haha", "lol", "lmao", "yes", "yay", "congrats",
  "congratulations", "welcome", "appreciate", "excited", "fun", "best",
  "wow", "superb", "agree", "sure", "absolutely", "definitely", "cheers"
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "hate", "angry", "annoyed", "frustrated", "ugh",
  "awful", "horrible", "wrong", "worst", "sad", "unfortunately",
  "disappointed", "disagree", "no", "never", "problem", "issue",
  "broken", "fail", "failed", "bug", "error", "crash", "stuck",
  "confused", "worried", "urgent", "asap", "help", "fix"
]);

const POSITIVE_EMOJIS = ["😊", "😄", "😁", "🥰", "❤️", "💚", "👍", "🎉", "🔥", "🚀", "✨", "💪", "👏", "🙌", "💯", "😍"];
const NEGATIVE_EMOJIS = ["😡", "😤", "😠", "😢", "😭", "👎", "💔", "😩", "😫", "🤦", "😒", "😞"];

function analyzeSentiment(messages) {
  if (!messages || messages.length === 0) return "neutral";

  // Only analyze last 15 messages for recency
  const recent = messages.slice(-15);
  let positiveScore = 0;
  let negativeScore = 0;

  recent.forEach((msg) => {
    if (!msg.content || msg.message_type === "deleted") return;
    const text = msg.content.toLowerCase();
    const words = text.split(/\s+/);

    words.forEach((word) => {
      const clean = word.replace(/[^a-z]/g, "");
      if (POSITIVE_WORDS.has(clean)) positiveScore += 1;
      if (NEGATIVE_WORDS.has(clean)) negativeScore += 1;
    });

    // Check for emojis
    POSITIVE_EMOJIS.forEach((e) => { if (text.includes(e)) positiveScore += 1.5; });
    NEGATIVE_EMOJIS.forEach((e) => { if (text.includes(e)) negativeScore += 1.5; });

    // Exclamation marks boost positivity slightly
    const exclamations = (text.match(/!/g) || []).length;
    positiveScore += exclamations * 0.3;

    // ALL CAPS words boost negative sentiment
    const capsWords = msg.content.split(/\s+/).filter(w => w.length > 2 && w === w.toUpperCase());
    negativeScore += capsWords.length * 0.5;
  });

  const total = positiveScore + negativeScore;
  if (total < 2) return "neutral";

  const ratio = positiveScore / (total || 1);

  if (ratio > 0.7) return "positive";
  if (ratio < 0.3) return "negative";
  if (positiveScore > 0 && negativeScore > 0) return "mixed";
  return "neutral";
}

const MOOD_CONFIG = {
  positive: { label: "Vibes are great ✨", className: "mood-positive" },
  neutral:  { label: "Neutral conversation", className: "mood-neutral" },
  negative: { label: "Getting heated 🌡️", className: "mood-negative" },
  mixed:    { label: "Mixed energy", className: "mood-mixed" },
};

export default function MoodRing({ messages }) {
  const mood = useMemo(() => analyzeSentiment(messages), [messages]);
  const config = MOOD_CONFIG[mood];

  return (
    <div className="w-full px-4 py-1" title={config.label}>
      <div className={`mood-ring-bar ${config.className}`}></div>
    </div>
  );
}
