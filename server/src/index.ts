// Multi-agent support
import { OllamaAgent } from './ollamaAgent';
import express from 'express';
import path from 'path';
import logger from './logger';
import { AgentManager } from './manager';

import { Request, Response, NextFunction } from 'express';


const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

const manager = new AgentManager();

// Store agents by ID (in-memory for now)
const agents: Record<string, OllamaAgent> = {
	agent1: new OllamaAgent({ persona: 'You are Agent 1.' }),
	agent2: new OllamaAgent({ persona: 'You are Agent 2.' })
};

const dialog: { speaker: string; message: string }[] = [];

// Log incoming chat requests
app.use('/api/chat', (req, res, next) => {
	logger.info('POST /api/chat', { body: req.body });
	next();
});

// Log agent reset requests
app.use('/api/agents/:agentId/reset', (req, res, next) => {
	logger.info(`POST /api/agents/${req.params.agentId}/reset`);
	next();
});

// Express error-handling middleware: logs all unhandled errors and returns a generic 500 response
// Type annotations added for clarity and to resolve TypeScript lint errors
app.use((err: any, req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
	logger.error('Unhandled error', { error: err });
	res.status(500).json({ error: 'Internal server error' });
});

// List available Ollama models
app.get('/api/models', async (req, res) => {
	try {
		const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
		const response = await fetch(`${ollamaEndpoint}/api/tags`);
		if (!response.ok) {
			return res.status(500).json({ error: 'Failed to fetch models from Ollama.' });
		}
		const data = await response.json() as { models?: { name: string }[] };
		const models = data.models?.map((m) => m.name) || [];
		res.json({ models });
	} catch (err) {
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
});

// List available agents and their status
app.get('/api/agents', (req, res) => {
	const agentList = Object.entries(agents).map(([id, agent]) => ({
		id,
		model: (agent as any).model,
		persona: (agent as any).persona,
		messageCount: (agent as any).messages.length
	}));
	res.json({ agents: agentList });
});

// Reset an agent's dialog history
app.post('/api/agents/:agentId/reset', (req, res) => {
	const { agentId } = req.params;
	if (!agentId || !agents[agentId]) {
		return res.status(400).json({ error: 'Invalid or missing agentId.' });
	}
	agents[agentId].resetMessages();
	res.json({ success: true });
});

// API endpoint for chat with a specific agent
app.post('/api/chat', async (req, res) => {
	console.log('Request body:', req.body);
	try {
		const { message } = req.body;
		if (!message || typeof message !== 'string') {
			return res.status(400).json({ error: 'Message is required.' });
		}
		// Add user message
		dialog.push({ speaker: 'user', message });

		// Agent 1 responds to full dialog
		const agent1Response = await agents.agent1.getCompletion(dialog);
		dialog.push({ speaker: 'agent1', message: agent1Response });

		// Agent 2 responds to full dialog (including agent1's message)
		const agent2Response = await agents.agent2.getCompletion(dialog);
		dialog.push({ speaker: 'agent2', message: agent2Response });

		res.json({
			agent1: agent1Response,
			agent2: agent2Response,
			dialog: dialog.slice(-12) // last 12 turns for brevity
		});
	} catch (err) {
		console.error('Error in /api/chat:', err);
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
});

// Redirect root to /chat for user convenience
app.get('/', (req, res) => {
	res.redirect('/chat');
});


// Serve React build at /chat and static assets only in production
if (process.env.NODE_ENV === 'production') {
	const reactBuildPath = path.join(__dirname, '../../client/build');
	app.use('/chat', express.static(reactBuildPath));
	app.get('/chat', (req, res) => {
		res.sendFile(path.join(reactBuildPath, 'index.html'));
	});
}

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
