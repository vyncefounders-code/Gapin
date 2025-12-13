import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { hash as blake3Hash } from 'blake3';

export const generateId = () => uuidv4();

export const hashData = (data: string) => blake3Hash(data);

export const makeRequest = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
};

export class Client {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async healthCheck() {
    const response = await axios.get(`${this.baseUrl}/health`);
    return response.data;
  }

  async publishEvent(topic: string, message: any) {
    const response = await axios.post(`${this.baseUrl}/events/publish`, { topic, message });
    return response.data;
  }

  async readEvents() {
    const response = await axios.get(`${this.baseUrl}/events/read`);
    return response.data;
  }
}