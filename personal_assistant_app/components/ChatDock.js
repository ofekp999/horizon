import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { showRestaurantSuggestions } from '../lib/showRestaurants';
// אם אצלך מוגדר alias של '@', השתמשי בזה במקום:
// import { showRestaurantSuggestions } from '@/lib/showRestaurants';

// ChatDock: צ'אט אונבורדינג קצר ששומר תשובות ל-Supabase
// ובסיום מחזיר רשימת מסעדות מה-API הפנימי (/api/restaurants).

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [taste, setTaste] = useState({});
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const endRef = useRef(null);

  // פונקציית עזר להוספת הודעת בוט לצ'אט
  const addBotMessage = (text) =>
    setMessages((msgs) => [...msgs, { role: 'assistant', text }]);

  // טוענים את שאלות האונבורדינג בעת טעינת הרכיב
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

      setQuestions(data || []);
      if (data && data.length > 0) {
        setMessages([
          {
            role: 'assistant',
            text: 'היי! אני העוזרת האישית שלך. אשאל כמה שאלות כדי להכיר אותך:',
          },
          { role: 'assistant', text: data[0].question },
        ]);
      } else {
        setMessages([{ role: 'assistant', text: 'אין שאלות במאגר. אפשר להתחיל.' }]);
      }
    };

    fetchQuestions();
  }, []);

  // גלילה לתחתית בכל שינוי הודעות
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // שליחת הודעה (תשובת משתמש)
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((msgs) => [...msgs, { role: 'user', text: userMessage }]);
    setInput('');

    // באמצע האונבורדינג
    if (qIndex < questions.length) {
      const currentKey = questions[qIndex].key;

      // שומרים תשובה במבנה הטעמים
      setTaste((prev) => ({ ...prev, [currentKey]: userMessage }));

      const nextIndex = qIndex + 1;
      setQIndex(nextIndex);

      if (nextIndex < questions.length) {
        // שאלה הבאה
        setMessages((msgs) => [
          ...msgs,
          { role: 'assistant', text: questions[nextIndex].question },
        ]);
      } else {
        // כל השאלות נענו — מפיקים העדפות סופיות ומציגים מסעדות
        const finalPrefs = { ...taste, [currentKey]: userMessage };

        // משפט פתיחה קצר לפני הרשימה
        addBotMessage('תודה! סיימנו את ההיכרות. בודקת מסעדות מתאימות...');

        // מביאים מסעדות מה-API ומדפיסים בצ׳אט
        await showRestaurantSuggestions(finalPrefs, addBotMessage);

        // שומרים פרופיל ל-Supabase (כמו שהיה; העמודות אצלך jsonb/מתאימות)
        try {
          await supabase.from('profiles').insert({
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
      // אחרי האונבורדינג – בגרסת ה-MVP אין שיחה חופשית
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

          {/* אזור ההודעות */}
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

          {/* קלט */}
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
