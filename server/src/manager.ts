import { Agent } from './agent';

export interface DialogTurn {
	speaker: 'user' | 'agent1' | 'agent2';
	message: string;
}

export class AgentManager {
	private agent1: Agent;
	private agent2: Agent;
	private dialog: DialogTurn[] = [];

	constructor() {
		this.agent1 = new Agent('agent1');
		this.agent2 = new Agent('agent2');
	}

	async handleUserMessage(user: string, message: string): Promise<DialogTurn[]> {
		this.dialog.push({ speaker: 'user', message });
		// Agent 1 responds to full dialog
		const agent1Response = await this.agent1.respond(message, this.dialog);
		this.dialog.push({ speaker: 'agent1', message: agent1Response });
		// Agent 2 responds to full dialog (including agent1's message)
		const agent2Response = await this.agent2.respond(agent1Response ? agent1Response : message, this.dialog);
		this.dialog.push({ speaker: 'agent2', message: agent2Response });
		return this.dialog.slice(-12); // Return last 12 turns for brevity
	}
}
