import { getAIProvider } from '../../providers/ai';
import { searchService } from '../search/searchService';

export class AssistantService {
  private aiProvider = getAIProvider();

  async query(
    userQuery: string,
    documentId?: string
  ): Promise<{
    answer: string;
    sources: Array<{ documentId: string; documentTitle: string; page: number; excerpt: string }>;
  }> {
    // 1. Retrieve top matching documents
    const searchResults = searchService.search({ query: userQuery });
    const contextDocs = searchResults.slice(0, 5).map((r) => r.document);

    // 2. Query source-grounded AI provider
    const response = await this.aiProvider.askAssistant(userQuery, contextDocs);

    return response;
  }
}

export const assistantService = new AssistantService();
