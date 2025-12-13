import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export const generateId = (): string => uuidv4();

export const hashData = (data: string): string => {
  // Simple hash using JSON stringify for now
  // Can be replaced with crypto module later
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

export const makeRequest = async (url: string): Promise<any> => {
  const response = await axios.get(url);
  return response.data;
};

export interface EventMessage {
  [key: string]: any;
}

export interface EventResponse {
  success: boolean;
  eventId?: string;
  error?: string;
}

export class Client {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check the health status of the Gapin Gateway
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Publish an event to a topic
   * @param topic The topic name
   * @param message The event message as a JSON object
   */
  async publishEvent(topic: string, message: EventMessage): Promise<EventResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/events/publish`, {
        topic,
        message,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Publish failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Read recent events from the database
   */
  async readEvents(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/events/read`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Read events failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default Client;