import { Producer } from 'kafkajs';

export class EventPublisher {
  private producer: Producer;

  constructor(producer: Producer) {
    this.producer = producer;
  }

  async publish(topic: string, message: any) {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
      return { success: true };
    } catch (error) {
      throw new Error('Failed to publish event');
    }
  }
}