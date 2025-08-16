import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ChatDock is a floating chat window that guides the user through a short
// onboarding sequence by asking questions stored in the Supabase table
// `onboarding_questions`. Answers are collected into a `taste` object and
// used to construct a Booking.com deep link. The component also demonstrates
// how to persist the answers to Supabase.

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [taste, setTaste] = useState({});
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const endRef = useRef(null);

  // Fetch onboarding questions once when the component mounts
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from('onboarding_questions')
        .select('question, key')
        .order('id');
      if (error) {
        console.error('Failed to fetch onboarding questions:', error);
        setMessages([
          {
            role: 'assistant',
            text: 'שגיאה בטעינת שאלות ההיכרות. אנא נסי שוב מאוחר יותר.',
          },
        ]);
        return;
      }
      setQuestions(data);
      if (data && data.length > 0) {
        setMessages([
          {
            role: 'assistant',
            text: 'היי! אני העוזרת האישית שלך. אשאל כמה שאלות כדי להכיר אותך:',
          },
          {
            role: 'assistant',
            text: data[0].question,
          },
        ]);
      } else {
        setMessages([
          { role: 'assistant', text: 'אין שאלות במאגר. אפשר להתחיל.' },
        ]);
      }
    };
    fetchQuestions();
  }, []);

  // Always scroll to the bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper to build a simple Booking deep link from preferences
  const buildBookingDeepLink = (prefs) => {
    const url = new URL('https://www.booking.com/searchresults.html');
    // Set a default date range (these values can be dynamically set)
    url.searchParams.set('checkin_year', '2025');
    url.searchParams.set('checkin_month', '08');
    url.searchParams.set('checkin_monthday', '22');
    url.searchParams.set('checkout_year', '2025');
    url.searchParams.set('checkout_month', '08');
    url.searchParams.set('checkout_monthday', '24');
    // Default occupancy: 2 adults (or 4 if family specified)
    url.searchParams.set(
      'group_adults',
      prefs.companions && prefs.companions.toLowerCase().includes('משפחה')
        ? '4'
        : '2'
    );
    url.searchParams.set('group_children', '0');
    url.searchParams.set('no_rooms', '1');
    // Currency – adjust as needed
    url.searchParams.set('selected_currency', 'ILS');
    // Location: use first area if available
    if (prefs.areas) {
      url.searchParams.set('ss', prefs.areas);
    }
    // Budget range
    if (prefs.budget_min) url.searchParams.set('minprice', prefs.budget_min);
    if (prefs.budget_max) url.searchParams.set('maxprice', prefs.budget_max);
    return url.toString();
  };

  // Handler for sending a message (user input)
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((msgs) => [...msgs, { role: 'user', text: userMessage }]);
    setInput('');

    // Still answering onboarding questions
    if (qIndex < questions.length) {
      const currentKey = questions[qIndex].key;
      // Save the answer into taste; keys may map to arrays or simple strings
      setTaste((prev) => ({ ...prev, [currentKey]: userMessage }));
      const nextIndex = qIndex + 1;
      setQIndex(nextIndex);
      if (nextIndex < questions.length) {
        // Ask next question
        setMessages((msgs) => [
          ...msgs,
          { role: 'assistant', text: questions[nextIndex].question },
        ]);
      } else {
        // All questions answered: generate link and close onboarding
        const finalPrefs = { ...taste, [currentKey]: userMessage };
        const link = buildBookingDeepLink(finalPrefs);
        setMessages((msgs) => [
          ...msgs,
          {
            role: 'assistant',
            text:
              'תודה! סיימנו את ההיכרות. הנה קישור לתוצאות לפי מה שסיפרת:\n' +
              link,
          },
        ]);
        // Save profile to Supabase
        try {
          await supabase
            .from('profiles')
            .insert({
              budget_min: finalPrefs.budget_min || null,
              budget_max: finalPrefs.budget_max || null,
              currency: 'ILS',
              areas: finalPrefs.areas || null,
              vibes: finalPrefs.vibes || null,
              diet: finalPrefs.diet || null,
              access: finalPrefs.access || null,
              companions: finalPrefs.companions || null,
            });
        } catch (err) {
          console.error('Failed to save profile:', err);
        }
      }
    } else {
      // Post-onboarding: the MVP does not support freeform chat
      setMessages((msgs) => [
        ...msgs,
        {
          role: 'assistant',
          text:
            'כרגע השלמנו את השאלות. בקרוב נוכל לנהל שיחה חופשית. רענני את הדף כדי להתחיל מחדש.',
        },
      ]);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button
          className="rounded-full shadow-lg px-4 py-3 bg-blue-600 text-white"
          onClick={() => setOpen(true)}
        >
          התחילי צ׳אט
        </button>
      ) : (
        <div className="w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <div className="font-semibold">העוזרת האישית</div>
            <button className="text-sm opacity-70" onClick={() => setOpen(false)}>
              סגור
            </button>
          </div>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] whitespace-pre-wrap leading-5 px-3 py-2 rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-blue-500 text-white ml-auto'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <input
              className="flex-1 border rounded-xl px-3 py-2 outline-none"
              placeholder="כתבי את התשובה שלך..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              className="bg-blue-600 text-white rounded-xl px-4 py-2 disabled:opacity-50"
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              שלחי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}