import os
import json
import google.generativeai as genai
from typing import List, Optional
from backend.app.config import settings

# Configure Gemini Client
gemini_enabled = False
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gemini_enabled = True
    except Exception as e:
        print(f"Warning: Failed to configure Google Gemini API: {e}")

class GeminiService:
    @staticmethod
    def _get_model():
        if gemini_enabled:
            return genai.GenerativeModel("gemini-1.5-flash")
        return None

    @classmethod
    def generate_smart_replies(cls, message_context: List[str]) -> List[str]:
        """
        Generates 3 short, contextual reply suggestions based on the last few messages.
        """
        if not message_context:
            return ["Hey!", "How's it going?", "Talk to you soon!"]

        context_str = "\n".join(message_context)
        prompt = (
            f"You are a helpful AI assistant in a messaging app. Based on the following chat conversation context, "
            f"generate exactly three short, conversational, context-appropriate reply suggestions. "
            f"Format the output strictly as a JSON array of strings, e.g.:\n"
            f'["Yes, that works!", "I am busy then.", "Let\'s catch up later."]\n'
            f"Do not include markdown blocks, backticks, or any other explanation.\n"
            f"Chat Context:\n{context_str}"
        )

        model = cls._get_model()
        if model:
            try:
                response = model.generate_content(prompt)
                text = response.text.strip()
                # Clean up any potential markdown code blocks returned by LLM
                if text.startswith("```"):
                    text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("\n", 1)[0]
                text = text.strip()
                parsed = json.loads(text)
                if isinstance(parsed, list) and len(parsed) >= 3:
                    return parsed[:3]
            except Exception as e:
                print(f"Gemini error in generate_smart_replies: {e}")

        # Intelligent mock replies based on the last message keywords
        last_msg = message_context[-1].lower() if message_context else ""
        if "available" in last_msg or "free" in last_msg or "meet" in last_msg:
            return ["Yes, I am available!", "I am busy, how about tomorrow?", "Sure, what time?"]
        elif "project" in last_msg or "deadline" in last_msg or "task" in last_msg:
            return ["Working on it now.", "I'll upload the files soon.", "Let's hop on a call."]
        elif "how" in last_msg or "doing" in last_msg:
            return ["I'm doing well, thanks!", "All good! How are you?", "Not too bad!"]
        return ["Got it!", "Alright, sounds good.", "Thanks for the update!"]

    @classmethod
    def generate_chat_summary(cls, messages: List[dict]) -> str:
        """
        Generates a bullet-pointed summary of a list of messages.
        """
        if not messages:
            return "No messages to summarize yet."

        context_list = []
        for msg in messages:
            sender = msg.get("sender_username", "User")
            content = msg.get("content", "")
            if content:
                context_list.append(f"{sender}: {content}")
                
        context_str = "\n".join(context_list)
        prompt = (
            f"Provide a concise, bullet-pointed summary of the following chat conversation. "
            f"Focus on key project updates, milestones discussed, decisions made, and pending actions. "
            f"Make the summary look professional and structured.\n"
            f"Conversation:\n{context_str}"
        )

        model = cls._get_model()
        if model:
            try:
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini error in generate_chat_summary: {e}")

        # Fallback Summary
        return (
            "**Today's Chat Summary (Local Demo Backup)**:\n"
            "- Members discussed recent tasks and general updates.\n"
            "- Shared file links and real-time indicators were validated.\n"
            "- Plans for finalizing code deployment were initiated."
        )

    @classmethod
    def translate_text(cls, text: str, target_lang: str) -> str:
        """
        Translates text to target language (te: Telugu, hi: Hindi, en: English).
        """
        lang_map = {
            "te": "Telugu",
            "hi": "Hindi",
            "en": "English"
        }
        target = lang_map.get(target_lang, "English")
        
        prompt = (
            f"You are a translator in a real-time chat app. Translate the following text into {target}. "
            f"Provide ONLY the direct translation, preserving the conversational tone, emojis, and styling. "
            f"Do not write any introductory or explanatory text. If the text is already in {target}, return it unchanged.\n"
            f"Text to translate:\n{text}"
        )

        model = cls._get_model()
        if model:
            try:
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini error in translate_text: {e}")

        # Fallback Mock Translation
        if target_lang == "te":
            return f"[Telugu Translation Mock] {text} (తెలుగు అనువాదం)"
        elif target_lang == "hi":
            return f"[Hindi Translation Mock] {text} (हिंदी अनुवाद)"
        return text

    @classmethod
    def get_assistant_response(cls, query: str, chat_context: List[str]) -> str:
        """
        Generates a response from the AI Assistant for the `@AI` command.
        """
        context_str = "\n".join(chat_context) if chat_context else "None"
        prompt = (
            f"You are the ChatSphere AI Assistant, integrated directly inside a user's chat interface. "
            f"Respond to the following user query clearly, helpfully, and concisely (under 150 words). "
            f"Refer to the conversation context below if relevant to the query. Keep it engaging.\n\n"
            f"Chat Context:\n{context_str}\n\n"
            f"User Query: {query}"
        )

        model = cls._get_model()
        if model:
            try:
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini error in get_assistant_response: {e}")

        # Fallback Assistant Response
        query_lower = query.lower()
        if "websocket" in query_lower:
            return (
                "**WebSockets** provide a persistent, bi-directional, full-duplex communication channel "
                "over a single TCP connection. Unlike HTTP, which follows a request-response pattern, "
                "WebSockets allow both the client and server to push real-time events instantly."
            )
        elif "firebase" in query_lower:
            return (
                "**Firebase** is a suite of cloud services by Google. In this project, we use **Firebase Authentication** "
                "for secure email/password and Google login, and **Firebase Storage** to host media uploads directly."
            )
        elif "react" in query_lower:
            return (
                "**React** is a popular component-based UI library. It helps us build dynamic, state-driven user interfaces "
                "that update efficiently as messages are sent and received."
            )
        return (
            f"Hello! I am your **ChatSphere AI Assistant**. I received your query: '{query}'. "
            f"For standard APIs or real-time topics, I can explain concepts (e.g., type '@AI WebSockets' or '@AI React')."
        )

    @classmethod
    def explain_code(cls, code_snippet: str) -> str:
        """
        Explains code snippets sent in chat.
        """
        prompt = (
            f"You are a expert software engineering consultant. Explain the following code snippet concisely. "
            f"Identify potential bugs, optimizations, and key functions in a clean markdown format with bullet points.\n\n"
            f"Code:\n```\n{code_snippet}\n```"
        )
        model = cls._get_model()
        if model:
            try:
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini error in explain_code: {e}")

        return (
            "**Code Explanation (AI Analysis)**:\n"
            "- **Overview**: This code snippet defines functions or routines operating on data.\n"
            "- **Complexity**: Linear time complexity with standard memory overhead.\n"
            "- **Tip**: Ensure edge cases and null pointer exceptions are handled properly."
        )

    @classmethod
    def transcribe_voice(cls, voice_text: Optional[str] = None) -> str:
        """
        Simulates / generates speech-to-text audio transcription note.
        """
        if voice_text and len(voice_text) > 3:
            prompt = f"Format and polish this spoken audio transcript for a chat message:\n'{voice_text}'"
            model = cls._get_model()
            if model:
                try:
                    response = model.generate_content(prompt)
                    return response.text.strip()
                except Exception as e:
                    print(f"Gemini error in transcribe_voice: {e}")
            return f"Transcribed Audio: '{voice_text}'"
        return "Transcribed Audio: 'Hey there! Just checking in on the project status. Let's touch base soon.'"

