import { useEffect, useRef, useState } from 'react';

const WELCOME = { role: 'bot', content: 'Olá! Eu sou o MonoBot. Envie uma mensagem para começar.' };

export default function App() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const content = res.ok ? data.reply : data.error || 'Algo deu errado.';
      setMessages((prev) => [...prev, { role: 'bot', content, error: !res.ok }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'Não consegui falar com o servidor.', error: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <h1>MonoBot</h1>
        <span className={`status ${online ? 'on' : online === false ? 'off' : ''}`}>
          {online === null ? 'conectando…' : online ? 'online' : 'offline'}
        </span>
      </header>

      <main className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}${m.error ? ' error' : ''}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="message bot typing">digitando…</div>}
        <div ref={endRef} />
      </main>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem…"
          maxLength={2000}
          autoFocus
        />
        <button type="submit" disabled={!input.trim() || sending}>
          Enviar
        </button>
      </form>
    </div>
  );
}
