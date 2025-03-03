/**
 * Decentralized AI Agent Framework
 * Core implementation with blockchain & Web3 integration
 */

const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const { EventEmitter } = require('events');
const { ethers } = require('ethers');
const { Web3 } = require('web3');
const { create: createIPFS } = require('ipfs-http-client');
const axios = require('axios');

class DecentralizedAIAgent extends EventEmitter {
  constructor(config) {
    super();
    
    // Basic configuration
    this.id = uuidv4();
    this.name = config.name || 'Web3Agent';
    this.status = 'idle';
    
    // AI Models configuration
    this.openai = new OpenAI({ apiKey: config.apiKeys?.openai || process.env.OPENAI_API_KEY });
    this.models = {
      reasoning: config.models?.reasoning || 'gpt-4',
      execution: config.models?.execution || 'gpt-3.5-turbo'
    };
    
    // Blockchain configuration
    this.blockchain = {
      networks: config.blockchain?.networks || ['ethereum'],
      defaultNetwork: config.blockchain?.defaultNetwork || 'ethereum',
      providers: {}
    };
    
    // Initialize blockchain providers
    this.initializeBlockchainProviders(config);
    
    // Initialize IPFS
    this.ipfs = createIPFS({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https'
    });
    
    // Web3 tools registry
    this.tools = new Map();
    this.registerWeb3Tools();
    
    // Register custom tools
    if (config.web3Tools && Array.isArray(config.web3Tools)) {
      config.web3Tools.forEach(tool => this.enableTool(tool));
    }
    
    this.logger = console;
  }
  
  /**
   * Initialize blockchain providers
   */
  initializeBlockchainProviders(config) {
    // Set up providers for each network
    if (this.blockchain.networks.includes('ethereum')) {
      this.blockchain.providers.ethereum = new ethers.providers.JsonRpcProvider(
        config.rpcUrls?.ethereum || 'https://mainnet.infura.io/v3/your-key'
      );
    }
    
    if (this.blockchain.networks.includes('polygon')) {
      this.blockchain.providers.polygon = new ethers.providers.JsonRpcProvider(
        config.rpcUrls?.polygon || 'https://polygon-rpc.com'
      );
    }
    
    if (this.blockchain.networks.includes('solana')) {
      // For Solana, we might use a different client
      this.blockchain.providers.solana = { 
        endpoint: config.rpcUrls?.solana || 'https://api.mainnet-beta.solana.com' 
      };
    }
  }
  
