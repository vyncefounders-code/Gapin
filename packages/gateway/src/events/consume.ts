import { Consumer } from 'kafkajs';

export class EventConsumer {
  private consumer: Consumer;
  private isRunning: boolean = false;
  private callback: ((message: any) => void) | null = null;

  constructor(consumer: Consumer) {
    this.consumer = consumer;
  }

  /**
   * Subscribe to one or multiple topics
   * This should only be called once at startup
   */
  async subscribeToTopics(topics: string[]): Promise<void> {
    try {
      for (const topic of topics) {
        await this.consumer.subscribe({ topic });
      }
    } catch (error) {
      throw new Error(`Failed to subscribe to topics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start consuming messages from subscribed topics
   * This should only be called once after subscription
   */
  async startConsuming(callback: (message: any) => void): Promise<void> {
    if (this.isRunning) {
      throw new Error('Consumer is already running');
    }

    this.callback = callback;
    this.isRunning = true;

    try {
      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            const value = JSON.parse(message.value?.toString() || '{}');
            if (this.callback) {
              this.callback({ topic, ...value });
            }
          } catch (parseError) {
            // Log parse error; in production, use fastify.log if available
            console.warn(`Failed to parse message from ${topic}:`, parseError);
          }
        },
      });
    } catch (error) {
      this.isRunning = false;
      throw new Error(`Failed to start consumer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.consumer.stop();
      this.isRunning = false;
    } catch (error) {
      throw new Error(`Failed to stop consumer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}