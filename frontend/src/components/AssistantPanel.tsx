import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, MicrophoneIcon } from '@heroicons/react/24/outline';

import { api } from '../api';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

interface AssistantPanelProps {
  selectedSymbol: string;
  userId: number | null;
}

interface AssistantMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

interface AssistantResponse {
  answer: string;
  suggestions: string[];
}

const AssistantPanel: React.FC<AssistantPanelProps> = ({ selectedSymbol, userId }) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: `I am your Finply investing copilot. Ask me to analyze ${selectedSymbol}, summarize your portfolio, or explain trade risk.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    `Analyze ${selectedSymbol}`,
    'Summarize my portfolio',
    `Should I buy ${selectedSymbol}?`,
  ]);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    setSuggestions((current) => {
      const next = [`Analyze ${selectedSymbol}`, 'Summarize my portfolio', `Should I buy ${selectedSymbol}?`];
      return current.length ? current : next;
    });
  }, [selectedSymbol]);

  const browserSpeechRecognitionSupported = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const browserWindow = window as BrowserWindow;
    return !!(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition);
  }, []);

  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && (!!navigator.mediaDevices?.getUserMedia || browserSpeechRecognitionSupported),
    [browserSpeechRecognitionSupported]
  );

  const pushMessage = (role: 'user' | 'assistant', text: string) => {
    setMessages((current) => [...current, { id: Date.now() + Math.random(), role, text }]);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }

    pushMessage('user', trimmed);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post<AssistantResponse>('/assistant/chat', {
        message: trimmed,
        symbol: selectedSymbol,
        user_id: userId,
      });

      pushMessage('assistant', response.data.answer);
      setSuggestions(response.data.suggestions);
    } catch (error: any) {
      pushMessage('assistant', error?.response?.data?.detail || 'I was not able to generate an answer right now.');
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      return;
    }

    if (listening) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        return;
      }
      if (browserRecognitionRef.current) {
        browserRecognitionRef.current.stop();
        return;
      }
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream);
          audioChunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          recorder.onstop = async () => {
            setListening(false);
            stream.getTracks().forEach((track) => track.stop());

            const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'assistant-voice.webm');

            try {
              const response = await api.post<{ text: string }>('/assistant/voice/transcribe', formData);
              const transcript = response.data.text.trim();
              setInput(transcript);
              if (transcript) {
                await sendMessage(transcript);
              }
              setVoiceNotice(null);
            } catch {
              if (browserSpeechRecognitionSupported && typeof window !== 'undefined') {
                const browserWindow = window as BrowserWindow;
                const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
                if (Recognition) {
                  const recognition = new Recognition();
                  browserRecognitionRef.current = recognition;
                  recognition.continuous = false;
                  recognition.interimResults = false;
                  recognition.lang = 'en-US';
                  setVoiceNotice('Using browser speech recognition because natural voice transcription is not configured.');
                  recognition.onresult = async (event: any) => {
                    const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
                    setInput(transcript);
                    if (transcript) {
                      await sendMessage(transcript);
                    }
                  };
                  recognition.onerror = () => {
                    setVoiceNotice('Browser speech recognition was unavailable. Please type your question or configure OpenAI.');
                    setListening(false);
                    browserRecognitionRef.current = null;
                  };
                  recognition.onend = () => {
                    setListening(false);
                    browserRecognitionRef.current = null;
                  };
                  setListening(true);
                  recognition.start();
                  return;
                }
              }
              setVoiceNotice('Natural voice transcription is unavailable. Please type your question or configure OpenAI.');
            }
          };
          mediaRecorderRef.current = recorder;
          setListening(true);
          recorder.start();
        })
        .catch(() => {
          if (browserSpeechRecognitionSupported && typeof window !== 'undefined') {
            const browserWindow = window as BrowserWindow;
            const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
            if (Recognition) {
              const recognition = new Recognition();
              browserRecognitionRef.current = recognition;
              recognition.continuous = false;
              recognition.interimResults = false;
              recognition.lang = 'en-US';
              recognition.onresult = async (event: any) => {
                const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
                setInput(transcript);
                if (transcript) {
                  await sendMessage(transcript);
                }
                setVoiceNotice('Using browser speech recognition because microphone recording fallback was unavailable.');
              };
              recognition.onerror = () => {
                setVoiceNotice('Microphone access was denied or browser speech recognition is unavailable.');
                setListening(false);
                browserRecognitionRef.current = null;
              };
              recognition.onend = () => {
                setListening(false);
                browserRecognitionRef.current = null;
              };
              setListening(true);
              recognition.start();
              return;
            }
          }
          setVoiceNotice('Microphone access was denied or is unavailable in this browser.');
        });
    }

    if (browserSpeechRecognitionSupported && typeof window !== 'undefined') {
      const browserWindow = window as BrowserWindow;
      const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        browserRecognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = async (event: any) => {
          const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
          setInput(transcript);
          if (transcript) {
            await sendMessage(transcript);
          }
          setVoiceNotice('Using browser speech recognition because natural voice transcription is not configured.');
        };
        recognition.onerror = () => {
          setVoiceNotice('Browser speech recognition is unavailable. Please type your question or configure OpenAI.');
          setListening(false);
          browserRecognitionRef.current = null;
        };
        recognition.onend = () => {
          setListening(false);
          browserRecognitionRef.current = null;
        };
        setListening(true);
        recognition.start();
        return;
      }
    }

    setVoiceNotice('Voice input is unavailable in this browser. Please type your question.');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-sky-100 p-2 text-sky-700">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-950">Finply Copilot</div>
              <div className="text-sm text-slate-500">Chat and voice-input investing assistant grounded in your app data.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleListening}
              disabled={!speechSupported}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                listening ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
              } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
            >
              <span className="inline-flex items-center gap-2">
                <MicrophoneIcon className="h-4 w-4" />
                {listening ? 'Listening...' : 'Voice Input'}
              </span>
            </button>
          </div>
        </div>
        {voiceNotice && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{voiceNotice}</div>}
      </div>

      <div className="h-[460px] overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Thinking through market context...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void sendMessage(suggestion)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void sendMessage(input);
              }
            }}
            placeholder={`Ask about ${selectedSymbol}, your portfolio, or a trade idea`}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500"
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;
