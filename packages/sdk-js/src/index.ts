import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { hash as blake3Hash } from 'blake3';

export const generateId = () => uuidv4();

export const hashData = (data: string) => blake3Hash(data);

export const makeRequest = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
};