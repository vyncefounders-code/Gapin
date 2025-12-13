#!/usr/bin/env python3

from gapin_sdk import Client, generate_id, hash_data

def main():
    client = Client()

    # Health check
    print("Health check:", client.health_check())

    # Generate ID
    print("Generated ID:", generate_id())

    # Hash data
    print("Hashed data:", hash_data("test").hex())

    # Publish event
    print("Publish event:", client.publish_event("test-topic", {"key": "value"}))

    # Read events
    print("Read events:", client.read_events())

if __name__ == "__main__":
    main()