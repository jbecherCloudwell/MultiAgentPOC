// import fetch from 'node-fetch'; // Replaced with dynamic import below
import type { ChatCompletion } from 'openai/resources';

export interface AgentMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface AgentOptions {
	model?: string;
	endpoint?: string;
	persona?: string;
}

export class OllamaAgent {
	private model: string;
	private endpoint: string;
	private persona: string;
	private messages: AgentMessage[];

	constructor(options: AgentOptions = {}) {
		this.model = options.model || process.env.OLLAMA_MODEL || 'llama3.2';
		this.endpoint = options.endpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/v1';
		this.persona = options.persona || 'You are a helpful assistant.';
		this.messages = [{ role: 'system', content: this.persona }];
	}

	addUserMessage(content: string) {
		this.messages.push({ role: 'user', content });
	}

	addAssistantMessage(content: string) {
		this.messages.push({ role: 'assistant', content });
	}

	async getCompletion(): Promise<string> {
		const body = {
			model: this.model,
			messages: this.messages,
			temperature: 0.7,
			max_tokens: 400,
			top_p: 0.95,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: false
		};
		const fetch = (await import('node-fetch')).default;
		const res = await fetch(`${this.endpoint}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
		const data = await res.json() as ChatCompletion;
		// OpenAI/ollama returns choices[0].message.content
		return data.choices?.[0]?.message?.content || '';
	}

	setModel(model: string) {
		this.model = model;
	}

	setPersona(persona: string) {
		this.persona = persona;
		this.messages[0] = { role: 'system', content: persona };
	}

	resetMessages() {
		this.messages = [{ role: 'system', content: this.persona }];
	}
}
