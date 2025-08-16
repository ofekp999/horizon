import Head from 'next/head';
import ChatDock from '../components/ChatDock';

export default function Home() {
  return (
    <>
      <Head>
        <title>Personal Assistant</title>
        <meta name="description" content="Personal assistant for tailored recommendations" />
      </Head>
      <div className="min-h-screen flex flex-col">
        {/* Main content placeholder */}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-3xl font-bold mb-4">ברוכה הבאה</h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              זהו עוזר אישי פרסונלי שמכיר את הטעם שלך ויודע להציע עבורך מסעדות, חוויות ונופש בהתאמה
              אישית. ענייה על כמה שאלות ונצא לדרך!
            </p>
          </div>
        </main>
        {/* Chat floating dock */}
        <ChatDock />
      </div>
    </>
  );
}