/**
 * Gemini API service for generating link/URL suggestions and chat functionality
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class GeminiApiService {
  private apiKey: string | null = null;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  clearApiKey(): void {
    this.apiKey = null;
  }

  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Get link/URL suggestions from Gemini API based on prefix
   * @param prefix - The partial text to get suggestions for
   * @param context - Optional context (e.g., command like "git clone", "wget")
   * @returns Array of suggested URLs/links
   */
  async getLinkSuggestions(prefix: string, context?: string): Promise<string[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      // Build prompt based on context
      let prompt = '';
      if (context) {
        prompt = `Based on the command "${context}" and the partial input "${prefix}", suggest relevant URLs or links. `;
      } else {
        prompt = `Suggest URLs or links that match the following partial input: "${prefix}". `;
      }
      prompt += 'Return only valid URLs, one per line. Do not include any explanations or additional text.';

      // Try different model endpoints in order of preference
      const modelEndpoints = [
        { version: 'v1beta', model: 'gemini-2.0-flash' },
        { version: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { version: 'v1beta', model: 'gemini-1.5-pro-latest' },
        { version: 'v1beta', model: 'gemini-1.5-flash' },
        { version: 'v1beta', model: 'gemini-1.5-pro' },
        { version: 'v1beta', model: 'gemini-pro' },
      ];

      for (const endpoint of modelEndpoints) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/${endpoint.version}/models/${endpoint.model}:generateContent?key=${this.apiKey}`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              }
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            const errorData = JSON.parse(errorText).error;
            console.warn(`Gemini API model ${endpoint.version}/${endpoint.model} failed: ${response.status} - ${errorData?.message || errorText}`);
            continue; // Try next endpoint
          }

          const data = await response.json();

          // Extract suggestions from response
          if (data.candidates && data.candidates.length > 0) {
            const content = data.candidates[0].content;
            if (content && content.parts && content.parts.length > 0) {
              const text = content.parts[0].text;
              if (text) {
                // Parse URLs from response (one per line)
                const suggestions = text
                  .split('\n')
                  .map((line: string) => line.trim())
                  .filter((line: string) => {
                    // Filter out empty lines and lines that don't look like URLs
                    if (!line) return false;
                    // Check if line looks like a URL (contains protocol, git@, www., or domain pattern)
                    return /^(https?:\/\/|git@|www\.|[\w-]+\.[\w.]+)/i.test(line);
                  })
                  .map((line: string) => {
                    // Ensure URLs have protocol if missing
                    if (/^[\w-]+\./.test(line) && !/^(https?:\/\/|git@)/.test(line)) {
                      return `https://${line}`;
                    }
                    return line;
                  })
                  .slice(0, 10); // Limit to 10 suggestions

                return suggestions;
              }
            }
          }
          
          // If we got here, this endpoint worked but returned no suggestions
          return [];
        } catch (error) {
          console.warn(`Error trying model ${endpoint}:`, error);
          continue; // Try next endpoint
        }
      }

      // All endpoints failed
      console.error('All Gemini API models failed for link suggestions');
      return [];
    } catch (error) {
      console.error('Failed to get Gemini API suggestions:', error);
      return [];
    }
  }

  /**
   * Send chat message to Gemini API
   * @param messages - Array of chat messages with role and content
   * @param terminalContext - Optional terminal context (recent output/content)
   * @returns Assistant response text
   */
  async sendChatMessage(messages: ChatMessage[], terminalContext?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Build system instruction
      let systemInstruction = 'You are a helpful terminal assistant. You help users with terminal commands and operations. ';
      systemInstruction += 'When suggesting commands, format them in code blocks with appropriate language tags (e.g., ```bash or ```cmd). ';
      systemInstruction += 'Always explain what commands do before suggesting them.';

      // Build conversation history - format as contents array with roles
      // Build system prompt with instructions
      let systemPromptText = systemInstruction;
      if (terminalContext) {
        systemPromptText += `\n\nHere is the current terminal context:\n\n${terminalContext}\n\nPlease help the user with questions about this terminal output.`;
      }

      // Build contents array with proper role fields for conversation
      const contents: any[] = [];
      
      // Add conversation messages - convert to Gemini format with roles
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        let messageText = msg.content;
        
        // Prepend system instruction to first user message
        if (i === 0 && msg.role === 'user') {
          messageText = `${systemPromptText}\n\n${messageText}`;
        }
        
        // For Gemini API, roles are 'user' or 'model' (not 'assistant')
        const role = msg.role === 'assistant' ? 'model' : 'user';
        
        contents.push({
          role: role,
          parts: [{
            text: messageText
          }]
        });
      }
      
      // If no messages, add system prompt as first user message
      if (contents.length === 0) {
        contents.push({
          role: 'user',
          parts: [{
            text: systemPromptText
          }]
        });
      }

      // Try different model endpoints in order of preference
      const modelEndpoints = [
        { version: 'v1beta', model: 'gemini-2.0-flash' },
        { version: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { version: 'v1beta', model: 'gemini-1.5-pro-latest' },
        { version: 'v1beta', model: 'gemini-1.5-flash' },
        { version: 'v1beta', model: 'gemini-1.5-pro' },
        { version: 'v1beta', model: 'gemini-pro' },
      ];

      let lastError: Error | null = null;

      for (const endpoint of modelEndpoints) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/${endpoint.version}/models/${endpoint.model}:generateContent?key=${this.apiKey}`;

          // Build request body - use simpler format like AdStudio does (no systemInstruction)
          const requestBody = {
            contents: contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          };

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            // Success - parse response
            const data = await response.json();
            
            // Extract response text
            if (data.candidates && data.candidates.length > 0) {
              const content = data.candidates[0].content;
              if (content && content.parts && content.parts.length > 0) {
                const text = content.parts[0].text;
                if (text) {
                  console.log(`Successfully used Gemini API model: ${endpoint.version}/${endpoint.model}`);
                  return text;
                }
              }
            }
            return '';
          } else {
            // Not found or error - try next endpoint
            const errorText = await response.text();
            let errorData: any;
            try {
              errorData = JSON.parse(errorText).error;
            } catch {
              errorData = { message: errorText };
            }
            console.warn(`Gemini API model ${endpoint.version}/${endpoint.model} failed: ${response.status} - ${errorData?.message || errorText}`);
            lastError = new Error(`Gemini API error: ${response.status} ${errorText}`);
            continue;
          }
        } catch (error) {
          console.warn(`Error trying model ${endpoint.version}/${endpoint.model}:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          continue;
        }
      }

      // All endpoints failed - provide helpful error message
      if (lastError) {
        const errorMsg = `All Gemini API models failed. This usually means:
1. Your API key doesn't have access to Gemini models
2. Gemini API needs to be enabled in Google Cloud Console
3. The models may not be available in your region

Please verify:
- Your API key has Gemini API enabled
- Enable "Generative Language API" in Google Cloud Console
- Check that models are available for your API key

Last error: ${lastError.message}`;
        throw new Error(errorMsg);
      }
      
      throw new Error('Failed to connect to Gemini API');
    } catch (error) {
      console.error('Failed to send chat message to Gemini API:', error);
      throw error;
    }
  }

  /**
   * Extract commands from Gemini response
   * Looks for code blocks and command patterns
   * @param response - The Gemini API response text
   * @returns Array of extracted commands
   */
  extractCommands(response: string): string[] {
    const commands: string[] = [];

    // Extract from code blocks (```bash, ```cmd, ```sh, etc.)
    const codeBlockRegex = /```(?:bash|cmd|sh|powershell|zsh|fish)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const code = match[1].trim();
      // Split by newlines and extract individual commands
      const lines = code.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      commands.push(...lines);
    }

    // Also look for inline command patterns ($ command, > command, C:\> command)
    const inlineCommandRegex = /(?:^|\n)(?:[$>]|C:\\>|PS\s+[A-Z]:\\)\s*([^\n]+)/g;
    while ((match = inlineCommandRegex.exec(response)) !== null) {
      const cmd = match[1].trim();
      if (cmd && !commands.includes(cmd)) {
        commands.push(cmd);
      }
    }

    return commands.filter((cmd: string) => cmd.length > 0);
  }
}