  /**
   * Register Web3 and blockchain tools
   */
  registerWeb3Tools() {
    // Contract interaction tool
    this.registerTool({
      name: 'contractInteract',
      description: 'Interact with smart contracts on supported blockchains',
      handler: async (params) => {
        const { network, contractAddress, abi, method, args, wallet } = params;
        const provider = this.blockchain.providers[network];
        
        if (!provider) {
          return { success: false, error: `Network ${network} not supported` };
        }
        
        try {
          const contract = new ethers.Contract(contractAddress, abi, provider);
          const connectedContract = wallet ? contract.connect(wallet) : contract;
          const result = await connectedContract[method](...(args || []));
          return { success: true, result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });
    
    // Token swap tool
    this.registerTool({
      name: 'tokenSwap',
      description: 'Swap tokens on decentralized exchanges',
      handler: async (params) => {
        const { network, fromToken, toToken, amount, wallet, slippage } = params;
        
        // In a real implementation, this would connect to DEX APIs
        this.logger.info(`Simulating token swap on ${network}: ${amount} ${fromToken} -> ${toToken}`);
        
        return {
          success: true,
          fromAmount: amount,
          toAmount: amount * 1.5, // Mock exchange rate
          txHash: `0x${Math.random().toString(16).substring(2, 34)}`
        };
      }
    });
    
    // IPFS storage tool
    this.registerTool({
      name: 'ipfsStore',
      description: 'Store data on IPFS',
      handler: async (params) => {
        const { content, type } = params;
        const contentBuffer = Buffer.from(JSON.stringify(content));
        
        try {
          const result = await this.ipfs.add(contentBuffer);
          return {
            success: true,
            cid: result.path,
            url: `ipfs://${result.path}`,
            gatewayUrl: `https://ipfs.io/ipfs/${result.path}`
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });
    
    // NFT tools
    this.registerTool({
      name: 'nftCreate',
      description: 'Create an NFT on supported blockchains',
      handler: async (params) => {
        const { network, metadata, wallet, contractAddress } = params;
        
        // Store metadata on IPFS
        const ipfsResult = await this.executeTool('ipfsStore', { 
          content: metadata, 
          type: 'metadata' 
        });
        
        if (!ipfsResult.success) {
          return ipfsResult;
        }
        
        // In a real implementation, this would mint the NFT
        return {
          success: true,
          tokenId: Math.floor(Math.random() * 1000000),
          metadataUri: ipfsResult.url,
          txHash: `0x${Math.random().toString(16).substring(2, 34)}`
        };
      }
    });
  }
  
  /**
   * Register a new tool
   * @param {Object} toolDefinition - Tool definition
   */
  registerTool(toolDefinition) {
    if (!toolDefinition.name || !toolDefinition.handler) {
      throw new Error('Tool must have a name and handler function');
    }
    
    this.tools.set(toolDefinition.name, toolDefinition);
    return this;
  }
  
  /**
   * Enable a built-in tool by name
   * @param {string} toolName - Name of the tool to enable
   */
  enableTool(toolName) {
    if (this.tools.has(toolName)) {
      return this;
    }
    
    // In a full implementation, this would load built-in tools
    this.logger.warn(`No built-in tool found with name: ${toolName}`);
    return this;
  }
  
  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeTool(toolName, parameters) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    try {
      return await tool.handler(parameters);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Run a task with the agent
   * @param {Object} task - Task definition
   * @returns {Promise<Object>} - Task result
   */
  async run(task) {
    if (this.status !== 'idle') {
      throw new Error('Agent is already running a task');
    }
    
    const taskId = uuidv4();
    this.status = 'running';
    
    this.logger.info(`Starting task: ${task.objective}`);
    this.emit('taskStart', { taskId, objective: task.objective });
    
    try {
      // Create a plan based on the objective
      const plan = await this.createPlan(task);
      
      // Execute the plan
      const result = await this.executePlan(plan, task);
      
      this.status = 'idle';
      this.emit('taskComplete', { taskId, result });
      return result;
    } catch (error) {
      this.status = 'idle';
      this.emit('taskFailed', { taskId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Create a plan for the task
   * @param {Object} task - Task definition
   * @returns {Promise<Array>} - Array of steps
   */
  async createPlan(task) {
    // Prompt the AI model to create a plan
    const planningPrompt = `
      Create a step-by-step plan for: "${task.objective}".
      
      Available Web3 tools: ${Array.from(this.tools.keys()).join(', ')}
      Supported blockchains: ${this.blockchain.networks.join(', ')}
      
      Format the response as a JSON array of steps, each with:
      - id: string
      - description: string
      - tool: string (if applicable)
      - parameters: object (if applicable)
    `;
    
    const response = await this.openai.chat.completions.create({
      model: this.models.reasoning,
      messages: [{ role: 'user', content: planningPrompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });
    
    try {
      const planContent = response.choices[0].message.content;
      return JSON.parse(planContent).steps;
    } catch (error) {
      throw new Error(`Failed to create plan: ${error.message}`);
    }
  }
  
  /**
   * Execute the plan
   * @param {Array} plan - Array of steps
   * @param {Object} task - Original task
   * @returns {Promise<Object>} - Execution results
   */
  async executePlan(plan, task) {
    const results = {};
    
    for (const step of plan) {
      this.emit('stepStart', { step });
      
      try {
        let stepResult;
        
        if (step.tool && this.tools.has(step.tool)) {
          // Execute with the specified tool
          stepResult = await this.executeTool(step.tool, {
            ...step.parameters,
            walletAddress: task.walletAddress
          });
        } else {
          // Use AI reasoning for steps without specific tools
          stepResult = await this.executeReasoning(step, results);
        }
        
        results[step.id] = stepResult;
        this.emit('stepComplete', { step, result: stepResult });
      } catch (error) {
        this.emit('stepFailed', { step, error: error.message });
        throw error;
      }
    }
    
    // Create final report
    return this.createFinalReport(task, results);
  }
  
  /**
   * Execute a reasoning step
   * @param {Object} step - Step definition
   * @param {Object} previousResults - Results from previous steps
   * @returns {Promise<Object>} - Reasoning result
   */
  async executeReasoning(step, previousResults) {
    const prompt = `
      You are executing step: "${step.description}"
      
      Previous results: ${JSON.stringify(previousResults)}
      
      Provide your reasoning and conclusion for this step.
    `;
    
    const response = await this.openai.chat.completions.create({
      model: this.models.execution,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });
    
    return {
      success: true,
      reasoning: response.choices[0].message.content
    };
  }
  
  /**
   * Create the final report
   * @param {Object} task - Original task
   * @param {Object} results - Results from all steps
   * @returns {Promise<Object>} - Final report
   */
  async createFinalReport(task, results) {
    const prompt = `
      Summarize the results of the task: "${task.objective}"
      
      Step results: ${JSON.stringify(results)}
      
      Create a concise summary of what was accomplished and any relevant blockchain transaction details.
    `;
    
    const response = await this.openai.chat.completions.create({
      model: this.models.execution,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    
    return {
      success: true,
      objective: task.objective,
      summary: response.choices[0].message.content,
      results
    };
  }
}

/**
 * Factory for creating preconfigured agents
 */
class AgentFactory {
  /**
   * Create a new agent
   * @param {Object} config - Agent configuration
   * @returns {DecentralizedAIAgent} - Configured agent instance
   */
  static create(config) {
    return new DecentralizedAIAgent(config);
  }
}

module.exports = { DecentralizedAIAgent, AgentFactory };
