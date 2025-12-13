import { Consumer } from 'kafkajs';

export class EventConsumer {
  private consumer: Consumer;

  constructor(consumer: Consumer) {
    this.consumer = consumer;
  }

  async consume(topic: string, callback: (message: any) => void) {
    try {
      await this.consumer.subscribe({ topic });
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const value = JSON.parse(message.value?.toString() || '{}');
          callback(value);
        },
      });
    } catch (error) {
      throw new Error('Failed to consume events');
    }
  }
}