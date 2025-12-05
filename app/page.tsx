export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">מערכת ניהול גרירות</h1>
        <p className="text-slate-400 mb-8">המערכת בבנייה...</p>
        <a 
          href="/login" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
        >
          כניסה למערכת
        </a>
      </div>
    </div>
  );
}