import React, { useState } from 'react';

const agents = [
  { id: 'agent1', label: 'Agent 1' },
  { id: 'agent2', label: 'Agent 2' }
];

const MultiAgentChat: React.FC = () => {
  const [agentId, setAgentId] = useState('agent1');
  const [message, setMessage] = useState('');
  // Accept dialog as array of { speaker, message } from backend
  const [dialog, setDialog] = useState<{ speaker: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message })
      });
      const data = await res.json();
      // Expect backend to return { dialog: DialogTurn[] }
      if (Array.isArray(data.dialog)) {
        setDialog(data.dialog);
      } else {
        setDialog((d) => [...d, { speaker: 'System', message: 'Unexpected response from server.' }]);
      }
    } catch (err) {
      setDialog((d) => [...d, { speaker: 'System', message: 'Error sending message.' }]);
    }
    setMessage('');
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 24 }}>
      <h2>MultiAgentPOC Chat</h2>
      <div style={{ minHeight: 120, marginBottom: 16, background: '#f9f9f9', borderRadius: 4, padding: 12, fontSize: '1rem' }}>
        {dialog.length === 0 ? (
          <div style={{ color: '#888' }}>No messages yet.</div>
        ) : (
          dialog.map((turn, i) => (
            <div key={i} style={{ marginBottom: 8 }}><b>{turn.speaker}:</b> {turn.message}</div>
          ))
        )}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <select value={agentId} onChange={e => setAgentId(e.target.value)} style={{ padding: 8, borderRadius: 4 }}>
          {agents.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." required autoComplete="off" style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#1976d2', color: '#fff', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
};

export default MultiAgentChat;
